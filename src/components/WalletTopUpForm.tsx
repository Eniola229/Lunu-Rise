import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { createPaymentIntent, formatAmount } from '@/integrations/stripe/payment';
import { supabase } from '@/integrations/supabase/client';

// Stripe Elements options
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const CARD_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

const CheckoutForm = ({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) => {
  const [amount, setAmount] = useState<number>(1000); // Default to $10.00
  const [isProcessing, setIsProcessing] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    // Create payment intent when component mounts or amount changes
    const createIntent = async () => {
      try {
        setIsProcessing(true);
        setError(null);
        
        const { clientSecret } = await createPaymentIntent({
          amount,
          currency: 'usd',
          metadata: {
            type: 'wallet_topup',
          },
        });
        
        setClientSecret(clientSecret);
      } catch (err) {
        console.error('Error creating payment intent:', err);
        toast({
          title: 'Error',
          description: 'Failed to initialize payment. Please try again.',
          variant: 'destructive',
        });
        setError('Failed to initialize payment');
      } finally {
        setIsProcessing(false);
      }
    };

    createIntent();
  }, [amount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        },
      });

      if (stripeError) {
        console.error('Payment error:', stripeError);
        setError(stripeError.message || 'Payment failed');
        return;
      }

      if (paymentIntent.status === 'succeeded') {
        toast({
          title: 'Success',
          description: 'Payment successful! Your wallet has been credited.',
        });
        onSuccess();
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const presetAmounts = [500, 1000, 2000, 5000, 10000]; // $5, $10, $20, $50, $100

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount (USD)</Label>
        <div className="flex flex-wrap gap-2 mb-4">
          {presetAmounts.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant={amount === preset ? 'default' : 'outline'}
              onClick={() => setAmount(preset)}
              className="flex-1"
            >
              ${preset / 100}
            </Button>
          ))}
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
          <Input
            id="amount"
            type="number"
            min="1"
            step="0.01"
            value={amount / 100}
            onChange={(e) => setAmount(Math.round(Number(e.target.value) * 100))}
            className="pl-8"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Card Details</Label>
        <div className="p-3 border rounded-md">
          <CardElement options={CARD_OPTIONS} />
        </div>
      </div>

      {error && (
        <div className="text-red-500 text-sm">{error}</div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isProcessing || !clientSecret}
          className="w-32"
        >
          {isProcessing ? 'Processing...' : `Pay ${formatAmount(amount)}`}
        </Button>
      </div>
    </form>
  );
};

interface WalletTopUpFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const WalletTopUpForm = ({ onSuccess = () => {}, onCancel = () => {} }: WalletTopUpFormProps) => {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm onSuccess={onSuccess} onCancel={onCancel} />
    </Elements>
  );
};

export default WalletTopUpForm;
