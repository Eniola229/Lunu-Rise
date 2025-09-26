-- Update the plans to match the new requirements
-- Unlock $120 and $250 packages, lock $500 and $1,200 packages

-- Update $120 plan (unlock it, set earnings to $13.8 daily for 34 days)
UPDATE plans 
SET 
  is_locked = false,
  payout_per_drop_usd = 1380, -- $13.8 in cents
  drops_count = 34,
  total_return_usd = 46920 -- $13.8 * 34 = $469.20 in cents
WHERE deposit_usd = 12000; -- $120 in cents

-- Update $250 plan (unlock it, set earnings to $28.8 daily for 35 days)
UPDATE plans 
SET 
  is_locked = false,
  payout_per_drop_usd = 2880, -- $28.8 in cents
  drops_count = 35,
  total_return_usd = 100800 -- $28.8 * 35 = $1008.00 in cents
WHERE deposit_usd = 25000; -- $250 in cents

-- Insert new $500 plan (locked, set earnings to $60.0 daily for 35 days)
INSERT INTO plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, is_locked, sort_order)
VALUES ('Premium Package', 50000, 6000, 35, 210000, true, 3) -- $500, $60 daily, $2100 total
ON CONFLICT (deposit_usd) DO UPDATE SET
  name = EXCLUDED.name,
  payout_per_drop_usd = EXCLUDED.payout_per_drop_usd,
  drops_count = EXCLUDED.drops_count,
  total_return_usd = EXCLUDED.total_return_usd,
  is_locked = EXCLUDED.is_locked,
  sort_order = EXCLUDED.sort_order;

-- Insert new $1,200 plan (locked, set earnings to $144 daily for 35 days)
INSERT INTO plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, is_locked, sort_order)
VALUES ('Elite Package', 120000, 14400, 35, 504000, true, 4) -- $1200, $144 daily, $5040 total
ON CONFLICT (deposit_usd) DO UPDATE SET
  name = EXCLUDED.name,
  payout_per_drop_usd = EXCLUDED.payout_per_drop_usd,
  drops_count = EXCLUDED.drops_count,
  total_return_usd = EXCLUDED.total_return_usd,
  is_locked = EXCLUDED.is_locked,
  sort_order = EXCLUDED.sort_order;