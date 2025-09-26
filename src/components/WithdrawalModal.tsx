import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, DollarSign, Percent } from 'lucide-react';
import { toast } from 'sonner';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  onSuccess: () => void;
}

interface UsdtRate {
  currency: string;
  rate: number;
}

const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  onSuccess
}) => {
  const { user } = useAuth();
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [loading, setLoading] = useState(false);
  const [usdtRate, setUsdtRate] = useState<UsdtRate | null>(null);
  // Payout method state
  const [bankDetails, setBankDetails] = useState({ bank_name: '', account_name: '', account_number: '' });
  const [usdtDetails, setUsdtDetails] = useState({ network: 'BEP20', wallet_address: '' });
  const [hasPayout, setHasPayout] = useState(false);

useEffect(() => {
  if (isOpen) {
    loadUsdtRate();
    loadPayoutMethod();
  }
}, [isOpen, currency]);

const loadUsdtRate = async () => {
  try {
    const { data, error } = await supabase
      .from('usdt_rates')
      .select('currency, rate')
      .eq('currency', 'NGN')
      .single();

    if (error) throw error;
    setUsdtRate(data);
  } catch (error) {
    console.error('Error loading USDT rate:', error);
  }
};

const loadPayoutMethod = async () => {
  if (!user) return;
  const type = currency === 'USD' ? 'usdt' : 'bank';
  try {
    const { data } = await supabase
      .from('payout_methods' as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('type', type)
      .maybeSingle();
    setHasPayout(!!data);
    if (data) {
      if (type === 'bank') setBankDetails({ bank_name: (data as any).bank_name || '', account_name: (data as any).account_name || '', account_number: (data as any).account_number || '' });
      else setUsdtDetails({ network: (data as any).usdt_network || 'BEP20', wallet_address: (data as any).wallet_address || '' });
    }
  } catch (error) {
    console.log('Error loading payout method:', error);
  }
};

  const calculateFee = (amountUSD: number, withdrawalCurrency: string): number => {
    if (withdrawalCurrency === 'USD') {
      return amountUSD * 0.08; // 8% fee for USD
    } else {
      return amountUSD * 0.15; // 15% fee for Naira
    }
  };

  const calculateNetAmount = (amountUSD: number, withdrawalCurrency: string): number => {
    const fee = calculateFee(amountUSD, withdrawalCurrency);
    return amountUSD - fee;
  };

  const formatUSD = (cents: number): string => {
    return `$${(cents / 100).toFixed(2)}`;
  };

const handleWithdraw = async () => {
  if (!user || !amount) return;

  const amountUSD = parseFloat(amount);
  const minWithdrawal = 2; // $2 minimum

  if (amountUSD < minWithdrawal) {
    toast.error(`Minimum withdrawal is $${minWithdrawal}`);
    return;
  }

  const maxWithdrawal = availableBalance / 100;
  if (amountUSD > maxWithdrawal) {
    toast.error(`Insufficient balance. Available: ${formatUSD(availableBalance)}`);
    return;
  }

  // Ensure payout details exist
  const type = currency === 'USD' ? 'usdt' : 'bank';
  if (!hasPayout) {
    toast.error(`Please add your ${type === 'bank' ? 'bank details' : 'USDT wallet'} before withdrawing`);
    return;
  }

  setLoading(true);

  try {
    const amountCents = Math.round(amountUSD * 100);
    const feeCents = Math.round(calculateFee(amountUSD, currency) * 100);

    // Reserve the withdrawal amount using the database function
    const { error: reserveError } = await supabase.rpc('reserve_withdrawal', {
      p_user_id: user.id,
      p_amount: amountCents,
      p_fee: feeCents
    });

    if (reserveError) {
      if (reserveError.message === 'insufficient_funds') {
        toast.error('Insufficient funds for this withdrawal');
      } else {
        throw reserveError;
      }
      return;
    }

    // Create withdrawal record
    const { error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert({
        user_id: user.id,
        amount_cents: amountCents,
        fee_cents: feeCents,
        net_cents: amountCents - feeCents,
        status: 'queued',
        local_currency: currency
      });

    if (withdrawalError) throw withdrawalError;

    toast.success('Withdrawal request submitted successfully!');
    onSuccess();
    onClose();
    setAmount('');
  } catch (error) {
    console.error('Error processing withdrawal:', error);
    toast.error('Failed to process withdrawal request');
  } finally {
    setLoading(false);
  }
};

  const amountUSD = parseFloat(amount) || 0;
  const fee = calculateFee(amountUSD, currency);
  const netAmount = calculateNetAmount(amountUSD, currency);
  const feePercentage = currency === 'USD' ? 8 : 15;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw Funds</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-info/10 border border-info/20 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-2">Withdrawal Information:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• Withdrawal time: 10am - 6pm daily</li>
                  <li>• Minimum withdrawal: $2</li>
                  <li>• Processing time: Up to 24 hours</li>
                  <li>• USD withdrawals: 8% fee</li>
                  <li>• Naira withdrawals: 15% fee</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="available">Available Balance</Label>
            <div className="font-semibold text-success text-lg">
              {formatUSD(availableBalance)}
            </div>
          </div>

          <div>
            <Label htmlFor="currency">Withdrawal Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="USD">USD (8% fee)</SelectItem>
                <SelectItem value="NGN">Naira (15% fee)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="amount">Withdrawal Amount (USD)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="2"
                max={availableBalance / 100}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10"
                placeholder="Enter amount"
              />
            </div>
          </div>

          {amountUSD > 0 && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm">Withdrawal Amount:</span>
                <span className="font-medium">${amountUSD.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm flex items-center">
                  <Percent className="h-3 w-3 mr-1" />
                  Fee ({feePercentage}%):
                </span>
                <span className="font-medium text-destructive">-${fee.toFixed(2)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Net Amount:</span>
                  <span className="font-bold text-success">${netAmount.toFixed(2)}</span>
                </div>
                {currency === 'NGN' && usdtRate && (
                  <div className="text-xs text-muted-foreground mt-1">
                    ≈ ₦{(netAmount * usdtRate.rate).toLocaleString('en-NG')} (Rate: ₦{usdtRate.rate}/USD)
                  </div>
                )}
              </div>
            </div>
          )}

{/* Payout details (required once) */}
<div className="space-y-3 border rounded-lg p-3">
  {currency === 'NGN' ? (
    <>
      <Label>Bank Details</Label>
      <Input placeholder="Bank Name" value={bankDetails.bank_name} onChange={(e) => setBankDetails({ ...bankDetails, bank_name: e.target.value })} />
      <Input placeholder="Account Name" value={bankDetails.account_name} onChange={(e) => setBankDetails({ ...bankDetails, account_name: e.target.value })} />
      <Input placeholder="Account Number" value={bankDetails.account_number} onChange={(e) => setBankDetails({ ...bankDetails, account_number: e.target.value })} />
      <Button
        variant="outline"
        onClick={async () => {
          if (!user) return;
          if (!bankDetails.bank_name || !bankDetails.account_name || !bankDetails.account_number) {
            toast.error('Please fill all bank details');
            return;
          }
          const { error } = await supabase.from('payout_methods' as any).upsert({
            user_id: user.id,
            type: 'bank',
            bank_name: bankDetails.bank_name,
            account_name: bankDetails.account_name,
            account_number: bankDetails.account_number
          }, { onConflict: 'user_id,type' });
          if (error) toast.error('Failed to save bank details'); else { toast.success('Bank details saved'); setHasPayout(true); }
        }}
      >Save Bank Details</Button>
    </>
  ) : (
    <>
      <Label>USDT Wallet (BEP20)</Label>
      <Select value={usdtDetails.network} onValueChange={(v) => setUsdtDetails({ ...usdtDetails, network: v })}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="BEP20">BEP20 (BNB Chain)</SelectItem>
          <SelectItem value="TRC20">TRC20 (Tron)</SelectItem>
          <SelectItem value="ERC20">ERC20 (Ethereum)</SelectItem>
        </SelectContent>
      </Select>
      <Input placeholder="USDT Wallet Address" value={usdtDetails.wallet_address} onChange={(e) => setUsdtDetails({ ...usdtDetails, wallet_address: e.target.value })} />
      <Button
        variant="outline"
        onClick={async () => {
          if (!user) return;
          if (!usdtDetails.wallet_address) { toast.error('Please enter your USDT wallet'); return; }
          const { error } = await supabase.from('payout_methods' as any).upsert({
            user_id: user.id,
            type: 'usdt',
            usdt_network: usdtDetails.network,
            wallet_address: usdtDetails.wallet_address
          }, { onConflict: 'user_id,type' });
          if (error) toast.error('Failed to save wallet'); else { toast.success('USDT wallet saved'); setHasPayout(true); }
        }}
      >Save USDT Wallet</Button>
    </>
  )}
</div>

<div className="flex gap-3">
  <Button
    variant="outline"
    onClick={onClose}
    className="flex-1"
  >
    Cancel
  </Button>
  <Button
    onClick={handleWithdraw}
    disabled={loading || !amount || amountUSD < 2}
    className="flex-1"
    variant="primary_gradient"
  >
    {loading ? 'Processing...' : 'Confirm Withdrawal'}
  </Button>
</div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default WithdrawalModal;