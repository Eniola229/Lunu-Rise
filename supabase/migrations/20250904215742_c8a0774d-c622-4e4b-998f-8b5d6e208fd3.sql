-- Update plans with new lock status and earnings
UPDATE plans SET
  is_locked = false,
  payout_per_drop_usd = 138,  -- $1.38 daily
  total_return_usd = 13800    -- Updated total return for $120 plan
WHERE deposit_usd = 12000;    -- $120 plan

UPDATE plans SET
  is_locked = false,
  payout_per_drop_usd = 288,  -- $2.88 daily
  total_return_usd = 28800    -- Updated total return for $250 plan
WHERE deposit_usd = 25000;    -- $250 plan

UPDATE plans SET
  is_locked = true,
  payout_per_drop_usd = 600,  -- $6.00 daily
  total_return_usd = 60000    -- Updated total return for $500 plan
WHERE deposit_usd = 50000;    -- $500 plan

UPDATE plans SET
  is_locked = true,
  payout_per_drop_usd = 1440, -- $14.40 daily
  total_return_usd = 144000   -- Updated total return for $1,200 plan
WHERE deposit_usd = 120000;   -- $1,200 plan