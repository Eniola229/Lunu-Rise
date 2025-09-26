import { useState, useEffect } from 'react';
import { Plus, TrendingUp, Bell, LogOut, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; // <-- ADD THIS
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/integrations/firebase';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';


interface UserData {
  name: string;
  email: string;
  balance: number;
}

interface WalletData {
  available_cents: number;
  pending_cents: number;
  total_earned_cents: number;
}

interface Investment {
  id: string;
  planId: string;
  planName: string;
  deposit_usd: number;
  payout_per_drop_usd: number;
  drops_count: number;
  total_return_usd: number;
  status: string;
  createdAt: any;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [selectedInvestment, setSelectedInvestment] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!user) return;

      try {
        setLoading(true);

        // Fetch user info
        const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const data = userSnap.docs[0].data() as any;
          setUserData({
            name: data.name || 'User',
            email: data.email,
            balance: data.balance || 0,
          });
        }

        // Fetch wallet info
        const walletQuery = query(collection(db, 'wallets'), where('user_id', '==', user.uid));
        const walletSnap = await getDocs(walletQuery);
        if (!walletSnap.empty) {
          setWallet(walletSnap.docs[0].data() as WalletData);
        }

        // Fetch investments
        const investQuery = query(collection(db, 'investments'), where('userEmail', '==', user.email));
        const investSnap = await getDocs(investQuery);
        const invs: Investment[] = investSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment));
        invs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setInvestments(invs);

      } catch (err) {
        console.error(err);
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

  const formatUSD = (amount: number) =>
    `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/auth/login');
    } catch (err) {
      console.error(err);
      toast.error('Logout failed');
    }
  };

  if (authLoading || loading) {
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
      <div className="min-h-screen bg-gradient-primary text-primary-foreground p-6 pt-12">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Welcome Back, {userData?.name}</h1>
            <p className="mt-1 font-semibold text-lg">
              Balance: {formatUSD(userData?.balance || 0)}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Button size="icon" variant="ghost" className="text-primary-foreground" onClick={handleLogout}>
              <LogOut className="h-6 w-6" />
            </Button>
            <Button size="icon" variant="ghost" className="text-primary-foreground">
              <Bell className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Wallet Breakdown */}
        <Card className="bg-card border-0 shadow-card mb-6">
          <CardHeader>
            <CardTitle className="text-card-foreground">Wallet Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-secondary">
                  {userData ? formatUSD(userData.balance) : '$0.00'}
                </div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">
                  {wallet ? formatUSD(wallet.pending_cents / 100) : '$0.00'}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-info">
                  {wallet ? formatUSD(wallet.total_earned_cents / 100) : '$0.00'}
                </div>
                <div className="text-sm text-muted-foreground">Total Earned</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button variant="success" className="w-full" onClick={() => navigate('/plans')}>
                <Plus className="mr-2 h-4 w-4" /> Deposit
              </Button>
              <Button variant="warning" className="w-full" onClick={() => navigate('/wallet')}>
                <TrendingUp className="mr-2 h-4 w-4" /> Withdraw
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Active Investments */}
        <Card className="bg-card border-0 shadow-card mb-6">
          <CardHeader>
            <CardTitle className="text-card-foreground">Active Investments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {investments.length === 0 ? (
              <div className="text-muted-foreground text-center py-4">No active investments</div>
            ) : (
              investments.map((inv) => (
                <Card key={inv.id} className="hover:shadow-md cursor-pointer" onClick={() => { setSelectedInvestment(inv); setModalOpen(true); }}>
                  <CardContent className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold">{inv.planName}</p>
                      <p className="text-xs text-muted-foreground">Deposited: {formatUSD(inv.deposit_usd)}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant={inv.status === 'active' ? 'secondary' : 'destructive'}>{inv.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Investment Detail Modal */}
        <Dialog open={modalOpen} onOpenChange={() => setModalOpen(false)}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Investment Details</DialogTitle>
            </DialogHeader>
            {selectedInvestment && (
              <div className="space-y-2 p-2">
                <p><strong>Plan:</strong> {selectedInvestment.planName}</p>
                <p><strong>Deposit:</strong> {formatUSD(selectedInvestment.deposit_usd)}</p>
                <p><strong>Payout per Drop:</strong> {formatUSD(selectedInvestment.payout_per_drop_usd)}</p>
                <p><strong>Drops Count:</strong> {selectedInvestment.drops_count}</p>
                <p><strong>Total Return:</strong> {formatUSD(selectedInvestment.total_return_usd)}</p>
                <p><strong>Status:</strong> {selectedInvestment.status}</p>
                <p><strong>Created At:</strong> {new Date(selectedInvestment.createdAt?.seconds * 1000).toLocaleString()}</p>
              </div>
            )}
            <Button className="w-full mt-4" onClick={() => setModalOpen(false)}>Close</Button>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Dashboard;
