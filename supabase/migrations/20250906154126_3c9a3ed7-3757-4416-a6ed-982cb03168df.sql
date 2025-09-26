-- Update referral system to handle 20% bonus on deposits
-- Add referral bonus tracking
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS bonus_percentage integer DEFAULT 20;

-- Create trigger function for referral bonuses when deposits are confirmed
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
        meta
      ) VALUES (
        referrer_user_id,
        'referral',
        bonus_amount_cents,
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

-- Create trigger on deposits table
DROP TRIGGER IF EXISTS referral_bonus_trigger ON deposits;
CREATE TRIGGER referral_bonus_trigger
  AFTER UPDATE ON deposits
  FOR EACH ROW
  EXECUTE FUNCTION process_referral_bonus();