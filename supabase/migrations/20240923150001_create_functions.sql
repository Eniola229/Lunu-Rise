-- Function to handle successful payments
CREATE OR REPLACE FUNCTION public.handle_successful_payment(
  p_payment_intent_id TEXT,
  p_wallet_id UUID,
  p_user_id UUID,
  p_amount BIGINT,
  p_currency VARCHAR(3)
) RETURNS VOID AS $$
DECLARE
  v_wallet_balance BIGINT;
  v_payment_exists BOOLEAN;
BEGIN
  -- Check if this payment has already been processed
  SELECT EXISTS (
    SELECT 1 
    FROM public.wallet_transactions 
    WHERE reference_id = p_payment_intent_id 
    AND type = 'deposit'
  ) INTO v_payment_exists;
  
  IF v_payment_exists THEN
    RAISE NOTICE 'Payment % already processed', p_payment_intent_id;
    RETURN;
  END IF;

  -- Update wallet balance
  UPDATE public.wallets
  SET 
    available_cents = available_cents + p_amount,
    total_earned_cents = total_earned_cents + p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id
  RETURNING available_cents INTO v_wallet_balance;

  -- Record the transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    status,
    reference_id,
    description,
    meta
  ) VALUES (
    p_user_id,
    p_wallet_id,
    'deposit',
    p_amount,
    'completed',
    p_payment_intent_id,
    'Wallet top-up via Stripe',
    jsonb_build_object('currency', p_currency, 'source', 'stripe')
  );

  -- Update the payment intent status
  UPDATE public.stripe_payment_intents
  SET 
    status = 'succeeded',
    updated_at = NOW()
  WHERE id = p_payment_intent_id;

  -- Log the successful transaction
  RAISE NOTICE 'Successfully processed payment % for user %', p_payment_intent_id, p_user_id;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error
    RAISE EXCEPTION 'Error processing payment %: %', p_payment_intent_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process refunds
CREATE OR REPLACE FUNCTION public.process_refund(
  p_payment_intent_id TEXT,
  p_wallet_id UUID,
  p_user_id UUID,
  p_amount BIGINT
) RETURNS VOID AS $$
BEGIN
  -- Check if this refund has already been processed
  IF EXISTS (
    SELECT 1 
    FROM public.wallet_transactions 
    WHERE reference_id = p_payment_intent_id 
    AND type = 'refund'
  ) THEN
    RAISE NOTICE 'Refund for payment % already processed', p_payment_intent_id;
    RETURN;
  END IF;

  -- Update wallet balance (deduct the refunded amount)
  UPDATE public.wallets
  SET 
    available_cents = available_cents - p_amount,
    updated_at = NOW()
  WHERE id = p_wallet_id
  AND available_cents >= p_amount;

  -- Record the refund transaction
  INSERT INTO public.wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    status,
    reference_id,
    description,
    meta
  ) VALUES (
    p_user_id,
    p_wallet_id,
    'refund',
    p_amount,
    'completed',
    p_payment_intent_id,
    'Refund processed',
    jsonb_build_object('source', 'stripe')
  );

  -- Update the payment intent status
  UPDATE public.stripe_payment_intents
  SET 
    status = 'refunded',
    updated_at = NOW()
  WHERE id = p_payment_intent_id;

  RAISE NOTICE 'Successfully processed refund for payment %', p_payment_intent_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error processing refund for payment %: %', p_payment_intent_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create a payment intent
CREATE OR REPLACE FUNCTION public.create_payment_intent(
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_currency VARCHAR(3) DEFAULT 'USD',
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS JSONB AS $$
DECLARE
  v_wallet_id UUID;
  v_customer_id TEXT;
  v_payment_intent_id TEXT;
  v_client_secret TEXT;
  v_result JSONB;
BEGIN
  -- Get the user's wallet and Stripe customer ID
  SELECT id, stripe_customer_id
  INTO v_wallet_id, v_customer_id
  FROM public.wallets
  WHERE user_id = p_user_id
  FOR UPDATE; -- Lock the row to prevent race conditions

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet not found for user %', p_user_id;
  END IF;

  -- Create a payment intent in Stripe
  SELECT * FROM
  (
    SELECT 
      id,
      client_secret
    FROM stripe.create_payment_intent(
      p_amount_cents,
      p_currency,
      v_customer_id,
      jsonb_build_object(
        'userId', p_user_id::text,
        'walletId', v_wallet_id::text
      ) || p_metadata
    )
  ) INTO v_payment_intent_id, v_client_secret;

  -- Store the payment intent in our database
  INSERT INTO public.stripe_payment_intents (
    id,
    user_id,
    wallet_id,
    amount_cents,
    currency,
    status,
    client_secret,
    metadata
  ) VALUES (
    v_payment_intent_id,
    p_user_id,
    v_wallet_id,
    p_amount_cents,
    p_currency,
    'requires_payment_method',
    v_client_secret,
    p_metadata
  );

  -- Return the client secret and payment intent ID
  RETURN jsonb_build_object(
    'clientSecret', v_client_secret,
    'paymentIntentId', v_payment_intent_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating payment intent: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
