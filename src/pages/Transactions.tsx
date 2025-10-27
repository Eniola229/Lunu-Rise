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
  DocumentData,
  Timestamp
} from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { ArrowUpRight, ArrowDownLeft, RefreshCw, Download } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'crypto';
  amount: number; // in cents
  amountCrypto?: number;
  currency?: string;
  createdAt: Timestamp;
  status: 'pending' | 'success' | 'failed' | 'confirmed' | 'declined';
  note?: string;
  txHash?: string;
  card?: { last4: string; expiry: string };
  bank?: { name: string; number: string; accountName: string };
}

const TransactionsFirebase = () => {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTxs, setFilteredTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'crypto'>('all');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  // Format cents → $X,XXX.XX
  const formatUSD = (cents: number) =>
    `$${ (cents / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }`;

  // === Real-time Transactions ===
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const txs: Transaction[] = snapshot.docs.map(
          (doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...doc.data()
          })
        ) as Transaction[];

        // Sort newest first
        txs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        setTransactions(txs);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching transactions:', err);
        toast.error('Failed to load transactions');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  // === Filter Transactions ===
  useEffect(() => {
    if (filter === 'all') {
      setFilteredTxs(transactions);
    } else {
      setFilteredTxs(transactions.filter((tx) => tx.type === filter));
    }
  }, [transactions, filter]);

  // === Icons & Badges ===
  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownLeft className="h-5 w-5 text-green-500" />;
      case 'withdrawal':
        return <ArrowUpRight className="h-5 w-5 text-red-500" />;
      case 'crypto':
        return <RefreshCw className="h-5 w-5 text-blue-500" />;
      default:
        return <RefreshCw className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'success':
      case 'confirmed':
        return <Badge variant="secondary">Success</Badge>;
      case 'failed':
      case 'declined':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  // === Export to CSV ===
  const exportToCSV = () => {
    if (filteredTxs.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Date', 'Type', 'Amount', 'Status', 'Note'];
    const rows = filteredTxs.map((tx) => [
      tx.createdAt ? new Date(tx.createdAt.seconds * 1000).toLocaleString() : 'N/A',
      tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
      tx.amountCrypto
        ? `${tx.amountCrypto} ${tx.currency || ''}`
        : formatUSD(tx.amount),
      tx.status,
      tx.note || ''
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast.success('Exported successfully');
  };

  if (authLoading || loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <RefreshCw className="h-10 w-10 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-full sm:w-40">
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
              disabled={filteredTxs.length === 0}
              className="flex-1 sm:flex-initial"
            >
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTxs.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No transactions found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTxs.map((tx) => (
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
                      <div className="font-semibold capitalize">{tx.type}</div>
                      <p className="text-xs text-muted-foreground">
                        {tx.createdAt
                          ? new Date(tx.createdAt.seconds * 1000).toLocaleString()
                          : 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {tx.amountCrypto
                        ? `${tx.amountCrypto} ${tx.currency || ''}`
                        : formatUSD(tx.amount)}
                    </p>
                    <div className="mt-1">{getStatusBadge(tx.status)}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Transaction Detail Modal */}
        <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transaction Details</DialogTitle>
            </DialogHeader>
            {selectedTx && (
              <div className="space-y-3 text-sm">
                <p>
                  <strong>Type:</strong>{' '}
                  <span className="capitalize">{selectedTx.type}</span>
                </p>
                <p>
                  <strong>Date:</strong>{' '}
                  {selectedTx.createdAt
                    ? new Date(selectedTx.createdAt.seconds * 1000).toLocaleString()
                    : 'N/A'}
                </p>
                <p>
                  <strong>Amount:</strong>{' '}
                  {selectedTx.amountCrypto
                    ? `${selectedTx.amountCrypto} ${selectedTx.currency || ''}`
                    : formatUSD(selectedTx.amount)}
                </p>
                <p>
                  <strong>Status:</strong>{' '}
                  <span className="inline-block">{getStatusBadge(selectedTx.status)}</span>
                </p>
                {selectedTx.note && (
                  <p>
                    <strong>Note:</strong> {selectedTx.note}
                  </p>
                )}
                {selectedTx.txHash && (
                  <p>
                    <strong>Tx Hash:</strong>{' '}
                    <a
                      href={`https://etherscan.io/tx/${selectedTx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 underline"
                    >
                      {selectedTx.txHash.slice(0, 10)}...{selectedTx.txHash.slice(-8)}
                    </a>
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
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTx(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default TransactionsFirebase;