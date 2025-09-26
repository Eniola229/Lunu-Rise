-- Create payment gateways table
CREATE TABLE public.payment_gateways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  currency TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.payment_gateways ENABLE ROW LEVEL SECURITY;

-- Admin only access to gateways
CREATE POLICY "Only admins can manage gateways" 
ON public.payment_gateways 
FOR ALL 
USING (false);

-- Create exchange rates table (replace conversion_rates)
CREATE TABLE public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  rate_to_usd NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Exchange rates viewable by everyone
CREATE POLICY "Exchange rates are viewable by everyone" 
ON public.exchange_rates 
FOR SELECT 
USING (true);

-- Insert initial exchange rates
INSERT INTO public.exchange_rates (country_code, currency, currency_symbol, rate_to_usd) VALUES
('NG', 'NGN', '₦', 1600),
('GH', 'GHS', '₵', 15.5),
('KE', 'KES', 'KSh', 129),
('UG', 'UGX', 'USh', 3700),
('ZA', 'ZAR', 'R', 18.2);

-- Insert Naira gateway for Nigeria
INSERT INTO public.payment_gateways (name, country_code, currency, config) VALUES
('Nigeria Gateway', 'NG', 'NGN', '{"webhook_url": "/api/webhooks/gateway", "currency_symbol": "₦"}');

-- Create webhook_events table for idempotency
CREATE TABLE public.webhook_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  gateway_name TEXT NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payload JSONB NOT NULL
);

-- Enable RLS
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- Admin only access
CREATE POLICY "Admin access to webhook events" 
ON public.webhook_events 
FOR ALL 
USING (false);

-- Update deposits table with local currency fields
ALTER TABLE public.deposits 
ADD COLUMN local_amount_cents INTEGER,
ADD COLUMN local_currency TEXT,
ADD COLUMN client_ref TEXT,
ADD COLUMN gateway_ref TEXT;

-- Add trigger for updated_at on payment_gateways
CREATE TRIGGER update_payment_gateways_updated_at
BEFORE UPDATE ON public.payment_gateways
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for updated_at on exchange_rates  
CREATE TRIGGER update_exchange_rates_updated_at
BEFORE UPDATE ON public.exchange_rates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();