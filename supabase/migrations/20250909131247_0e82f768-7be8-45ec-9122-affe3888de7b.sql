-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create referral system and crypto deposits tables
CREATE TABLE IF NOT EXISTS public.crypto_deposits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan_id uuid REFERENCES public.plans(id),
  currency text NOT NULL DEFAULT 'USDT',
  amount_crypto numeric,
  amount_usd_cents bigint,
  tx_hash text NOT NULL,
  proof_path text,
  status text NOT NULL DEFAULT 'pending',
  admin_id uuid REFERENCES auth.users(id),
  admin_note text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Update profiles table to ensure referrer tracking
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referrer_id uuid REFERENCES auth.users(id);

-- Create enhanced wallet transactions for referral tracking
ALTER TABLE public.wallet_transactions 
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS balance_after_cents bigint;

-- Create audit logs table for admin actions
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) NOT NULL,
  action text NOT NULL,
  target_table text,
  target_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create payment gateways table for Basepay integration
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL,
  currency text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for crypto proof images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('crypto-proofs', 'crypto-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Enhanced RLS policies for crypto_deposits
ALTER TABLE public.crypto_deposits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own crypto deposits" 
ON public.crypto_deposits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own crypto deposits" 
ON public.crypto_deposits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admin policies for crypto_deposits
CREATE POLICY "Admins can view all crypto deposits" 
ON public.crypto_deposits 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (profiles.phone = 'admin@example.com' OR profiles.country = 'ADMIN')
  )
);

-- RLS for audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audit logs" 
ON public.audit_logs 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (profiles.phone = 'admin@example.com' OR profiles.country = 'ADMIN')
  )
);

-- Storage policies for crypto-proofs bucket
CREATE POLICY "Users can upload their own crypto proofs" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'crypto-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their own crypto proofs" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'crypto-proofs' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all crypto proofs" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'crypto-proofs' 
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND (profiles.phone = 'admin@example.com' OR profiles.country = 'ADMIN')
  )
);

-- Update existing handle_new_user function to handle referrals
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ref_code TEXT;
  referrer_user_id UUID;
BEGIN
  -- Generate unique referral code
  ref_code := 'NS' || UPPER(SUBSTRING(REPLACE(NEW.id::text, '-', ''), 1, 8));
  
  -- Check if there's a referrer from metadata
  IF NEW.raw_user_meta_data->>'referrer_code' IS NOT NULL THEN
    SELECT user_id INTO referrer_user_id 
    FROM public.profiles 
    WHERE referral_code = NEW.raw_user_meta_data->>'referrer_code';
  END IF;
  
  -- Insert profile with referrer tracking
  INSERT INTO public.profiles (user_id, full_name, phone, country, referral_code, referrer_id)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'country', 
    ref_code,
    referrer_user_id
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

-- Enhanced referral bonus processing function
CREATE OR REPLACE FUNCTION public.process_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referrer_user_id uuid;
  bonus_amount_cents integer;
BEGIN
  -- Only process when deposit status changes to 'confirmed'
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status != 'confirmed') THEN
    -- Find if the user who made the deposit was referred by someone
    SELECT profiles.referrer_id INTO referrer_user_id
    FROM profiles 
    WHERE profiles.user_id = NEW.user_id;
    
    -- If there's a referrer, give them 20% bonus
    IF referrer_user_id IS NOT NULL THEN
      bonus_amount_cents := (NEW.amount_usd_cents * 20) / 100; -- 20% of deposit
      
      -- Add bonus to referrer's wallet
      UPDATE wallets 
      SET available_cents = available_cents + bonus_amount_cents,
          total_earned_cents = total_earned_cents + bonus_amount_cents
      WHERE user_id = referrer_user_id;
      
      -- Record referral bonus transaction
      INSERT INTO wallet_transactions (
        user_id,
        type,
        amount_cents,
        reference_id,
        meta
      ) VALUES (
        referrer_user_id,
        'referral',
        bonus_amount_cents,
        NEW.id,
        jsonb_build_object(
          'description', 'Referral bonus (20%)',
          'referred_user_id', NEW.user_id,
          'deposit_id', NEW.id,
          'deposit_amount', NEW.amount_usd_cents
        )
      );
      
      -- Record the referral bonus
      INSERT INTO referrals (
        referrer_id,
        referred_id,
        level,
        bonus_cents,
        deposit_id
      ) VALUES (
        referrer_user_id,
        NEW.user_id,
        1,
        bonus_amount_cents,
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for referral bonus processing
DROP TRIGGER IF EXISTS process_referral_bonus_trigger ON public.deposits;
CREATE TRIGGER process_referral_bonus_trigger
  AFTER UPDATE ON public.deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.process_referral_bonus();

-- Insert sample payment gateway configurations
INSERT INTO public.payment_gateways (name, country_code, currency, config) VALUES
('Basepay Nigeria', 'NG', 'NGN', '{"bank_code": "NGR044", "pay_type": "523"}'),
('Basepay Ghana', 'GH', 'GHS', '{"bank_code": "GHA001", "pay_type": "524"}')
ON CONFLICT DO NOTHING;

-- Update timestamps function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers
CREATE TRIGGER update_crypto_deposits_updated_at
  BEFORE UPDATE ON public.crypto_deposits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();