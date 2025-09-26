-- Ensure referral_code is unique in profiles table
ALTER TABLE public.profiles ADD CONSTRAINT profiles_referral_code_unique UNIQUE (referral_code);

-- Add missing columns to deposits table for FX rates
ALTER TABLE public.deposits 
ADD COLUMN IF NOT EXISTS fx_rate numeric,
ADD COLUMN IF NOT EXISTS local_amount numeric,
ADD COLUMN IF NOT EXISTS local_currency text DEFAULT 'USD';

-- Create conversion_rates table for live currency conversion
CREATE TABLE IF NOT EXISTS public.conversion_rates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency text NOT NULL,
  quote_currency text NOT NULL,
  rate numeric NOT NULL,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on conversion_rates
ALTER TABLE public.conversion_rates ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read conversion rates
CREATE POLICY "Conversion rates are viewable by everyone" 
ON public.conversion_rates 
FOR SELECT 
USING (true);

-- Create payment_gateways table for wallet addresses
CREATE TABLE IF NOT EXISTS public.payment_gateways (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gateway_key text NOT NULL,
  gateway_type text NOT NULL, -- 'local' or 'crypto'
  wallet_address text,
  currency text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payment_gateways
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- Only admins can manage payment gateways
CREATE POLICY "Only admins can manage payment gateways" 
ON public.payment_gateways 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM profiles 
  WHERE profiles.user_id = auth.uid() 
  AND (profiles.phone = 'admin@example.com' OR profiles.country = 'ADMIN')
));

-- Allow everyone to read active payment gateways
CREATE POLICY "Payment gateways are viewable by everyone" 
ON public.payment_gateways 
FOR SELECT 
USING (active = true);

-- Insert default crypto wallet address
INSERT INTO public.payment_gateways (gateway_key, gateway_type, wallet_address, currency, active)
VALUES ('usdt_bep20', 'crypto', '0x34FEcfBE68b7DC59aebdF42373aac8c9DdEcBd83', 'USDT', true)
ON CONFLICT DO NOTHING;

-- Insert sample conversion rates
INSERT INTO public.conversion_rates (base_currency, quote_currency, rate)
VALUES 
  ('USD', 'NGN', 1650.00),
  ('USD', 'KES', 129.50),
  ('USD', 'UGX', 3700.00),
  ('USD', 'ZAR', 18.20),
  ('USD', 'GHS', 15.80)
ON CONFLICT DO NOTHING;