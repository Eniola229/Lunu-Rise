import { useState, useEffect } from 'react';
import { Plus, TrendingUp, Bell, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/integrations/firebase';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface UserData {
  name: string;
  phone: string;
  country: string;
  balance: number; // in cents
  referralCode: string;
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
  userId: string;
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

  // Format cents → $X,XXX.XX
  const formatUSD = (cents: number) =>
    `$${ (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }`;

  useEffect(() => {
    if (!user) return;

    const loadDashboardData = async () => {
      try {
        setLoading(true);

        // === 1. Fetch User Data by UID ===
        const userDocRef = doc(db, 'users', user.uid);
        const userQuery = query(collection(db, 'users'), where('__name__', '==', user.uid));
        const userSnap = await getDocs(userQuery);

        if (userSnap.empty) {
          toast.error('User profile not found');
          return;
        }

        const data = userSnap.docs[0].data();
        setUserData({
          name: data.name || 'User',
          phone: data.phone || 'N/A',
          country: data.country || 'N/A',
          balance: data.balance || 0,
          referralCode: data.referralCode || 'N/A',
        });

        // === 2. Fetch Wallet ===
        const walletQuery = query(collection(db, 'wallets'), where('user_id', '==', user.uid));
        const walletSnap = await getDocs(walletQuery);
        if (!walletSnap.empty) {
          setWallet(walletSnap.docs[0].data() as WalletData);
        }

        // === 3. Fetch Investments by userId (not email!) ===
        const investQuery = query(collection(db, 'investments'), where('userId', '==', user.uid));
        const investSnap = await getDocs(investQuery);
        const invs: Investment[] = investSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Investment));

        // Sort newest first
        invs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setInvestments(invs);

      } catch (err) {
        console.error('Dashboard load error:', err);
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [user]);

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

  if (!userData) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-red-500">
          Profile not found
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
            <h1 className="text-2xl font-bold">Welcome, {userData.name}</h1>
            <p className="mt-1 font-semibold text-lg">
              Balance: {formatUSD(userData.balance)}
            </p>
          </div>
          <div className="flex flex-col items-end space-y-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-primary-foreground"
              onClick={handleLogout}
            >
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
            <CardTitle className="text-card-foreground">Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-500">
                  {formatUSD(userData.balance)}
                </div>
                <div className="text-sm text-muted-foreground">Available</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-500">
                  {wallet ? formatUSD(wallet.pending_cents) : '$0.00'}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-500">
                  {wallet ? formatUSD(wallet.total_earned_cents) : '$0.00'}
                </div>
                <div className="text-sm text-muted-foreground">Total Earned</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <Button
                variant="success"
                className="w-full"
                onClick={() => navigate('/plans')}
              >
                <Plus className="mr-2 h-4 w-4" /> Deposit
              </Button>
              <Button
                variant="warning"
                className="w-full"
                onClick={() => navigate('/wallet')}
              >
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
              <div className="text-center py-6 text-muted-foreground">
                No active investments
              </div>
            ) : (
              investments.map((inv) => (
                <Card
                  key={inv.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => {
                    setSelectedInvestment(inv);
                    setModalOpen(true);
                  }}
                >
                  <CardContent className="flex justify-between items-center p-4">
                    <div>
                      <p className="font-semibold">{inv.planName}</p>
                      <p className="text-xs text-muted-foreground">
                        Deposited: {formatUSD(inv.deposit_usd * 100)}
                      </p>
                    </div>
                    <Badge
                      variant={inv.status === 'active' ? 'secondary' : 'destructive'}
                    >
                      {inv.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Investment Detail Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Investment Details</DialogTitle>
            </DialogHeader>
            {selectedInvestment && (
              <div className="space-y-3 text-sm">
                <p><strong>Plan:</strong> {selectedInvestment.planName}</p>
                <p><strong>Deposit:</strong> {formatUSD(selectedInvestment.deposit_usd * 100)}</p>
                <p><strong>Payout per Drop:</strong> {formatUSD(selectedInvestment.payout_per_drop_usd * 100)}</p>
                <p><strong>Drops Count:</strong> {selectedInvestment.drops_count}</p>
                <p><strong>Total Return:</strong> {formatUSD(selectedInvestment.total_return_usd * 100)}</p>
                <p><strong>Status:</strong> <Badge variant={selectedInvestment.status === 'active' ? 'secondary' : 'destructive'}>{selectedInvestment.status}</Badge></p>
                <p><strong>Started:</strong> {selectedInvestment.createdAt ? new Date(selectedInvestment.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
              </div>
            )}
            <Button className="w-full mt-6" onClick={() => setModalOpen(false)}>
              Close
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Dashboard;