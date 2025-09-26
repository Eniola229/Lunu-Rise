import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Utility function to create MD5 signature for Basepay
function createSign(params: Record<string, any>, secretKey: string): string {
  const entries = Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined && k !== 'sign' && k !== 'sign_type')
    .sort((a, b) => a[0].localeCompare(b[0], 'en'));
  
  const query = entries.map(([k, v]) => `${k}=${v}`).join('&') + `&key=${secretKey}`;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(query);
  return crypto.subtle.digest('MD5', data).then(hashBuffer => {
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
  });
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

    // Parse form data
    const formData = await req.formData();
    const payload: Record<string, string> = {};
    
    for (const [key, value] of formData.entries()) {
      payload[key] = value.toString();
    }

    // Log all webhook attempts
    await supabaseAdmin
      .from('webhook_events')
      .insert({
        gateway: 'basepay',
        payload: {
          type: 'payment_callback',
          data: payload,
          timestamp: new Date().toISOString()
        },
        source_ip: clientIP,
        processed: false
      });

    // Verify IP whitelist
    const allowedIPs = Deno.env.get("CALLBACK_ALLOWED_IPS")?.split(',') || [];
    const isIPAllowed = allowedIPs.includes(clientIP) || clientIP === "unknown"; // Allow unknown for testing

    if (!isIPAllowed) {
      console.warn(`Webhook from unauthorized IP: ${clientIP}`);
    }

    // Verify signature
    const receivedSign = payload.sign;
    const basepayCollectionKey = Deno.env.get("BASEPAY_COLLECTION_KEY");
    
    if (!basepayCollectionKey) {
      throw new Error("Basepay collection key not configured");
    }

    const expectedSign = await createSign(payload, basepayCollectionKey);
    const signatureValid = receivedSign === expectedSign;

    // Check if payment was successful
    const tradeResult = payload.tradeResult;
    const mchOrderNo = payload.mchOrderNo || payload.mch_order_no;
    const orderNo = payload.orderNo;

    if (signatureValid && tradeResult === '1' && mchOrderNo) {
      // Find the deposit
      const { data: deposit, error: depositError } = await supabaseAdmin
        .from('deposits')
        .select('*')
        .eq('mch_order_no', mchOrderNo)
        .single();

      if (depositError || !deposit) {
        console.error('Deposit not found for mchOrderNo:', mchOrderNo);
        return new Response("Deposit not found", { status: 400 });
      }

      // Check if already processed (idempotency)
      if (deposit.status === 'confirmed') {
        console.log('Deposit already processed:', mchOrderNo);
        return new Response("success", { status: 200 });
      }

      try {
        // Update deposit status
        const { error: updateError } = await supabaseAdmin
          .from('deposits')
          .update({
            status: 'confirmed',
            order_no: orderNo,
            gateway_ref: orderNo,
            confirmed_at: new Date().toISOString()
          })
          .eq('id', deposit.id);

        if (updateError) throw updateError;

        // Get user's wallet
        const { data: wallet, error: walletError } = await supabaseAdmin
          .from('wallets')
          .select('*')
          .eq('user_id', deposit.user_id)
          .single();

        if (walletError) throw walletError;

        // Update wallet balances
        const newAvailable = wallet.available_cents + deposit.amount_usd_cents;
        const newTotalEarned = wallet.total_earned_cents + deposit.amount_usd_cents;

        const { error: walletUpdateError } = await supabaseAdmin
          .from('wallets')
          .update({
            available_cents: newAvailable,
            total_earned_cents: newTotalEarned
          })
          .eq('user_id', deposit.user_id);

        if (walletUpdateError) throw walletUpdateError;

        // Create wallet transaction
        const { error: transactionError } = await supabaseAdmin
          .from('wallet_transactions')
          .insert({
            user_id: deposit.user_id,
            type: 'deposit',
            amount_cents: deposit.amount_usd_cents,
            balance_after_cents: newAvailable,
            reference_id: deposit.id,
            meta: {
              description: 'Deposit confirmed via Basepay',
              mch_order_no: mchOrderNo,
              order_no: orderNo,
              gateway: 'basepay'
            }
          });

        if (transactionError) throw transactionError;

        // Schedule first income event (22 hours from now)
        const firstDropTime = new Date();
        firstDropTime.setHours(firstDropTime.getHours() + 22);

        // Get plan details for income calculation
        const { data: plan } = await supabaseAdmin
          .from('plans')
          .select('payout_per_drop_usd, drops_count')
          .eq('id', deposit.plan_id)
          .single();

        if (plan) {
          const { error: incomeError } = await supabaseAdmin
            .from('income_events')
            .insert({
              deposit_id: deposit.id,
              user_id: deposit.user_id,
              amount_cents: plan.payout_per_drop_usd,
              drop_number: 1,
              due_at: firstDropTime.toISOString(),
              status: 'pending'
            });

          if (incomeError) {
            console.error('Failed to schedule income event:', incomeError);
          }
        }

        // Update webhook event as processed
        await supabaseAdmin
          .from('webhook_events')
          .update({
            signature_ok: true,
            processed: true
          })
          .eq('payload->data->mchOrderNo', mchOrderNo)
          .eq('processed', false);

        console.log('Payment processed successfully:', mchOrderNo);
        return new Response("success", { status: 200 });

      } catch (error) {
        console.error('Error processing payment:', error);
        return new Response("Processing error", { status: 500 });
      }

    } else {
      // Invalid signature or failed payment
      await supabaseAdmin
        .from('webhook_events')
        .update({
          signature_ok: signatureValid,
          processed: true
        })
        .eq('payload->data->mchOrderNo', mchOrderNo)
        .eq('processed', false);

      const reason = !signatureValid ? 'Invalid signature' : 'Payment failed';
      console.warn(`Webhook rejected: ${reason}`, payload);
      
      return new Response(reason, { status: 400 });
    }

  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response("Internal error", { status: 500 });
  }
});