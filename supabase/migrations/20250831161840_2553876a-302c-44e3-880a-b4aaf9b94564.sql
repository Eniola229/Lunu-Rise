-- Update existing plans with new Luno Rise plan structure
UPDATE plans SET 
  name = 'Starter Plan',
  deposit_usd = 12000, -- $120 in cents
  payout_per_drop_usd = 1380, -- $13.8 in cents
  drops_count = 30,
  total_return_usd = 41400, -- $414 in cents (30 * $13.8)
  is_locked = false,
  sort_order = 1
WHERE name = 'Bronze Plan';

UPDATE plans SET 
  name = 'Growth Plan', 
  deposit_usd = 25000, -- $250 in cents
  payout_per_drop_usd = 2880, -- $28.8 in cents
  drops_count = 30,
  total_return_usd = 86400, -- $864 in cents (30 * $28.8)  
  is_locked = false,
  sort_order = 2
WHERE name = 'Silver Plan';

UPDATE plans SET 
  name = 'Premium Plan',
  deposit_usd = 50000, -- $500 in cents
  payout_per_drop_usd = 6000, -- $60 in cents
  drops_count = 30, 
  total_return_usd = 180000, -- $1800 in cents (30 * $60)
  is_locked = true,
  sort_order = 3
WHERE name = 'Gold Plan';

UPDATE plans SET 
  name = 'Elite Plan',
  deposit_usd = 120000, -- $1200 in cents
  payout_per_drop_usd = 14400, -- $144 in cents
  drops_count = 30,
  total_return_usd = 432000, -- $4320 in cents (30 * $144)
  is_locked = true,
  sort_order = 4
WHERE name = 'Platinum Plan';

-- Add USDT rate conversion table
CREATE TABLE IF NOT EXISTS usdt_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE usdt_rates ENABLE ROW LEVEL SECURITY;

-- Create policy for viewing rates
CREATE POLICY "USDT rates are viewable by everyone" 
ON usdt_rates 
FOR SELECT 
USING (true);

-- Insert initial USDT rate for Naira
INSERT INTO usdt_rates (currency, rate) VALUES ('NGN', 1600);

-- Add phone field to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add balance_after_cents to wallet_transactions if not exists  
ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS balance_after_cents INTEGER;