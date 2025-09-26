// src/components/PaymentModalFake.tsx
import { useState } from 'react';
import { CreditCard, Smartphone, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '@/integrations/firebase'; // <--- Make sure db is imported
import usdtQrCode from '@/assets/usdt-qr-code.png';

interface Plan {
  id: string;
  name: string;
  deposit_usd: number;
  payout_per_drop_usd: number;
  drops_count: number;
  total_return_usd: number;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
}

// Helpers
const formatCardNumber = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

const formatExpiry = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
};

const PaymentModalFake = ({ isOpen, onClose, plan }: PaymentModalProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [paymentMethod, setPaymentMethod] = useState<'fakeStripe' | 'crypto'>('fakeStripe');
  const [loading, setLoading] = useState(false);

  const [cardForm, setCardForm] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    cardholder: '',
    confirmTerms: false
  });

  const [cryptoForm, setCryptoForm] = useState({
    currency: 'USDT',
    amountCrypto: '',
    txHash: '',
    proofFile: null as File | null,
    note: '',
    confirmTerms: false
  });

  const formatUSD = (usd: number) => `$${usd.toFixed(2)}`;

  // Fake Stripe Payment
  const handleFakeStripePayment = async () => {
    if (!user?.email) return;

    const cardNumberDigits = cardForm.cardNumber.replace(/\s/g, '');
    const expiryValid = /^\d{2}\/\d{2}$/.test(cardForm.expiry);
    const cvcValid = /^\d{3}$/.test(cardForm.cvc); // <-- Only 3 digits now

    if (
      cardNumberDigits.length !== 16 ||
      !expiryValid ||
      !cvcValid ||
      !cardForm.cardholder ||
      !cardForm.confirmTerms
    ) {
      return toast.error('Invalid card details or terms not confirmed');
    }

    setLoading(true);
    try {
      await new Promise(res => setTimeout(res, 1000));

      // Save transaction
      const txRef = await addDoc(collection(db, 'transactions'), {
        userEmail: user.email,
        planId: plan.id,
        amount_usd: plan.deposit_usd,
        type: 'deposit',
        method: 'Stripe',
        status: 'success',
        card: {
          last4: cardNumberDigits.slice(-4),
          expiry: cardForm.expiry
        },
        createdAt: serverTimestamp()
      });

      // Save investment
      await addDoc(collection(db, 'investments'), {
        userEmail: user.email,
        planId: plan.id,
        transactionId: txRef.id,
        deposit_usd: plan.deposit_usd,
        payout_per_drop_usd: plan.payout_per_drop_usd,
        drops_count: plan.drops_count,
        total_return_usd: plan.total_return_usd,
        status: 'active',
        createdAt: serverTimestamp()
      });

      toast.success('Payment submitted and investment created!');
      onClose();
      setCardForm({ cardNumber: '', expiry: '', cvc: '', cardholder: '', confirmTerms: false });
      navigate('/transactions');
    } catch (err) {
      console.error(err);
      toast.error('Payment failed');
    } finally {
      setLoading(false);
    }
  };

  // Crypto Submit
  const handleCryptoSubmit = async () => {
    if (!cryptoForm.txHash || !cryptoForm.proofFile || !cryptoForm.confirmTerms) {
      toast.error('Fill all required fields and confirm terms');
      return;
    }

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(',')[1];

        const txRef = await addDoc(collection(db, 'transactions'), {
          userEmail: user?.email || 'anonymous',
          planId: plan.id,
          amountCrypto: cryptoForm.amountCrypto || null,
          currency: cryptoForm.currency,
          txHash: cryptoForm.txHash,
          proofFile: { data: base64Data, name: cryptoForm.proofFile?.name, type: cryptoForm.proofFile?.type },
          note: cryptoForm.note,
          type: 'deposit',
          method: 'crypto',
          status: 'success',
          createdAt: serverTimestamp()
        });

        await addDoc(collection(db, 'investments'), {
          userEmail: user?.email || 'anonymous',
          planId: plan.id,
          transactionId: txRef.id,
          deposit_usd: plan.deposit_usd,
          payout_per_drop_usd: plan.payout_per_drop_usd,
          drops_count: plan.drops_count,
          total_return_usd: plan.total_return_usd,
          status: 'active',
          createdAt: serverTimestamp()
        });

        toast.success('Crypto deposit submitted and investment created!');
        onClose();
        setCryptoForm({ currency: 'USDT', amountCrypto: '', txHash: '', proofFile: null, note: '', confirmTerms: false });
        navigate('/transactions');
      };
      reader.readAsDataURL(cryptoForm.proofFile!);
    } catch (err) {
      console.error(err);
      toast.error('Failed to submit crypto deposit');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) return toast.error('File size must be <5MB');
    if (!file.type.startsWith('image/')) return toast.error('Only image files allowed');

    setCryptoForm(prev => ({ ...prev, proofFile: file }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            Payment Options
          </DialogTitle>
        </DialogHeader>

        {/* Plan Summary */}
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">Investment Summary</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm">
            <div>Plan: <p className="font-medium">{plan.name}</p></div>
            <div>Amount: <p className="font-medium">{formatUSD(plan.deposit_usd)}</p></div>
          </CardContent>
        </Card>

        <Tabs value={paymentMethod} onValueChange={val => setPaymentMethod(val as any)}>
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="fakeStripe" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Card
            </TabsTrigger>
            <TabsTrigger value="crypto" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" /> Crypto
            </TabsTrigger>
          </TabsList>

          {/* Card Payment */}
          <TabsContent value="fakeStripe" className="space-y-2">
            <Input
              placeholder="Card Number"
              value={cardForm.cardNumber}
              onChange={e => setCardForm(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
            />
            <Input
              placeholder="Expiry MM/YY"
              value={cardForm.expiry}
              onChange={e => setCardForm(prev => ({ ...prev, expiry: formatExpiry(e.target.value) }))}
            />
            <Input
              placeholder="CVC"
              type="number"
              value={cardForm.cvc}
              onChange={e => setCardForm(prev => ({ ...prev, cvc: e.target.value.slice(0, 3) }))}
            />
            <Input
              placeholder="Cardholder Name"
              value={cardForm.cardholder}
              onChange={e => setCardForm(prev => ({ ...prev, cardholder: e.target.value }))}
            />
            <Checkbox
              id="confirmTerms"
              checked={cardForm.confirmTerms}
              onCheckedChange={c => setCardForm(prev => ({ ...prev, confirmTerms: c as boolean }))}
            />
            <Label htmlFor="confirmTerms" className="text-sm">I confirm this is my payment</Label>
            <Button className="w-full mt-2" onClick={handleFakeStripePayment} disabled={loading}>
              {loading ? 'Processing...' : 'Pay'}
            </Button>
          </TabsContent>

          {/* Crypto Payment */}
          <TabsContent value="crypto" className="space-y-2">
            <div className="text-center">
              <img src={usdtQrCode} className="mx-auto w-32 h-32 border rounded-lg" />
              <p className="text-xs text-muted-foreground mt-2">Scan QR or copy address: TPy...ghPDn</p>
            </div>
            <Select value={cryptoForm.currency} onValueChange={v => setCryptoForm(prev => ({ ...prev, currency: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="USDT">USDT</SelectItem>
                <SelectItem value="BTC">BTC</SelectItem>
                <SelectItem value="ETH">ETH</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              placeholder="Amount in Crypto (Optional)"
              value={cryptoForm.amountCrypto}
              onChange={e => setCryptoForm(prev => ({ ...prev, amountCrypto: e.target.value }))}
            />
            <Input
              placeholder="Transaction Hash *"
              value={cryptoForm.txHash}
              onChange={e => setCryptoForm(prev => ({ ...prev, txHash: e.target.value }))}
            />
            <Input type="file" accept="image/*" onChange={handleFileChange} />
            <Checkbox
              id="confirmCrypto"
              checked={cryptoForm.confirmTerms}
              onCheckedChange={c => setCryptoForm(prev => ({ ...prev, confirmTerms: c as boolean }))}
            />
            <Label htmlFor="confirmCrypto" className="text-sm">I confirm this is my transaction</Label>
            <Button
              className="w-full mt-2"
              onClick={handleCryptoSubmit}
              disabled={loading || !cryptoForm.txHash || !cryptoForm.proofFile || !cryptoForm.confirmTerms}
            >
              {loading ? 'Processing...' : 'Submit & Get 5% Bonus'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModalFake;
