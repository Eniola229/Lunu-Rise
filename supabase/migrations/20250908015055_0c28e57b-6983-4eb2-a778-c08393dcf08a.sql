-- Add two locked plans to the plans table
INSERT INTO public.plans (name, deposit_usd, payout_per_drop_usd, drops_count, total_return_usd, is_locked, sort_order)
VALUES 
('Premium Plus', 50000, 6000, 35, 210000, true, 4),
('Elite Investor', 120000, 14400, 35, 504000, true, 5);