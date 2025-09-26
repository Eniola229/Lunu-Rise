// src/pages/TransactionsFirebase.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/integrations/firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Transaction {
  id: string;
  userEmail: string;
  type: string;
  amount_usd?: number;
  amount?: number; // for withdrawals
  amountCrypto?: number;
  currency?: string;
  createdAt: any; // Firestore Timestamp
  status: string;
  note?: string;
  txHash?: string;
  card?: { last4: string; expiry: string };
  bank?: { name: string; number: string; accountName: string };
}

const TransactionsFirebase = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'crypto'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => {
    if (!user?.email) return;

    setLoading(true);

    const q = query(collection(db, 'transactions'), where('userEmail', '==', user.email));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs: Transaction[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })
        ) as Transaction[];

        // Sort by createdAt descending
        txs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        const filteredTxs =
          filter === 'all' ? txs : txs.filter((tx) => tx.type === filter);

        setTransactions(filteredTxs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching transactions:', err);
        toast.error('Failed to fetch transactions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.email, filter]);


  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="h-4 w-4 text-success" />;
      case 'withdrawal':
        return <ArrowUpRight className="h-4 w-4 text-red-600" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'confirmed':
        return <Badge variant="secondary">Confirmed</Badge>;
      case 'declined':
        return <Badge variant="destructive">Declined</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Amount', 'Status', 'Note'];
    const csvContent = [
      headers.join(','),
      ...transactions.map((tx) => [
        new Date(tx.createdAt?.seconds * 1000).toLocaleString(),
        tx.type,
        tx.amount_usd ??
          tx.amount ??
          (tx.amountCrypto ? `${tx.amountCrypto} ${tx.currency}` : '-'),
        tx.status,
        tx.note || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Transactions exported successfully');
  };

const formatUSD = (val?: number) => {
  if (val === undefined || val === null) return '-';
  return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="deposit">Deposits</SelectItem>
                <SelectItem value="withdrawal">Withdrawals</SelectItem>
                <SelectItem value="crypto">Crypto</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={exportToCSV}
              disabled={transactions.length === 0}
            >
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading transactions...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <Card
                key={tx.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedTx(tx)}
              >
                <CardContent className="flex justify-between items-center p-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-muted rounded-full">
                      {getTransactionIcon(tx.type)}
                    </div>
                    <div>
                      <div className="font-semibold">
                        {tx.type === 'deposit'
                          ? 'Deposit'
                          : tx.type === 'withdrawal'
                          ? 'Withdrawal'
                          : 'Crypto Payment'}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt?.seconds * 1000).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {tx.amount_usd
                          ? formatUSD(tx.amount_usd)
                          : tx.amount
                          ? formatUSD(tx.amount)
                          : tx.amountCrypto
                          ? `${tx.amountCrypto} ${tx.currency}`
                          : '-'}
                    </p>
                    <div className="mt-1">{getStatusBadge(tx.status)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Transaction Modal */}
        {selectedTx && (
          <Dialog open={true} onOpenChange={() => setSelectedTx(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Transaction Details</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 p-4">
                <p>
                  <strong>Type:</strong>{' '}
                  {selectedTx.type === 'deposit'
                    ? 'Deposit'
                    : selectedTx.type === 'withdrawal'
                    ? 'Withdrawal'
                    : 'Crypto Payment'}
                </p>
                <p>
                  <strong>Date:</strong>{' '}
                  {new Date(selectedTx.createdAt?.seconds * 1000).toLocaleString()}
                </p>
                <p>
                  <strong>Amount:</strong>{' '}
                    {selectedTx.amount_usd
                      ? formatUSD(selectedTx.amount_usd)
                      : selectedTx.amount
                      ? formatUSD(selectedTx.amount)
                      : selectedTx.amountCrypto
                      ? `${selectedTx.amountCrypto} ${selectedTx.currency}`
                      : '-'}
                </p>
                <p>
                  <strong>Status:</strong> {selectedTx.status}
                </p>
                {selectedTx.note && (
                  <p>
                    <strong>Note:</strong> {selectedTx.note}
                  </p>
                )}
                {selectedTx.txHash && (
                  <p>
                    <strong>TxHash:</strong> {selectedTx.txHash}
                  </p>
                )}
                {selectedTx.card && (
                  <p>
                    <strong>Card:</strong> **** **** **** {selectedTx.card.last4}
                  </p>
                )}
                {selectedTx.bank && (
                  <p>
                    <strong>Bank:</strong> {selectedTx.bank.name} - {selectedTx.bank.accountName} (
                    {selectedTx.bank.number})
                  </p>
                )}
                <Button
                  variant="outline"
                  className="mt-4 w-full"
                  onClick={() => setSelectedTx(null)}
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </Layout>
  );
};

export default TransactionsFirebase;
