-- Add missing columns and ensure proper structure for Basepay integration (corrected)

-- Update deposits table to include all required fields
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS local_amount DECIMAL(15,2);
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS local_currency TEXT DEFAULT 'USD';
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(10,6);
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS fx_at TIMESTAMPTZ;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS mch_order_no TEXT;
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'basepay';
ALTER TABLE deposits ADD COLUMN IF NOT EXISTS gateway_ref TEXT;

-- Update withdrawals table for FX support
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS local_amount DECIMAL(15,2);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS local_currency TEXT DEFAULT 'USD';
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS fx_rate DECIMAL(10,6);
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS fx_at TIMESTAMPTZ;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS payment_ref TEXT;

-- Ensure profiles has referral_code
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deposits_mch_order_no ON deposits(mch_order_no);
CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_income_events_due_at ON income_events(due_at);
CREATE INDEX IF NOT EXISTS idx_income_events_user_id ON income_events(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code);

-- Ensure webhook_events table has required structure (without conflicting renames)
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS gateway TEXT DEFAULT 'basepay';
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS signature_ok BOOLEAN DEFAULT false;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS source_ip TEXT;
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT false;

-- Ensure proper data types for money amounts (cents)
ALTER TABLE deposits ALTER COLUMN amount_usd_cents TYPE BIGINT;
ALTER TABLE income_events ALTER COLUMN amount_cents TYPE BIGINT;
ALTER TABLE wallet_transactions ALTER COLUMN amount_cents TYPE BIGINT;
ALTER TABLE wallets ALTER COLUMN available_cents TYPE BIGINT;
ALTER TABLE wallets ALTER COLUMN pending_cents TYPE BIGINT;
ALTER TABLE wallets ALTER COLUMN total_earned_cents TYPE BIGINT;
ALTER TABLE withdrawals ALTER COLUMN amount_cents TYPE BIGINT;
ALTER TABLE withdrawals ALTER COLUMN fee_cents TYPE BIGINT;
ALTER TABLE withdrawals ALTER COLUMN net_cents TYPE BIGINT;