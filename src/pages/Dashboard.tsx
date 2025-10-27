// src/pages/Dashboard.tsx
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
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  Timestamp
} from 'firebase/firestore';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface UserData {
  name: string;
  phone: string;
  country: string;
  balance: number; // cents
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
  const [selectedInv, setSelectedInv] = useState<Investment | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [profileMissing, setProfileMissing] = useState(false);

  // -----------------------------------------------------------------
  // 1. Load user profile (by UID – never fails)
  // -----------------------------------------------------------------
  const loadUserProfile = async () => {
    if (!user?.uid) return;

    const userDocRef = doc(db, 'users', user.uid);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      setUserData({
        name: data.name || 'User',
        phone: data.phone || 'N/A',
        country: data.country || 'N/A',
        balance: data.balance || 0,
        referralCode: data.referralCode || 'N/A',
      });
      setProfileMissing(false);
    } else {
      // Profile missing – show friendly screen
      setProfileMissing(true);
    }
  };

  // -----------------------------------------------------------------
  // 2. Load wallet & investments (by UID)
  // -----------------------------------------------------------------
  const loadWalletAndInvestments = async () => {
    if (!user?.uid) return;

    // Wallet
    const walletQ = query(collection(db, 'wallets'), where('user_id', '==', user.uid));
    const walletSnap = await getDocs(walletQ);
    if (!walletSnap.empty) {
      setWallet(walletSnap.docs[0].data() as WalletData);
    }

    // Investments
    const invQ = query(collection(db, 'investments'), where('userId', '==', user.uid));
    const invSnap = await getDocs(invQ);
    const invs: Investment[] = invSnap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    } as Investment));

    invs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setInvestments(invs);
  };

  // -----------------------------------------------------------------
  // 3. Main loader
  // -----------------------------------------------------------------
  useEffect(() => {
    const run = async () => {
      if (!user) return;
      setLoading(true);
      await loadUserProfile();
      await loadWalletAndInvestments();
      setLoading(false);
    };
    run();
  }, [user]);

  // -----------------------------------------------------------------
  // 4. Re-create missing profile (one-click fix)
  // -----------------------------------------------------------------
  const recreateProfile = async () => {
    if (!user?.uid) return;

    const dummyPhone = user.email?.split('@')[0] || '+0000000000';
    const defaultData = {
      name: 'New User',
      phone: dummyPhone,
      country: 'US',
      balance: 0,
      referralCode: Math.random().toString(36).substring(2, 10).toUpperCase(),
      createdAt: Timestamp.now(),
      authMethod: 'phone',
    };

    try {
      await setDoc(doc(db, 'users', user.uid), defaultData);
      toast.success('Profile created! Refreshing…');
      setProfileMissing(false);
      setUserData({
        name: defaultData.name,
        phone: defaultData.phone,
        country: defaultData.country,
        balance: defaultData.balance,
        referralCode: defaultData.referralCode,
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to create profile');
    }
  };

  // -----------------------------------------------------------------
  // 5. Helpers
  // -----------------------------------------------------------------
  const formatUSD = (cents: number) =>
    `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out');
      navigate('/auth/login');
    } catch {
      toast.error('Logout failed');
    }
  };

  // -----------------------------------------------------------------
  // 6. UI
  // -----------------------------------------------------------------
  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  // Profile missing screen
  if (profileMissing) {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground">
              We couldn’t locate your profile. This can happen after a migration.
            </p>
          </div>
          <Button onClick={recreateProfile} size="lg">
            Create Profile Now
          </Button>
        </div>
      </Layout>
    );
  }

  if (!userData) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center text-red-500">
          Unexpected error – please log out and try again.
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
            <Button size="icon" variant="ghost" onClick={handleLogout}>
              <LogOut className="h-6 w-6" />
            </Button>
            <Button size="icon" variant="ghost">
              <Bell className="h-6 w-6" />
            </Button>
          </div>
        </div>

        {/* Wallet */}
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
                <div className="text-sm text-muted-foreground">Earned</div>
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
              <p className="text-center py-4 text-muted-foreground">No active investments</p>
            ) : (
              investments.map((inv) => (
                <Card
                  key={inv.id}
                  className="hover:shadow-md cursor-pointer"
                  onClick={() => {
                    setSelectedInv(inv);
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
                    <Badge variant={inv.status === 'active' ? 'secondary' : 'destructive'}>
                      {inv.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Investment Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Investment Details</DialogTitle>
            </DialogHeader>
            {selectedInv && (
              <div className="space-y-3 text-sm">
                <p><strong>Plan:</strong> {selectedInv.planName}</p>
                <p><strong>Deposit:</strong> {formatUSD(selectedInv.deposit_usd * 100)}</p>
                <p><strong>Payout/Drop:</strong> {formatUSD(selectedInv.payout_per_drop_usd * 100)}</p>
                <p><strong>Drops:</strong> {selectedInv.drops_count}</p>
                <p><strong>Total Return:</strong> {formatUSD(selectedInv.total_return_usd * 100)}</p>
                <p><strong>Status:</strong> <Badge variant={selectedInv.status === 'active' ? 'secondary' : 'destructive'}>{selectedInv.status}</Badge></p>
                <p><strong>Started:</strong> {selectedInv.createdAt ? new Date(selectedInv.createdAt.seconds * 1000).toLocaleString() : 'N/A'}</p>
              </div>
            )}
            <DialogFooter>
              <Button onClick={() => setModalOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Dashboard;