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
-- Only insert if it doesn't exist
INSERT INTO plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, is_locked, sort_order)
SELECT 'Premium Package', 50000, 6000, 35, 210000, true, 3
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE deposit_usd = 50000);

-- Insert new $1,200 plan (locked, set earnings to $144 daily for 35 days)
-- Only insert if it doesn't exist
INSERT INTO plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, is_locked, sort_order)
SELECT 'Elite Package', 120000, 14400, 35, 504000, true, 4
WHERE NOT EXISTS (SELECT 1 FROM plans WHERE deposit_usd = 120000);