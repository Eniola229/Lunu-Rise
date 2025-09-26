import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ActiveDeposit {
  id: string;
  plan_name: string;
  amount_usd_cents: number;
  created_at: string;
  remaining_drops: number;
  total_drops: number;
  payout_per_drop_usd: number;
}

interface ActiveDepositsProps {
  userId: string;
}

const ActiveDeposits = ({ userId }: ActiveDepositsProps) => {
  const [deposits, setDeposits] = useState<ActiveDeposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      loadActiveDeposits();
    }
  }, [userId]);

  const loadActiveDeposits = async () => {
    try {
      // Get active deposits with plan information
      const { data: depositsData, error: depositsError } = await supabase
        .from('deposits')
        .select(`
          id,
          amount_usd_cents,
          created_at,
          plans!inner(
            name,
            payout_per_drop_usd,
            drops_count
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'confirmed');

      if (depositsError) throw depositsError;

      // Get income events to calculate remaining drops
      const activeDepositsWithRemaining = await Promise.all(
        (depositsData || []).map(async (deposit: any) => {
          const { data: incomeEvents } = await supabase
            .from('income_events')
            .select('processed_bool')
            .eq('deposit_id', deposit.id);

          const processedCount = incomeEvents?.filter(event => event.processed_bool).length || 0;
          const remainingDrops = deposit.plans.drops_count - processedCount;

          return {
            id: deposit.id,
            plan_name: deposit.plans.name,
            amount_usd_cents: deposit.amount_usd_cents,
            created_at: deposit.created_at,
            remaining_drops: remainingDrops,
            total_drops: deposit.plans.drops_count,
            payout_per_drop_usd: deposit.plans.payout_per_drop_usd,
          };
        })
      );

      // Filter only deposits with remaining drops
      const activeOnly = activeDepositsWithRemaining.filter(deposit => deposit.remaining_drops > 0);
      setDeposits(activeOnly);
    } catch (error) {
      console.error('Error loading active deposits:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  if (loading) {
    return <div className="text-center py-4">Loading active deposits...</div>;
  }

  if (deposits.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No active deposits. Start investing to see your active plans here!
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {deposits.map((deposit) => (
        <Card key={deposit.id} className="border border-muted">
          <CardContent className="p-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-card-foreground">{deposit.plan_name}</h4>
                <p className="text-sm text-muted-foreground">
                  {deposit.remaining_drops} of {deposit.total_drops} drops remaining
                </p>
              </div>
              <Badge variant="default" className="bg-success/10 text-success border-success/20">
                Active
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-muted-foreground">Investment: </span>
                <span className="font-medium">{formatUSD(deposit.amount_usd_cents)}</span>
              </div>
              <div className="text-right">
                <div className="text-success font-medium">
                  {formatUSD(deposit.payout_per_drop_usd)}/drop
                </div>
                <div className="text-xs text-muted-foreground">Daily</div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ActiveDeposits;