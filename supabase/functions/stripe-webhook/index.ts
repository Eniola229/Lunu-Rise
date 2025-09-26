/// <reference no-default-lib="true" />
/// <reference lib="deno.window" />

import { serve } from 'std/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Stripe with your secret key
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2023-10-16',
  httpClient: Stripe.createFetchHttpClient(),
});

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// This is the webhook handler for Stripe events
serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get the signature from the headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      throw new Error('No signature found in headers');
    }

    // Get the raw body
    const body = await req.text();
    
    // Verify the webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, amount, currency, metadata } = paymentIntent;
  const userId = metadata?.userId;
  
  if (!userId) {
    console.error('No userId in payment intent metadata');
    return;
  }

  // Get the wallet for this user
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('id, user_id, available_cents')
    .eq('user_id', userId)
    .single();

  if (walletError || !wallet) {
    console.error('Error fetching wallet:', walletError);
    return;
  }

  // Start a transaction
  const { error: transactionError } = await supabase.rpc('handle_successful_payment', {
    p_payment_intent_id: paymentIntentId,
    p_wallet_id: wallet.id,
    p_user_id: userId,
    p_amount: amount,
    p_currency: currency
  });

  if (transactionError) {
    console.error('Error processing payment:', transactionError);
    throw transactionError;
  }
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { id: paymentIntentId, last_payment_error } = paymentIntent;
  
  // Update the payment intent status in the database
  const { error } = await supabase
    .from('stripe_payment_intents')
    .update({
      status: 'failed',
      metadata: { error: last_payment_error?.message || 'Payment failed' }
    })
    .eq('id', paymentIntentId);

  if (error) {
    console.error('Error updating failed payment intent:', error);
  }
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const { payment_intent: paymentIntentId, amount_refunded } = charge;
  
  if (typeof paymentIntentId !== 'string') return;
  
  // Update the payment intent status in the database
  const { data: paymentIntent, error: fetchError } = await supabase
    .from('stripe_payment_intents')
    .select('id, user_id, wallet_id, amount_cents')
    .eq('id', paymentIntentId)
    .single();

  if (fetchError || !paymentIntent) {
    console.error('Error fetching payment intent:', fetchError);
    return;
  }

  // Process the refund in the wallet
  const { error: refundError } = await supabase.rpc('process_refund', {
    p_payment_intent_id: paymentIntentId,
    p_wallet_id: paymentIntent.wallet_id,
    p_user_id: paymentIntent.user_id,
    p_amount: amount_refunded
  });

  if (refundError) {
    console.error('Error processing refund:', refundError);
  }
}
