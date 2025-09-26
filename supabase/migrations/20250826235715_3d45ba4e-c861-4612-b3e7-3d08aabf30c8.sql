-- Fix security warnings by adding search_path to functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
BEGIN
  -- Generate unique referral code
  ref_code := 'NS' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, referral_code)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', ref_code);
  
  -- Insert wallet with welcome bonus
  INSERT INTO public.wallets (user_id, available_cents, total_earned_cents)
  VALUES (NEW.id, 100, 100);
  
  -- Insert welcome bonus transaction
  INSERT INTO public.wallet_transactions (user_id, type, amount_cents, meta)
  VALUES (NEW.id, 'welcome_bonus', 100, '{"description": "Welcome bonus"}');
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_withdrawal(
  p_user_id UUID,
  p_amount INTEGER,
  p_fee INTEGER
) RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.wallets 
  SET available_cents = available_cents - p_amount,
      pending_cents = pending_cents + p_amount
  WHERE user_id = p_user_id AND available_cents >= p_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;
END;
$$;