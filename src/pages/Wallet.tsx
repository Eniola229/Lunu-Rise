// src/pages/Wallet.tsx
import { useState, useEffect } from 'react';
import { db } from '@/integrations/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  orderBy,
  Timestamp,
  updateDoc,
  doc,
  getDocs
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useNavigate } from 'react-router-dom';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number; // in cents
  createdAt: Timestamp;
  status: 'pending' | 'success' | 'failed';
  note?: string;
}

const Wallet = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Deposit Modal
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');

  // Withdraw Modal
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  // Format USD
  const formatUSD = (cents: number) =>
    `$${ (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }`;

  // Format card number: 1234 5678 9012 3456
  const formatCardNumber = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(.{4})/g, '$1 ')
      .trim()
      .slice(0, 19);
  };

  // Format expiry: MM/YY
  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  };

  // === Load Balance & Transactions ===
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);

    // Listen to user balance
    const userDocRef = doc(db, 'users', user.uid);
    const userQuery = query(collection(db, 'users'), where('__name__', '==', user.uid));

    const unsubscribeUser = onSnapshot(userQuery, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setBalance(data.balance || 0);
      }
    }, (err) => {
      console.error('User snapshot error:', err);
      toast.error('Failed to load balance');
    });

    // Listen to transactions
    const txQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTx = onSnapshot(txQuery, (snap) => {
      const txs: Transaction[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setTransactions(txs);
      setLoading(false);
    }, (err) => {
      console.error('Transactions error:', err);
      toast.error('Failed to load transactions');
    });

    return () => {
      unsubscribeUser();
      unsubscribeTx();
    };
  }, [user?.uid]);

  // === Deposit Handler ===
  const handleDeposit = async () => {
    const amount = Math.round(parseFloat(depositAmount) * 100);
    if (!amount || amount <= 0) return toast.error('Enter valid amount');
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) return toast.error('Invalid card number');
    if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) return toast.error('Invalid expiry');
    if (!cvc || cvc.length < 3) return toast.error('Invalid CVC');

    try {
      const userDocRef = doc(db, 'users', user!.uid);
      const snap = await getDocs(query(collection(db, 'users'), where('__name__', '==', user!.uid)));
      if (snap.empty) throw new Error('User not found');

      const currentBalance = snap.docs[0].data().balance || 0;
      await updateDoc(userDocRef, { balance: currentBalance + amount });

      await addDoc(collection(db, 'transactions'), {
        userId: user!.uid,
        type: 'deposit',
        amount,
        createdAt: Timestamp.now(),
        status: 'success',
        note: `Card ending ${cardNumber.slice(-4)}`
      });

      toast.success('Deposit successful!');
      setShowDeposit(false);
      resetDepositForm();
    } catch (err) {
      console.error(err);
      toast.error('Deposit failed');
    }
  };

  // === Withdraw Handler ===
  const handleWithdraw = async () => {
    const amount = Math.round(parseFloat(withdrawAmount) * 100);
    if (!amount || amount <= 0) return toast.error('Enter valid amount');
    if (amount > balance) return toast.error('Insufficient balance');
    if (!bankName || !accountNumber || !accountName) return toast.error('Fill all bank details');

    try {
      const userDocRef = doc(db, 'users', user!.uid);
      await updateDoc(userDocRef, { balance: balance - amount });

      await addDoc(collection(db, 'transactions'), {
        userId: user!.uid,
        type: 'withdrawal',
        amount,
        createdAt: Timestamp.now(),
        status: 'pending',
        note: `To ${bankName} - ${accountNumber} (${accountName})`
      });

      toast.success('Withdrawal request submitted!');
      setShowWithdraw(false);
      resetWithdrawForm();
    } catch (err) {
      console.error(err);
      toast.error('Withdrawal failed');
    }
  };

  const resetDepositForm = () => {
    setDepositAmount('');
    setCardNumber('');
    setExpiry('');
    setCvc('');
  };

  const resetWithdrawForm = () => {
    setWithdrawAmount('');
    setBankName('');
    setAccountNumber('');
    setAccountName('');
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
      <div className="min-h-screen bg-gradient-primary text-primary-foreground p-6 space-y-8">
        <h1 className="text-3xl font-bold text-center">My Wallet</h1>

        {/* Balance Card */}
        <Card className="max-w-md mx-auto shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl text-center">Available Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-4xl font-extrabold text-center text-green-500">
              {formatUSD(balance)}
            </p>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeposit(true)}
                className="flex-1"
                variant="success"
              >
                <ArrowUp className="mr-2 h-5 w-5" /> Deposit
              </Button>
              <Button
                onClick={() => setShowWithdraw(true)}
                className="flex-1"
                variant="outline"
                disabled={balance === 0}
              >
                <ArrowDown className="mr-2 h-5 w-5" /> Withdraw
              </Button>
            </div>

            <Button
              variant="link"
              className="w-full"
              onClick={() => navigate('/transactions')}
            >
              View Transaction History
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        {transactions.length > 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.slice(0, 5).map((tx) => (
                  <div
                    key={tx.id}
                    className="flex justify-between items-center p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {tx.type === 'deposit' ? (
                        <ArrowUp className="h-5 w-5 text-green-500" />
                      ) : (
                        <ArrowDown className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{tx.type}</p>
                        <p className="text-xs text-muted-foreground">
                          {tx.createdAt?.toDate().toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {tx.type === 'deposit' ? '+' : '-'}{formatUSD(tx.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">{tx.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Deposit Modal */}
        <Dialog open={showDeposit} onOpenChange={setShowDeposit}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deposit Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="50.00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min="1"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Card Number</Label>
                <Input
                  placeholder="1234 5678 9012 3456"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  maxLength={19}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Expiry (MM/YY)</Label>
                  <Input
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                    maxLength={5}
                  />
                </div>
                <div>
                  <Label>CVC</Label>
                  <Input
                    placeholder="123"
                    value={cvc}
                    onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    maxLength={4}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowDeposit(false); resetDepositForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleDeposit}>Deposit</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Withdraw Modal */}
        <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Withdraw Funds</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label>Amount (USD)</Label>
                <Input
                  type="number"
                  placeholder="50.00"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  min="1"
                  step="0.01"
                  max={balance / 100}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Available: {formatUSD(balance)}
                </p>
              </div>
              <div>
                <Label>Bank Name</Label>
                <Input
                  placeholder="e.g. Chase Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
              <div>
                <Label>Account Number</Label>
                <Input
                  placeholder="1234567890"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />
              </div>
              <div>
                <Label>Account Holder Name</Label>
                <Input
                  placeholder="John Doe"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowWithdraw(false); resetWithdrawForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleWithdraw}>Withdraw</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Wallet;