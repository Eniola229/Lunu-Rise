-- Core user profiles table
CREATE TABLE public.profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  country TEXT,
  avatar_url TEXT,
  referral_code TEXT UNIQUE,
  referrer_id UUID REFERENCES public.profiles(id),
  auto_withdraw_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Wallets table (all amounts in USD cents)
CREATE TABLE public.wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE UNIQUE NOT NULL,
  available_cents INTEGER DEFAULT 100, -- $1 welcome bonus
  pending_cents INTEGER DEFAULT 0,
  total_earned_cents INTEGER DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Investment plans
CREATE TABLE public.plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  deposit_usd INTEGER NOT NULL, -- USD cents
  payout_per_drop_usd INTEGER NOT NULL, -- USD cents
  drops_count INTEGER NOT NULL,
  total_return_usd INTEGER NOT NULL, -- USD cents
  is_locked BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Conversion rates for local currencies
CREATE TABLE public.conversion_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  country_code TEXT NOT NULL UNIQUE,
  currency TEXT NOT NULL,
  currency_symbol TEXT NOT NULL,
  rate_to_usd DECIMAL(10,4) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Deposits table
CREATE TABLE public.deposits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  plan_id UUID REFERENCES public.plans ON DELETE CASCADE NOT NULL,
  amount_usd_cents INTEGER NOT NULL,
  local_amount_cents INTEGER,
  currency TEXT,
  gateway_ref TEXT,
  method TEXT NOT NULL CHECK (method IN ('base', 'crypto_manual')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  tx_hash TEXT,
  screenshot_url TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Income events (scheduled payouts)
CREATE TABLE public.income_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deposit_id UUID REFERENCES public.deposits ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  processed_bool BOOLEAN DEFAULT false,
  drop_number INTEGER NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Wallet transactions
CREATE TABLE public.wallet_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'income', 'withdrawal', 'referral', 'welcome_bonus')),
  amount_cents INTEGER NOT NULL,
  meta JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Withdrawals
CREATE TABLE public.withdrawals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  amount_cents INTEGER NOT NULL,
  fee_cents INTEGER NOT NULL,
  net_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  retry_count INTEGER DEFAULT 0,
  next_attempt TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Referrals tracking
CREATE TABLE public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  referred_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  level INTEGER NOT NULL,
  bonus_cents INTEGER NOT NULL,
  deposit_id UUID REFERENCES public.deposits ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Gateway logs
CREATE TABLE public.gateway_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  deposit_id UUID REFERENCES public.deposits ON DELETE CASCADE,
  withdrawal_id UUID REFERENCES public.withdrawals ON DELETE CASCADE,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Jobs log for admin monitoring
CREATE TABLE public.jobs_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job TEXT NOT NULL,
  status TEXT NOT NULL,
  payload JSONB,
  processed_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gateway_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for users
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Plans are viewable by everyone" ON public.plans FOR SELECT USING (true);

CREATE POLICY "Conversion rates are viewable by everyone" ON public.conversion_rates FOR SELECT USING (true);

CREATE POLICY "Users can view their own deposits" ON public.deposits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own deposits" ON public.deposits FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own income events" ON public.income_events FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- Admin-only policies (will check for admin role in functions)
CREATE POLICY "Admin access to gateway logs" ON public.gateway_logs FOR ALL USING (false);
CREATE POLICY "Admin access to jobs log" ON public.jobs_log FOR ALL USING (false);

-- Seed plans data
INSERT INTO public.plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, sort_order) VALUES
('Starter Plan', 500, 50, 30, 1500, 1),
('Basic Plan', 1000, 100, 31, 3100, 2),
('Standard Plan', 2500, 250, 32, 8000, 3),
('Premium Plan', 5000, 550, 33, 18150, 4),
('VIP Plan', 12000, 1300, 35, 45500, 5),
('Elite Plan', 25000, 2800, 35, 98000, 6);

-- Update locked status for higher plans
UPDATE public.plans SET is_locked = true WHERE name IN ('VIP Plan', 'Elite Plan');

-- Seed conversion rates
INSERT INTO public.conversion_rates (country_code, currency, currency_symbol, rate_to_usd) VALUES
('NG', 'NGN', '₦', 1650.00),
('KE', 'KES', 'KSh', 145.00),
('UG', 'UGX', 'USh', 3700.00),
('ZA', 'ZAR', 'R', 18.50),
('GH', 'GHS', '₵', 15.20);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function for atomic withdrawal reservation
CREATE OR REPLACE FUNCTION public.reserve_withdrawal(
  p_user_id UUID,
  p_amount INTEGER,
  p_fee INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE public.wallets 
  SET available_cents = available_cents - p_amount,
      pending_cents = pending_cents + p_amount
  WHERE user_id = p_user_id AND available_cents >= p_amount;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient_funds';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;