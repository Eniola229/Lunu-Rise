-- Update plans with new earnings and lock status
UPDATE public.plans 
SET 
  payout_per_drop_usd = 1380, -- $13.80 daily 
  drops_count = 34,
  total_return_usd = 46920, -- $13.80 * 34 days = $469.20
  is_locked = false
WHERE deposit_usd = 12000; -- $120 plan

UPDATE public.plans 
SET 
  payout_per_drop_usd = 2880, -- $28.80 daily
  drops_count = 35, 
  total_return_usd = 100800, -- $28.80 * 35 days = $1008.00
  is_locked = false
WHERE deposit_usd = 25000; -- $250 plan

UPDATE public.plans 
SET 
  payout_per_drop_usd = 6000, -- $60.00 daily
  drops_count = 35,
  total_return_usd = 210000, -- $60.00 * 35 days = $2100.00  
  is_locked = true
WHERE deposit_usd = 50000; -- $500 plan

UPDATE public.plans 
SET 
  payout_per_drop_usd = 14400, -- $144.00 daily
  drops_count = 35,
  total_return_usd = 504000, -- $144.00 * 35 days = $5040.00
  is_locked = true  
WHERE deposit_usd = 120000; -- $1200 plan