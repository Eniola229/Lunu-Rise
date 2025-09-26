import { useState, useEffect } from 'react';
import { Check, X, Eye, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CryptoDeposit {
  id: string;
  user_id: string;
  amount_usd_cents: number;
  tx_hash: string;
  screenshot_url: string;
  status: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
}

const CryptoApproval = () => {
  const [deposits, setDeposits] = useState<CryptoDeposit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingDeposits();
  }, []);

  const loadPendingDeposits = async () => {
    try {
      const { data, error } = await supabase
        .from('deposits')
        .select('id, user_id, amount_usd_cents, tx_hash, screenshot_url, status, created_at')
        .eq('method', 'crypto_manual')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Get profile names for each deposit
      const depositsWithProfiles = await Promise.all(
        (data || []).map(async (deposit) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', deposit.user_id)
            .single();
          
          return {
            ...deposit,
            profiles: profile
          };
        })
      );
      
      setDeposits(depositsWithProfiles);
    } catch (error) {
      console.error('Error loading deposits:', error);
      toast.error('Failed to load pending deposits');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (depositId: string, amount: number) => {
    try {
      // Begin transaction: approve deposit and credit wallet
      const { error: updateError } = await supabase
        .from('deposits')
        .update({ 
          status: 'confirmed',
          confirmed_at: new Date().toISOString()
        })
        .eq('id', depositId);

      if (updateError) throw updateError;

      toast.success('Deposit approved successfully!');
      loadPendingDeposits(); // Refresh list
    } catch (error) {
      console.error('Error approving deposit:', error);
      toast.error('Failed to approve deposit');
    }
  };

  const handleReject = async (depositId: string) => {
    try {
      const { error } = await supabase
        .from('deposits')
        .update({ status: 'failed' })
        .eq('id', depositId);

      if (error) throw error;

      toast.success('Deposit rejected');
      loadPendingDeposits(); // Refresh list
    } catch (error) {
      console.error('Error rejecting deposit:', error);
      toast.error('Failed to reject deposit');
    }
  };

  const getImageUrl = async (path: string) => {
    const { data } = await supabase.storage
      .from('deposit-screenshots')
      .createSignedUrl(path, 3600); // 1 hour expiry
    return data?.signedUrl;
  };

  const openImage = async (path: string) => {
    const url = await getImageUrl(path);
    if (url) {
      window.open(url, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Loading pending deposits...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Crypto Deposit Approval</h1>
        <p className="text-muted-foreground">Review and approve pending crypto deposits</p>
      </div>

      <div className="grid gap-4">
        {deposits.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">No pending crypto deposits</p>
            </CardContent>
          </Card>
        ) : (
          deposits.map((deposit) => (
            <Card key={deposit.id} className="shadow-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {deposit.profiles?.full_name || 'Unknown User'}
                  </CardTitle>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="font-semibold">${(deposit.amount_usd_cents / 100).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">TX Hash</p>
                    <p className="font-mono text-sm truncate">{deposit.tx_hash}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="text-sm">{new Date(deposit.created_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Actions</p>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openImage(deposit.screenshot_url)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    variant="default" 
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(deposit.id, deposit.amount_usd_cents)}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handleReject(deposit.id)}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CryptoApproval;