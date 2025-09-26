import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Settings,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock
} from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  totalDeposits: number;
  totalWithdrawals: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalRevenue: number;
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalDeposits: 0,
    totalWithdrawals: 0,
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentDeposits, setRecentDeposits] = useState<any[]>([]);
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    
    loadDashboardData();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      // Load stats
      const [usersResult, depositsResult, withdrawalsResult] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('deposits').select('amount_usd_cents, status', { count: 'exact' }),
        supabase.from('withdrawals').select('amount_cents, status', { count: 'exact' })
      ]);

      const deposits = depositsResult.data || [];
      const withdrawals = withdrawalsResult.data || [];

      setStats({
        totalUsers: usersResult.count || 0,
        totalDeposits: deposits.length,
        totalWithdrawals: withdrawals.length,
        pendingDeposits: deposits.filter(d => d.status === 'pending').length,
        pendingWithdrawals: withdrawals.filter(w => w.status === 'queued').length,
        totalRevenue: deposits
          .filter(d => d.status === 'completed')
          .reduce((sum, d) => sum + (d.amount_usd_cents || 0), 0) / 100
      });

      // Load recent activities
      const { data: recentDepositsData } = await supabase
        .from('deposits')
        .select(`
          *,
          profiles!inner(full_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: recentWithdrawalsData } = await supabase
        .from('withdrawals')
        .select(`
          *,
          profiles!inner(full_name, phone)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentDeposits(recentDepositsData || []);
      setRecentWithdrawals(recentWithdrawalsData || []);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeposit = async (depositId: string) => {
    try {
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'completed', confirmed_at: new Date().toISOString() })
        .eq('id', depositId);

      if (error) throw error;

      toast.success('Deposit approved successfully');
      loadDashboardData();
    } catch (error) {
      console.error('Error approving deposit:', error);
      toast.error('Failed to approve deposit');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="text-warning"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="text-success"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'queued':
        return <Badge variant="outline" className="text-info"><RefreshCw className="w-3 h-3 mr-1" />Queued</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Layout showBottomNav={false}>
        <div className="min-h-screen flex items-center justify-center">
          <div>Loading admin dashboard...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout showBottomNav={false}>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
              <p className="text-muted-foreground">Manage your Luno Rise platform</p>
            </div>
            <Button onClick={loadDashboardData} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Deposits</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.pendingDeposits}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Deposits</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalDeposits}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Withdrawals</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalWithdrawals}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Withdrawals</CardTitle>
                <AlertTriangle className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-warning">{stats.pendingWithdrawals}</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activities */}
          <Tabs defaultValue="deposits" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposits">Recent Deposits</TabsTrigger>
              <TabsTrigger value="withdrawals">Recent Withdrawals</TabsTrigger>
            </TabsList>

            <TabsContent value="deposits" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Deposits</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentDeposits.map((deposit) => (
                      <div key={deposit.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium">{deposit.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{deposit.profiles?.phone}</p>
                            </div>
                            <div>
                              <p className="font-semibold">${((deposit.amount_usd_cents || 0) / 100).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">{deposit.method}</p>
                            </div>
                            <div>
                              {getStatusBadge(deposit.status)}
                            </div>
                          </div>
                        </div>
                        {deposit.status === 'pending' && (
                          <Button
                            size="sm"
                            onClick={() => handleApproveDeposit(deposit.id)}
                            className="ml-4"
                          >
                            Approve
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="withdrawals" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Withdrawals</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentWithdrawals.map((withdrawal) => (
                      <div key={withdrawal.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-4">
                            <div>
                              <p className="font-medium">{withdrawal.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{withdrawal.profiles?.phone}</p>
                            </div>
                            <div>
                              <p className="font-semibold">${((withdrawal.amount_cents || 0) / 100).toFixed(2)}</p>
                              <p className="text-sm text-muted-foreground">
                                Net: ${((withdrawal.net_cents || 0) / 100).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              {getStatusBadge(withdrawal.status)}
                            </div>
                          </div>
                        </div>
                        {withdrawal.status === 'queued' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-4"
                          >
                            Process
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default AdminDashboard;