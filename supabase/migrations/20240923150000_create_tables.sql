-- Enable the pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Wallets table to store user wallet information
CREATE TABLE IF NOT EXISTS public.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    available_cents BIGINT NOT NULL DEFAULT 0,
    pending_cents BIGINT NOT NULL DEFAULT 0,
    total_earned_cents BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_available_cents CHECK (available_cents >= 0),
    CONSTRAINT positive_pending_cents CHECK (pending_cents >= 0),
    CONSTRAINT positive_total_earned_cents CHECK (total_earned_cents >= 0)
);

-- Wallet transactions table to track all wallet activities
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    amount_cents BIGINT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'completed',
    reference_id TEXT,
    description TEXT,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_amount_cents CHECK (amount_cents > 0)
);

-- Stripe payment intents table
CREATE TABLE IF NOT EXISTS public.stripe_payment_intents (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
    amount_cents BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    client_secret TEXT,
    payment_method_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT positive_amount_cents CHECK (amount_cents > 0)
);

-- Function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for wallets table
CREATE TRIGGER update_wallets_updated_at
BEFORE UPDATE ON public.wallets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for stripe_payment_intents table
CREATE TRIGGER update_stripe_payment_intents_updated_at
BEFORE UPDATE ON public.stripe_payment_intents
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id ON public.wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet_id ON public.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created_at ON public.wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_user_id ON public.stripe_payment_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_wallet_id ON public.stripe_payment_intents(wallet_id);

-- Set up Row Level Security (RLS) policies
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_payment_intents ENABLE ROW LEVEL SECURITY;

-- Wallets policies
CREATE POLICY "Users can view their own wallets"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallets"
    ON public.wallets FOR UPDATE
    USING (auth.uid() = user_id);

-- Wallet transactions policies
CREATE POLICY "Users can view their own transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions"
    ON public.wallet_transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Stripe payment intents policies
CREATE POLICY "Users can view their own payment intents"
    ON public.stripe_payment_intents FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment intents"
    ON public.stripe_payment_intents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Function to create a wallet for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.wallets (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create a wallet when a new user signs up
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
