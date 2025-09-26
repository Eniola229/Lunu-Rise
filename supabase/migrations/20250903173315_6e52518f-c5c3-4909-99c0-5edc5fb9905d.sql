-- Update existing plans with new locked status and earnings
UPDATE public.plans 
SET is_locked = true 
WHERE deposit_usd IN (50000, 120000);

-- Update specific plan earnings
UPDATE public.plans 
SET 
  payout_per_drop_usd = 1380,
  total_return_usd = deposit_usd + (1380 * drops_count)
WHERE deposit_usd = 12000;

UPDATE public.plans 
SET 
  payout_per_drop_usd = 2880,
  total_return_usd = deposit_usd + (2880 * drops_count)
WHERE deposit_usd = 25000;

UPDATE public.plans 
SET 
  payout_per_drop_usd = 6000,
  total_return_usd = deposit_usd + (6000 * drops_count)
WHERE deposit_usd = 50000;

UPDATE public.plans 
SET 
  payout_per_drop_usd = 14400,
  total_return_usd = deposit_usd + (14400 * drops_count)
WHERE deposit_usd = 120000;