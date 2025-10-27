import { useState, useEffect } from 'react';
import { Edit2, LogOut, Copy, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { auth, db } from '@/integrations/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import Layout from '@/components/Layout';
import { CountrySelector } from '@/components/CountrySelector';
import { Loader2 } from 'lucide-react';

interface UserData {
  name: string;
  phone: string;
  country: string;
  referralCode: string;
  balance: number;
}

interface WalletData {
  available_cents: number;
  pending_cents: number;
  total_earned_cents: number;
}

const Profile = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  const formatUSD = (cents: number) =>
    `$${(cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        // === Fetch user from Firestore using UID (most reliable) ===
        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', user.uid)));

        if (!userSnap.empty) {
          const data = userSnap.docs[0].data();
          setUserData({
            name: data.name || 'User',
            phone: data.phone || 'N/A',
            country: data.country || 'N/A',
            referralCode: data.referralCode || 'N/A',
            balance: data.balance || 0,
          });
        } else {
          toast.error('User profile not found');
        }

        // === Fetch wallet ===
        const walletQuery = query(collection(db, 'wallets'), where('user_id', '==', user.uid));
        const walletSnap = await getDocs(walletQuery);
        if (!walletSnap.empty) {
          setWallet(walletSnap.docs[0].data() as WalletData);
        }

      } catch (err) {
        console.error('Error loading profile:', err);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!userData || !user) return;

    if (!userData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!userData.country || userData.country === 'N/A') {
      toast.error('Please select a country');
      return;
    }

    setSaving(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        name: userData.name.trim(),
        country: userData.country,
      });
      toast.success('Profile updated successfully');
      setIsEditMode(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Logged out successfully');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Logout failed');
    }
  };

  const copyReferralCode = () => {
    if (userData?.referralCode && userData.referralCode !== 'N/A') {
      navigator.clipboard.writeText(userData.referralCode);
      toast.success('Referral code copied!');
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
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-red-500">Profile not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-primary text-primary-foreground p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="font-semibold">Tel: {userData.phone}</span>
        </div>

        {/* Wallet Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="text-center p-4">
              <div className="font-semibold text-sm">Pending</div>
              <div className="text-lg">
                {wallet ? formatUSD(wallet.pending_cents) : 'USDT 0.00'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center p-4">
              <div className="font-semibold text-sm">Available</div>
              <div className="text-lg">
                {wallet ? formatUSD(wallet.available_cents) : 'USDT 0.00'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Total Balance */}
        <Card className="mb-6">
          <CardContent className="flex justify-between items-center p-4">
            <div>
              <div className="font-semibold">Total Balance</div>
              <div className="text-2xl font-bold">
                {formatUSD(userData.balance * 100)} {/* assuming balance is in cents */}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => navigate('/plans')}>Recharge</Button>
              <Button size="sm" onClick={() => navigate('/wallet')}>Withdraw</Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Profile Settings</h3>
              <Button
                size="sm"
                variant={isEditMode ? "secondary" : "ghost"}
                onClick={() => setIsEditMode(!isEditMode)}
              >
                {isEditMode ? 'Cancel' : <Edit2 className="h-4 w-4" />}
              </Button>
            </div>

            {isEditMode ? (
              <div className="space-y-4">
                {/* Name */}
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={userData.name}
                    onChange={(e) => setUserData({ ...userData, name: e.target.value })}
                    placeholder="Enter your name"
                  />
                </div>

                {/* Phone (Read-only) */}
                <div>
                  <Label>Phone Number</Label>
                  <Input
                    value={userData.phone}
                    disabled
                    className="bg-muted"
                  />
                </div>

                {/* Country */}
                <div>
                  <Label>Country</Label>
                  <CountrySelector
                    value={userData.country}
                    onValueChange={(val) => setUserData({ ...userData, country: val })}
                  />
                </div>

                <Button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="w-full"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{userData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="font-medium">{userData.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Country:</span>
                  <span className="font-medium">{userData.country}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Referral Code:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{userData.referralCode}</span>
                    <Button size="icon" variant="ghost" onClick={copyReferralCode}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Logout */}
        <Button
          variant="ghost"
          className="mt-6 w-full flex items-center justify-center"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
    </Layout>
  );
};

export default Profile;