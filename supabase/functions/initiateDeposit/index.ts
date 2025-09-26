import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function createSign(params: Record<string, any>, secretKey: string): Promise<string> {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'sign' && k !== 'sign_type')
    .sort((a, b) => a[0].localeCompare(b[0], 'en'));
  const query = entries.map(([k, v]) => `${k}=${v}`).join('&') + `&key=${secretKey}`;
  const data = new TextEncoder().encode(query);
  const hashBuffer = await crypto.subtle.digest('MD5', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(token);
    if (authError || !user) throw new Error('Unauthorized');

    const { planId, localCurrency = 'USD' } = await req.json();
    if (!planId) throw new Error('Plan ID is required');

    const { data: plan, error: planError } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', planId)
      .single();
    if (planError || !plan) throw new Error('Plan not found');

    // FX handling (optional)
    let tradeAmount = plan.deposit_usd / 100; // default USD
    if (localCurrency && localCurrency !== 'USD') {
      const { data: conversionRate } = await supabaseAdmin
        .from('conversion_rates')
        .select('*')
        .eq('base_currency', 'USD')
        .eq('quote_currency', localCurrency)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .single();
      const fxRate = conversionRate?.rate || 1650; // fallback for NGN
      tradeAmount = (plan.deposit_usd / 100) * fxRate;
    }

    // Generate unique order number
    const mchOrderNo = `WS-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create deposit record (ensure it shows in history as pending)
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from('deposits')
      .insert({
        user_id: user.id,
        plan_id: planId,
        amount_usd_cents: plan.deposit_usd,
        method: 'base',
        status: 'pending',
        mch_order_no: mchOrderNo,
        local_currency: localCurrency,
        local_amount: tradeAmount,
        gateway: 'basepay'
      })
      .select()
      .single();
    if (depositError) throw new Error('Failed to create deposit record');

    // Build Basepay payload
    const currentDate = new Date();
    const order_date = `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,'0')}-${String(currentDate.getDate()).padStart(2,'0')} ${String(currentDate.getHours()).padStart(2,'0')}:${String(currentDate.getMinutes()).padStart(2,'0')}:${String(currentDate.getSeconds()).padStart(2,'0')}`;

    const mch_id = Deno.env.get('BASEPAY_MCH_ID') || '300333012';
    const pay_type = Deno.env.get('BASEPAY_DEFAULT_PAY_TYPE') || '523';
    const collection_key = Deno.env.get('BASEPAY_COLLECTION_KEY') ?? '';
    const pay_url = Deno.env.get('BASEPAY_PAY_URL') || 'https://pay.aiffpay.com/pay/web';

    const siteUrl = req.headers.get('origin') || Deno.env.get('SITE_URL') || 'https://example.com';

    const payload: Record<string, string> = {
      version: '1.0',
      mch_id: String(mch_id),
      notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/webhookDeposit`,
      page_url: `${siteUrl}/payment-return`,
      mch_order_no: mchOrderNo,
      pay_type: String(pay_type),
      trade_amount: tradeAmount.toFixed(2),
      order_date,
      bank_code: localCurrency === 'NGN' ? 'NGR044' : 'DEFAULT',
      goods_name: 'Deposit',
      sign_type: 'MD5'
    };

    const sign = await createSign(payload, collection_key);
    const finalPayload = { ...payload, sign };

    // Convert to x-www-form-urlencoded
    const body = new URLSearchParams();
    Object.entries(finalPayload).forEach(([k, v]) => body.append(k, String(v)));

    const basepayResponse = await fetch(pay_url, { method: 'POST', body });
    const responseText = await basepayResponse.text();

    await supabaseAdmin.from('gateway_logs').insert({
      type: 'initiate_payment',
      payload: { request: payload, response: responseText, status: basepayResponse.status },
      deposit_id: deposit.id
    });

    if (!basepayResponse.ok) throw new Error(`Basepay request failed: ${responseText}`);

    let payInfo: any;
    try { payInfo = JSON.parse(responseText); } catch { payInfo = { url: responseText }; }

    return new Response(JSON.stringify({ success: true, payInfo, depositId: deposit.id, mchOrderNo }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  } catch (e: any) {
    console.error('initiateDeposit error:', e);
    return new Response(JSON.stringify({ error: e.message || 'Unknown error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    });
  }
});