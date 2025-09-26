import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility function to create MD5 signature for Basepay
async function createSign(params: Record<string, any>, secretKey: string): Promise<string> {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'sign' && k !== 'sign_type')
    .sort((a, b) => a[0].localeCompare(b[0], 'en'));
  
  const query = entries.map(([k, v]) => `${k}=${v}`).join('&') + `&key=${secretKey}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(query);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Create user client for authentication
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { planId, countryCode, localCurrency = 'NGN', localAmount: providedAmount } = await req.json();

    if (!planId) {
      throw new Error("Plan ID is required");
    }

    // Get plan details
    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planError || !plan) {
      throw new Error("Plan not found");
    }

    // Get latest conversion rate for local currency
    const { data: conversionRate } = await supabaseAdmin
      .from('conversion_rates')
      .select('*')
      .eq('base_currency', 'USD')
      .eq('quote_currency', localCurrency)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .single();

    const fxRate = conversionRate?.rate || 1650; // Default NGN rate if not found
    const localAmount = providedAmount || ((plan.deposit_usd / 100) * fxRate);

    // Generate unique order number
    const mchOrderNo = `WS-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create deposit record with FX data
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from('deposits')
      .insert({
        user_id: user.id,
        plan_id: planId,
        amount_usd_cents: plan.deposit_usd,
        local_amount: localAmount,
        local_currency: localCurrency,
        fx_rate: fxRate,
        fx_at: new Date().toISOString(),
        gateway: 'basepay',
        method: 'base',
        mch_order_no: mchOrderNo,
        status: 'pending'
      })
      .select()
      .single();

    if (depositError) {
      throw new Error("Failed to create deposit record");
    }

    // Get Basepay configuration
    const basepayMchId = Deno.env.get("BASEPAY_MCH_ID");
    const basepayCollectionKey = Deno.env.get("BASEPAY_COLLECTION_KEY");
    const basepayPayUrl = Deno.env.get("BASEPAY_PAY_URL") || "https://pay.aiffpay.com/pay/web";
    const siteUrl = req.headers.get("origin") || Deno.env.get("SITE_URL") || "https://yourapp.com";

    // Prepare payment payload
    const currentDate = new Date();
    const orderDate = currentDate.getFullYear() + '-' + 
                     String(currentDate.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(currentDate.getDate()).padStart(2, '0') + ' ' +
                     String(currentDate.getHours()).padStart(2, '0') + ':' +
                     String(currentDate.getMinutes()).padStart(2, '0') + ':' +
                     String(currentDate.getSeconds()).padStart(2, '0');

    const payload = {
      version: "1.0",
      mch_id: basepayMchId,
      notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/basepay-webhook-v2`,
      page_url: `${siteUrl}/wallet`,
      mch_order_no: mchOrderNo,
      pay_type: Deno.env.get("BASEPAY_DEFAULT_PAY_TYPE") || "523",
      trade_amount: localAmount.toFixed(2),
      order_date: orderDate,
      bank_code: "NGR044",
      goods_name: `Investment Plan: ${plan.name}`,
      sign_type: "MD5"
    };

    // Create signature
    const signature = await createSign(payload, basepayCollectionKey!);
    const finalPayload = { ...payload, sign: signature };

    // Convert to form data
    const formData = new FormData();
    Object.entries(finalPayload).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    // Send request to Basepay
    const basepayResponse = await fetch(basepayPayUrl, {
      method: 'POST',
      body: formData
    });

    const responseText = await basepayResponse.text();
    
    // Log the response
    await supabaseAdmin
      .from('gateway_logs')
      .insert({
        type: 'initiate_payment',
        payload: {
          request: finalPayload,
          response: responseText,
          status: basepayResponse.status
        },
        deposit_id: deposit.id
      });

    if (!basepayResponse.ok) {
      throw new Error(`Basepay request failed: ${responseText}`);
    }

    // Try to parse JSON response or return redirect URL
    let payInfo;
    try {
      payInfo = JSON.parse(responseText);
    } catch {
      // If not JSON, assume it's a redirect URL
      payInfo = { url: responseText };
    }

    return new Response(
      JSON.stringify({
        success: true,
        payInfo,
        depositId: deposit.id,
        mchOrderNo,
        localAmount: localAmount.toFixed(2),
        localCurrency,
        fxRate
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Basepay initiate error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});