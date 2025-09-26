// src/pages/Wallet.tsx
import { useState, useEffect } from 'react';
import { db } from '@/integrations/firebase';
import { collection, query, where, onSnapshot, addDoc, orderBy, Timestamp, updateDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { useNavigate } from 'react-router-dom';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  createdAt: Timestamp;
  status: string;
  note?: string;
}

const Wallet = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    setLoading(true);

    const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
    const unsubscribeUser = onSnapshot(userQuery, (snap) => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setBalance(data.balance || 0);
      }
    });

    const txQuery = query(
      collection(db, 'transactions'),
      where('userEmail', '==', user.email),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeTx = onSnapshot(txQuery, (snap) => {
      const txs: Transaction[] = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setTransactions(txs);
      setLoading(false);
    });

    return () => {
      unsubscribeUser();
      unsubscribeTx();
    };
  }, [user?.email]);

  const formatUSD = (amount: number) =>
    `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

  const handleDeposit = async (amount: number) => {
    if (!user?.email) return;
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(userQuery);
      if (!snap.empty) {
        const userRef = snap.docs[0].ref;
        const newBalance = (snap.docs[0].data().balance || 0) + amount;
        await updateDoc(userRef, { balance: newBalance });
        await addDoc(collection(db, 'transactions'), {
          userEmail: user.email,
          type: 'deposit',
          amount,
          createdAt: Timestamp.now(),
          status: 'success',
          note: 'Card deposit'
        });
        toast.success('Deposit successful');
        setShowDepositModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Deposit failed');
    }
  };

  const handleWithdraw = async (amount: number, bankName: string, accountNumber: string, accountName: string) => {
    if (!user?.email) return;
    if (amount > balance) {
      toast.error('Insufficient balance');
      return;
    }
    try {
      const userQuery = query(collection(db, 'users'), where('email', '==', user.email));
      const snap = await getDocs(userQuery);
      if (!snap.empty) {
        const userRef = snap.docs[0].ref;
        const newBalance = (snap.docs[0].data().balance || 0) - amount;
        await updateDoc(userRef, { balance: newBalance });
        await addDoc(collection(db, 'transactions'), {
          userEmail: user.email,
          type: 'withdrawal',
          amount,
          createdAt: Timestamp.now(),
          status: 'success',
          note: `Withdraw to ${bankName} ${accountNumber} (${accountName})`
        });
        toast.success('Withdrawal successful');
        setShowWithdrawModal(false);
      }
    } catch (err) {
      console.error(err);
      toast.error('Withdrawal failed');
    }
  };

  // Auto-format card number like Stripe
  const formatCardNumber = (value: string) => {
    return value.replace(/\D/g, '').replace(/(.{4})/g, '$1 ').trim();
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

  const formatExpiry = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 2) return digits;
    return digits.slice(0, 2) + '/' + digits.slice(2, 4);
  };

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10 space-y-8">
        <h1 className="text-4xl font-bold text-center">My Wallet</h1>

        <Card className="w-full max-w-md shadow-lg">
          <CardHeader>
            <CardTitle className="text-xl">Available Balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-4">
            <p className="text-3xl font-extrabold">{formatUSD(balance)}</p>
            <div className="flex gap-4">
              <Button onClick={() => setShowDepositModal(true)} className="flex items-center gap-2">
                <ArrowUp className="h-5 w-5" /> Deposit
              </Button>
              <Button variant="outline" onClick={() => setShowWithdrawModal(true)} className="flex items-center gap-2">
                <ArrowDown className="h-5 w-5" /> Withdraw
              </Button>
            </div>
            <Button variant="link" onClick={() => navigate('/transactions')}>
              View Transactions
            </Button>
          </CardContent>
        </Card>

        {/* Deposit Modal */}
        <Dialog open={showDepositModal} onOpenChange={setShowDepositModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deposit</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4 flex flex-col items-center">
              <input
                type="number"
                placeholder="Amount in cents"
                className="w-full border p-2 rounded"
                id="depositAmount"
              />
              <input
                type="text"
                placeholder="Card Number (**** **** **** ****)"
                maxLength={19}
                className="w-full border p-2 rounded"
                onInput={(e) => {
                  const el = e.target as HTMLInputElement;
                  el.value = formatCardNumber(el.value);
                }}
              />
              <input
                type="text"
                placeholder="MM/YY"
                maxLength={5}
                className="w-full border p-2 rounded"
                onInput={(e) => {
                  const el = e.target as HTMLInputElement;
                  el.value = formatExpiry(el.value);
                }}
              />
              <input
                type="text"
                placeholder="CVC"
                maxLength={3}
                className="w-full border p-2 rounded"
              />
              <Button
                onClick={() => {
                  const amt = Number((document.getElementById('depositAmount') as HTMLInputElement).value);
                  handleDeposit(amt);
                }}
                className="w-full mt-2"
              >
                Deposit
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Withdraw Modal */}
        <Dialog open={showWithdrawModal} onOpenChange={setShowWithdrawModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Withdraw</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4 flex flex-col items-center">
              <input
                type="number"
                placeholder="Amount in cents"
                className="w-full border p-2 rounded"
                id="withdrawAmount"
              />
              <input
                type="text"
                placeholder="Bank Name"
                className="w-full border p-2 rounded"
                id="bankName"
              />
              <input
                type="text"
                placeholder="Account Number"
                className="w-full border p-2 rounded"
                id="accountNumber"
              />
              <input
                type="text"
                placeholder="Account Name"
                className="w-full border p-2 rounded"
                id="accountName"
              />
              <Button
                onClick={() => {
                  const amt = Number((document.getElementById('withdrawAmount') as HTMLInputElement).value);
                  const bank = (document.getElementById('bankName') as HTMLInputElement).value;
                  const accNum = (document.getElementById('accountNumber') as HTMLInputElement).value;
                  const accName = (document.getElementById('accountName') as HTMLInputElement).value;
                  handleWithdraw(amt, bank, accNum, accName);
                }}
                className="w-full mt-2"
              >
                Withdraw
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Wallet;
