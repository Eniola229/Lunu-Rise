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
  name?: string;
  email: string;
  phone?: string;
  country?: string;
  city?: string;
  address?: string;
  referralCode?: string;
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

    const formatUSD = (amount: number) =>
    `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;


  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      setLoading(true);
      try {
        // Fetch user data
        const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
        const userSnap = await getDocs(userQuery);
        if (!userSnap.empty) {
          const data = userSnap.docs[0].data();
          setUserData({
            name: data.name || 'N/A',
            email: data.email,
            phone: data.phone || 'N/A',
            country: data.country || 'N/A',
            city: data.city || 'N/A',
            address: data.address || 'N/A',
            referralCode: data.referralCode || 'N/A',
            balance: data.balance || 0,
          });
        } else {
          console.warn('No user found for email:', user.email);
        }

        // Fetch wallet data
        const walletQuery = query(collection(db, 'wallets'), where('user_id', '==', user.uid));
        const walletSnap = await getDocs(walletQuery);
        if (!walletSnap.empty) {
          setWallet(walletSnap.docs[0].data() as WalletData);
        } else {
          console.warn('No wallet found for user id:', user.uid);
        }

      } catch (err) {
        console.error(err);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!userData || !user) return;

    setSaving(true);
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
      const userSnap = await getDocs(userQuery);
      if (!userSnap.empty) {
        const docRef = doc(db, 'users', userSnap.docs[0].id);
        await updateDoc(docRef, {
          phone: userData.phone === 'N/A' ? '' : userData.phone,
          country: userData.country === 'N/A' ? '' : userData.country,
          city: userData.city === 'N/A' ? '' : userData.city,
          address: userData.address === 'N/A' ? '' : userData.address,
        });
        toast.success('Profile updated successfully');
        setIsEditMode(false);
      } else {
        toast.error('User not found');
      }
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
      toast.success('Logged out');
      navigate('/');
    } catch (err) {
      console.error(err);
      toast.error('Logout failed');
    }
  };

  const copyReferralCode = () => {
    if (userData?.referralCode) {
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

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-primary text-primary-foreground p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <span className="font-semibold">Tel: {userData?.phone || 'N/A'}</span>
        </div>

        {/* Wallet */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card>
            <CardContent className="text-center">
              <div className="font-semibold">Recharge Balance</div>
              <div>{wallet ? formatUSD(wallet.pending_cents) : 'USDT 0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="text-center">
              <div className="font-semibold">Withdrawable Balance</div>
              <div>{wallet ? formatUSD(wallet.available_cents) : 'USDT 0.00'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Total Balance */}
        <Card className="mb-6">
          <CardContent className="flex justify-between items-center">
            <div>
              <div className="font-semibold">Total Balance</div>
              <div className="text-2xl font-bold">{userData ? formatUSD(userData.balance) : 'USDT 0.00'}</div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => navigate('/plans')}>Recharge</Button>
              <Button onClick={() => navigate('/wallet')}>Withdraw</Button>
            </div>
          </CardContent>
        </Card>

        {/* Profile */}
        <Card>
          <CardContent>
            <div className="flex justify-between mb-4">
              <h3 className="font-semibold">Profile Settings</h3>
              <Button size="sm" onClick={() => setIsEditMode(!isEditMode)}>
                {isEditMode ? 'Cancel' : <Edit2 className="h-4 w-4" />}
              </Button>
            </div>

            {isEditMode ? (
              <div className="space-y-4">
                <div>
                  <Label>Phone</Label>
                  <Input value={userData?.phone || ''} onChange={(e) => setUserData({ ...userData, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Country</Label>
                  <CountrySelector value={userData?.country || ''} onValueChange={(val) => setUserData({ ...userData, country: val })} />
                </div>
                <div>
                  <Label>City</Label>
                  <Input value={userData?.city || ''} onChange={(e) => setUserData({ ...userData, city: e.target.value })} />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={userData?.address || ''} onChange={(e) => setUserData({ ...userData, address: e.target.value })} />
                </div>
                <Button onClick={handleSaveProfile} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between"><span>Phone:</span><span>{userData?.phone || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Country:</span><span>{userData?.country || 'N/A'}</span></div>
                <div className="flex justify-between"><span>City:</span><span>{userData?.city || 'N/A'}</span></div>
                <div className="flex justify-between"><span>Address:</span><span>{userData?.address || 'N/A'}</span></div>
                <div className="flex justify-between items-center">
                  <span>Referral Code:</span>
                  <div className="flex items-center gap-2">
                    <span>{userData?.referralCode || 'N/A'}</span>
                    <Button size="sm" onClick={copyReferralCode}><Copy className="h-4 w-4" /></Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button variant="ghost" className="mt-6 w-full" onClick={handleLogout}>
          <LogOut className="h-5 w-5 mr-2" /> Logout
        </Button>
      </div>
    </Layout>
  );
};

export default Profile;
