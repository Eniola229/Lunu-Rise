-- Update the handle_new_user trigger to populate phone and country
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ref_code TEXT;
BEGIN
  -- Generate unique referral code
  ref_code := 'NS' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  
  -- Insert profile with phone and country from metadata
  INSERT INTO public.profiles (user_id, full_name, phone, country, referral_code)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country', 
    ref_code
  );
  
  -- Insert wallet with welcome bonus
  INSERT INTO public.wallets (user_id, available_cents, total_earned_cents)
  VALUES (NEW.id, 100, 100);
  
  -- Insert welcome bonus transaction
  INSERT INTO public.wallet_transactions (user_id, type, amount_cents, meta)
  VALUES (NEW.id, 'welcome_bonus', 100, '{"description": "Welcome bonus"}');
  
  RETURN NEW;
END;
$$;