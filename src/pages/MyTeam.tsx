import { useState, useEffect } from 'react';
import { Users, Copy, Share2, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Layout from '@/components/Layout';

interface ReferralData {
  referral_code: string;
  total_referrals: number;
  total_bonus_earned: number;
  referrals: Array<{
    id: string;
    referred_user_name: string;
    referred_user_phone: string;
    bonus_amount: number;
    created_at: string;
    status: string;
  }>;
}

const MyTeam = () => {
  const { user } = useAuth();
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadReferralData();
    }
  }, [user]);

  const loadReferralData = async () => {
    try {
      // Get user's referral code and stats
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Get referral statistics
      const { data: referrals, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          profiles!referrals_referred_id_fkey(full_name, phone)
        `)
        .eq('referrer_id', user?.id)
        .order('created_at', { ascending: false });

      if (referralsError) throw referralsError;

      const totalBonus = referrals?.reduce((sum, ref) => sum + (ref.bonus_cents || 0), 0) || 0;

      setReferralData({
        referral_code: profile.referral_code,
        total_referrals: referrals?.length || 0,
        total_bonus_earned: totalBonus,
        referrals: referrals?.map(ref => ({
          id: ref.id,
          referred_user_name: ref.profiles?.full_name || 'Unknown',
          referred_user_phone: ref.profiles?.phone || 'Unknown',
          bonus_amount: ref.bonus_cents || 0,
          created_at: ref.created_at,
          status: ref.status || 'active'
        })) || []
      });
    } catch (error) {
      console.error('Error loading referral data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const formatUSD = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const copyReferralCode = () => {
    if (referralData?.referral_code) {
      navigator.clipboard.writeText(referralData.referral_code);
      toast.success('Referral code copied to clipboard!');
    }
  };

  const shareReferralLink = () => {
    if (referralData?.referral_code) {
      const referralLink = `${window.location.origin}/auth/register?ref=${referralData.referral_code}`;
      navigator.clipboard.writeText(referralLink);
      toast.success('Referral link copied to clipboard!');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-primary flex items-center justify-center">
          <div className="text-primary-foreground">Loading team data...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-primary text-primary-foreground">
        <div className="p-6 pt-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">My Team</h1>
              <div className="bg-info/10 border border-info/20 rounded-lg px-3 py-1 mt-2 inline-block">
                <span className="text-sm font-medium text-info">Luno Rise</span>
              </div>
            </div>
          </div>

          {/* Referral Stats */}
          <div className="grid gap-4 mb-6">
            <Card className="bg-gradient-success text-success-foreground shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Users className="mr-2 h-4 w-4" />
                  Total Referrals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {referralData?.total_referrals || 0}
                </div>
                <p className="text-sm opacity-90">People you've referred</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-info text-info-foreground shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <TrendingUp className="mr-2 h-4 w-4" />
                  Total Bonus Earned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {formatUSD(referralData?.total_bonus_earned || 0)}
                </div>
                <p className="text-sm opacity-90">Multi-level bonuses on all deposits</p>
              </CardContent>
            </Card>
          </div>

          {/* Referral Code Section */}
          <Card className="bg-card border-0 shadow-card mb-6">
            <CardHeader>
              <CardTitle className="text-card-foreground">Your Referral Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <code className="flex-1 bg-muted p-3 rounded text-lg font-mono text-center">
                  {referralData?.referral_code}
                </code>
                <Button size="icon" variant="outline" onClick={copyReferralCode}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-2">
                <Button
                  variant="outline"
                  onClick={shareReferralLink}
                  className="w-full"
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Referral Link
                </Button>
              </div>

              <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                <p className="text-sm text-info">
                  <strong>How it works:</strong> Share your referral code with friends. 
                  Earn multi-level bonuses on ALL their deposits:
                </p>
                <div className="mt-2 text-xs text-info space-y-1">
                  <div>• Level 1 (Direct): 20% bonus</div>
                  <div>• Level 2 (Indirect): 3% bonus</div>
                  <div>• Level 3 (Indirect): 2% bonus</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Referrals List */}
          <Card className="bg-card border-0 shadow-card">
            <CardHeader>
              <CardTitle className="text-card-foreground">Team Members</CardTitle>
            </CardHeader>
            <CardContent>
              {referralData?.referrals && referralData.referrals.length > 0 ? (
                <div className="space-y-3">
                  {referralData.referrals.map((referral) => (
                    <div key={referral.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-card-foreground">
                          {referral.referred_user_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {referral.referred_user_phone}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Joined: {new Date(referral.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-success">
                          +{formatUSD(referral.bonus_amount)}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {referral.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No referrals yet</p>
                  <p className="text-sm">Start sharing your referral code to build your team!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default MyTeam;