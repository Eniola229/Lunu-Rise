import { useState, useEffect } from 'react';
import { Lock, TrendingUp, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import PaymentModal from '@/components/PaymentModal';
import { Loader2 } from 'lucide-react';


interface Plan {
  id: string;
  name: string;
  deposit_usd: number;
  payout_per_drop_usd: number;
  drops_count: number;
  total_return_usd: number;
  is_locked: boolean;
  sort_order: number;
}

const Plans = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) throw error;
      
      // Filter out duplicate plans by checking for exact matches of deposit amount
      const uniquePlans = data?.filter((plan, index, self) => {
        // Find first occurrence of a plan with the same deposit amount
        const firstIndex = self.findIndex(p => p.deposit_usd === plan.deposit_usd);
        return firstIndex === index;
      }) || [];
      
      // Sort plans: unlocked first, then locked ones at the bottom
      const sortedPlans = uniquePlans.sort((a, b) => {
        if (a.is_locked && !b.is_locked) return 1;
        if (!a.is_locked && b.is_locked) return -1;
        return a.sort_order - b.sort_order;
      });
      
      setPlans(sortedPlans);
    } catch (error) {
      console.error('Error loading plans:', error);
      toast.error('Failed to load investment plans');
    } finally {
      setLoading(false);
    }
  };

  const formatUSD = (cents: number) => `$${(cents / 100).toFixed(0)}`;
  const formatDecimal = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const getReturnPercentage = (deposit: number, totalReturn: number) => {
    return Math.round(((totalReturn - deposit) / deposit) * 100);
  };

  const handleInvestClick = (plan: Plan) => {
    if (plan.is_locked) {
      toast.info('This plan will be available soon. Get notified when it launches!');
      return;
    }
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handleNotifyMe = (plan: Plan) => {
    toast.success('You will be notified when this plan becomes available!');
  };

  if (loading) {
    return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    </Layout>

    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        <div className="p-6 pt-12">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground mb-2">Investment Plans</h1>
              <div className="bg-info/10 border border-info/20 rounded-lg px-3 py-1">
                <span className="text-sm font-medium text-info">Luno Rise</span>
              </div>
            </div>
            <p className="text-muted-foreground">
              Choose a plan and start earning daily returns on your investment
            </p>

          </div>

          <div className="grid gap-4">
            {plans.map((plan) => {
              const returnPercentage = getReturnPercentage(plan.deposit_usd, plan.total_return_usd);
              const cardColors = [
                'bg-gradient-to-br from-blue-500 to-blue-600',
                'bg-gradient-to-br from-green-500 to-green-600', 
                'bg-gradient-to-br from-purple-500 to-purple-600',
                'bg-gradient-to-br from-orange-500 to-orange-600',
                'bg-gradient-to-br from-pink-500 to-pink-600',
                'bg-gradient-to-br from-indigo-500 to-indigo-600'
              ];
              const cardColor = cardColors[plans.indexOf(plan) % cardColors.length];
              
              return (
                <Card key={plan.id} className={`relative overflow-hidden ${cardColor} text-white border shadow-sm hover:shadow-md transition-all duration-200`}>
                  {plan.is_locked && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="text-xs px-2 py-1 bg-white/20 text-white">
                        Coming Soon
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="pb-4 text-center">
                    <div className="flex flex-col items-center">
                      <CardTitle className="text-lg font-bold text-white">{plan.name}</CardTitle>
                      <Badge variant="outline" className="mt-1 text-xs bg-white/20 text-white border-white/30">
                        +{returnPercentage}% Return
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0 space-y-4">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="text-center">
                        <p className="text-xs text-white/70 mb-1">Deposit Amount</p>
                        <p className="text-xl font-bold text-white">
                          {formatUSD(plan.deposit_usd)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white/70 mb-1">Total Return</p>
                        <p className="text-xl font-bold text-green-300">
                          {formatUSD(plan.total_return_usd)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6 pt-2 border-t border-white/20">
                      <div className="text-center">
                        <p className="text-xs text-white/70 mb-1">Per Drop</p>
                        <p className="text-sm font-semibold text-white">
                          {formatDecimal(plan.payout_per_drop_usd)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-white/70 mb-1">Total Drops</p>
                        <p className="text-sm font-semibold text-white">
                          {plan.drops_count} times
                        </p>
                      </div>
                    </div>

                    <div className="pt-3">
                      {plan.is_locked ? (
                        <Button
                          className="w-full h-11 bg-white/10 text-white border-white/20 hover:bg-white/15"
                          variant="outline"
                          size="default"
                          onClick={() => handleNotifyMe(plan)}
                        >
                          <Bell className="mr-2 h-4 w-4" />
                          Notify Me
                        </Button>
                      ) : (
                        <Button
                          className="w-full h-11 bg-white/20 text-white border-white/30 hover:bg-white/30"
                          variant="outline"
                          size="default"
                          onClick={() => handleInvestClick(plan)}
                        >
                          <TrendingUp className="mr-2 h-4 w-4" />
                          Invest Now
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

        </div>

        {/* Payment Modal */}
        {selectedPlan && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedPlan(null);
            }}
            plan={selectedPlan}
          />
        )}
      </div>
    </Layout>
  );
};

export default Plans;