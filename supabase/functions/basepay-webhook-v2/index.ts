import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility function to create MD5 signature for verification
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
    // Create Supabase client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get client IP
    const clientIP = req.headers.get("x-forwarded-for") || 
                    req.headers.get("x-real-ip") || 
                    "unknown";

    // Parse form data from webhook
    const formData = await req.formData();
    const webhookData: Record<string, any> = {};
    
    for (const [key, value] of formData.entries()) {
      webhookData[key] = value.toString();
    }

    console.log('Webhook received:', { clientIP, webhookData });

    // Log all incoming webhook events
    const { data: webhookEvent, error: webhookLogError } = await supabaseAdmin
      .from('webhook_events')
      .insert({
        gateway: 'basepay',
        payload: webhookData,
        signature_ok: false,
        source_ip: clientIP,
        processed: false
      })
      .select()
      .single();

    if (webhookLogError) {
      console.error('Failed to log webhook event:', webhookLogError);
    }

    // Verify client IP
    const allowedIPs = (Deno.env.get("CALLBACK_ALLOWED_IPS") || "").split(",");
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`Unauthorized IP: ${clientIP}`);
      return new Response("Unauthorized IP", { status: 403 });
    }

    // Verify signature
    const basepayCollectionKey = Deno.env.get("BASEPAY_COLLECTION_KEY");
    const receivedSign = webhookData.sign;
    delete webhookData.sign; // Remove sign for verification
    
    const expectedSign = await createSign(webhookData, basepayCollectionKey!);
    const signatureValid = receivedSign === expectedSign;

    console.log('Signature verification:', { receivedSign, expectedSign, signatureValid });

    // Update webhook event with signature verification result
    if (webhookEvent) {
      await supabaseAdmin
        .from('webhook_events')
        .update({ signature_ok: signatureValid })
        .eq('id', webhookEvent.id);
    }

    if (!signatureValid) {
      console.warn('Invalid signature');
      return new Response("Invalid signature", { status: 400 });
    }

    // Check if payment was successful
    if (webhookData.tradeResult === '1') {
      const mchOrderNo = webhookData.mchOrderNo;
      
      // Find corresponding deposit
      const { data: deposit, error: depositError } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .eq('mch_order_no', mchOrderNo)
        .single();

      if (depositError || !deposit) {
        console.error('Deposit not found:', mchOrderNo);
        return new Response("Deposit not found", { status: 404 });
      }

      // Check for idempotency - avoid double processing
      if (deposit.status === 'confirmed') {
        console.log('Deposit already processed:', mchOrderNo);
        await supabaseAdmin
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', webhookEvent?.id);
        return new Response("success");
      }

      // Mark deposit as confirmed
      const { error: updateDepositError } = await supabaseAdmin
        .from('deposits')
        .update({
          status: 'confirmed',
          gateway_ref: webhookData.orderNo || webhookData.tradeNo,
          confirmed_at: new Date().toISOString()
        })
        .eq('id', deposit.id);

      if (updateDepositError) {
        console.error('Failed to update deposit:', updateDepositError);
        return new Response("Failed to update deposit", { status: 500 });
      }

      // Credit user wallet
      const { error: walletError } = await supabaseAdmin
        .from('wallets')
        .update({
          available_cents: supabaseAdmin.sql`available_cents + ${deposit.amount_usd_cents}`,
          total_earned_cents: supabaseAdmin.sql`total_earned_cents + ${deposit.amount_usd_cents}`
        })
        .eq('user_id', deposit.user_id);

      if (walletError) {
        console.error('Failed to update wallet:', walletError);
      }

      // Create wallet transaction
      await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: deposit.user_id,
          type: 'deposit',
          amount_cents: deposit.amount_usd_cents,
          reference_id: deposit.id,
          meta: {
            mch_order_no: mchOrderNo,
            gateway_ref: webhookData.orderNo || webhookData.tradeNo,
            local_amount: deposit.local_amount,
            local_currency: deposit.local_currency,
            fx_rate: deposit.fx_rate
          }
        });

      // Get plan details for income events
      const { data: plan } = await supabaseAdmin
        .from('plans')
        .select('*')
        .eq('id', deposit.plan_id)
        .single();

      if (plan) {
        // Schedule first income event (22 hours from now)
        const firstIncomeDate = new Date();
        firstIncomeDate.setHours(firstIncomeDate.getHours() + 22);

        await supabaseAdmin
          .from('income_events')
          .insert({
            deposit_id: deposit.id,
            user_id: deposit.user_id,
            amount_cents: plan.payout_per_drop_usd,
            drop_number: 1,
            due_at: firstIncomeDate.toISOString(),
            status: 'pending'
          });
      }

      // Process referral bonuses
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('referrer_id')
        .eq('user_id', deposit.user_id)
        .single();

      if (profile?.referrer_id) {
        const referralBonus = Math.floor(deposit.amount_usd_cents * 0.20); // 20%
        
        // Credit referrer wallet
        await supabaseAdmin
          .from('wallets')
          .update({
            available_cents: supabaseAdmin.sql`available_cents + ${referralBonus}`,
            total_earned_cents: supabaseAdmin.sql`total_earned_cents + ${referralBonus}`
          })
          .eq('user_id', profile.referrer_id);

        // Create referral transaction
        await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            user_id: profile.referrer_id,
            type: 'referral',
            amount_cents: referralBonus,
            reference_id: deposit.id,
            meta: {
              referred_user_id: deposit.user_id,
              deposit_id: deposit.id,
              level: 1,
              percentage: 20
            }
          });

        // Record referral
        await supabaseAdmin
          .from('referrals')
          .insert({
            referrer_id: profile.referrer_id,
            referred_id: deposit.user_id,
            level: 1,
            bonus_cents: referralBonus,
            deposit_id: deposit.id
          });
      }

      // Mark webhook as processed
      if (webhookEvent) {
        await supabaseAdmin
          .from('webhook_events')
          .update({ processed: true })
          .eq('id', webhookEvent.id);
      }

      console.log('Payment processed successfully:', mchOrderNo);
      return new Response("success");
    }

    // Payment failed or other status
    console.log('Payment not successful:', webhookData.tradeResult);
    return new Response("Payment not successful", { status: 400 });

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});