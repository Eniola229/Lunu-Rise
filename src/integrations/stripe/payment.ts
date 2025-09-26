import { loadStripe, Stripe } from '@stripe/stripe-js';
import { supabase } from '../supabase/client';

let stripePromise: Promise<Stripe | null>;

// Initialize Stripe with your publishable key
export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');
  }
  return stripePromise;
};

// Create a payment intent
interface CreatePaymentIntentParams {
  amount: number; // in cents
  currency?: string;
  metadata?: Record<string, any>;
}

export const createPaymentIntent = async ({
  amount,
  currency = 'usd',
  metadata = {},
}: CreatePaymentIntentParams) => {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-intent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          amount,
          currency,
          metadata,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create payment intent');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw error;
  }
};

// Process the payment
interface ProcessPaymentParams {
  paymentMethodId: string;
  paymentIntentId: string;
  returnUrl?: string;
}

export const processPayment = async ({
  paymentMethodId,
  paymentIntentId,
  returnUrl = `${window.location.origin}/wallet?payment=success`,
}: ProcessPaymentParams) => {
  try {
    const stripe = await getStripe();
    if (!stripe) {
      throw new Error('Stripe failed to initialize');
    }

    // Confirm the payment
    const { error, paymentIntent } = await stripe.confirmCardPayment(paymentIntentId, {
      payment_method: paymentMethodId,
      return_url: returnUrl,
    });

    if (error) {
      console.error('Payment confirmation error:', error);
      throw error;
    }

    return paymentIntent;
  } catch (error) {
    console.error('Error processing payment:', error);
    throw error;
  }
};

// Format amount to display in the UI (e.g., $10.00)
export const formatAmount = (amount: number, currency: string = 'usd') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
};
