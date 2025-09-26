import { useState } from 'react';
import { ArrowLeft, Upload, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import usdtQrCode from '@/assets/usdt-qr-code.png';

const CryptoDeposit = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [txHash, setTxHash] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const usdtAddress = '0x34FEcfBE68b7DC59aebdF42373aac8c9DdEcBd83';

  const handleCryptoDeposit = async () => {
    if (!amount || !txHash || !screenshot) {
      toast.error('Please provide amount, transaction hash and screenshot');
      return;
    }

    if (parseFloat(amount) < 5) {
      toast.error('Minimum deposit is $5 USDT');
      return;
    }

    setSubmitting(true);
    try {
      // Upload screenshot to Supabase Storage
      const fileExt = screenshot.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deposit-screenshots')
        .upload(fileName, screenshot);

      if (uploadError) throw uploadError;

      // Create crypto deposit record
      const { error: depositError } = await supabase
        .from('deposits')
        .insert({
          user_id: user?.id,
          plan_id: null, // Crypto deposits don't require plan selection
          amount_usd_cents: Math.floor(parseFloat(amount) * 100),
          method: 'crypto_manual',
          status: 'pending',
          tx_hash: txHash,
          screenshot_url: uploadData.path
        });

      if (depositError) throw depositError;

      toast.success('Crypto deposit submitted! You will receive 5% bonus. Processing in progress...');
      navigate('/wallet');
    } catch (error) {
      console.error('Error submitting crypto deposit:', error);
      toast.error('Failed to submit deposit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(usdtAddress);
    toast.success('Address copied to clipboard!');
  };

  return (
    <Layout showBottomNav={false}>
      <div className="min-h-screen bg-background">
        <div className="p-6 pt-12">
          <div className="flex items-center mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/plans')} className="mr-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Crypto Deposit</h1>
          </div>

          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>USDT (BEP20) Deposit</CardTitle>
              <p className="text-sm text-muted-foreground">
                Send USDT to the address below and get instant 5% bonus
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-success/10 border border-success/20 rounded-lg p-4">
                <h4 className="font-semibold text-success mb-2">🎉 Instant 5% Deposit Bonus</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Get instant 5% cash back</strong> when you deposit with USDT</li>
                  <li>• Only supported network is <strong>USDT BEP20</strong></li>
                  <li>• Send USDT BEP20 from any of your wallets to our address</li>
                  <li>• Ensure you use the matching network which is <strong>BEP20</strong></li>
                  <li>• Minimum deposit is <strong>$5</strong></li>
                  <li>• Any deposit(s) made below minimum will not be credited</li>
                  <li>• <strong>Automated verification — funds + 5% bonus apply after network confirmation</strong></li>
                </ul>
              </div>

              {/* QR Code */}
              <div className="text-center">
                <img src={usdtQrCode} alt="USDT BEP20 QR Code" className="w-48 h-48 mx-auto mb-4 rounded-lg" />
              </div>

              {/* Address */}
              <div>
                <Label>USDT (BEP20) Address</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input value={usdtAddress} readOnly className="font-mono text-sm" />
                  <Button size="icon" variant="outline" onClick={copyAddress}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ Only send USDT on BNB Chain (BEP20) network
                </p>
              </div>

              {/* Verification Form */}
              <div className="space-y-4 pt-4 border-t">
                <div>
                  <Label htmlFor="amount">Amount (USDT)</Label>
                  <Input 
                    id="amount" 
                    type="number"
                    min="5"
                    step="0.01"
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="Enter amount in USDT" 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum: $5 USDT
                  </p>
                </div>

                <div>
                  <Label htmlFor="txHash">Transaction Hash</Label>
                  <Input 
                    id="txHash" 
                    value={txHash} 
                    onChange={(e) => setTxHash(e.target.value)} 
                    placeholder="Enter transaction hash" 
                  />
                </div>

                <div>
                  <Label htmlFor="screenshot">Upload Screenshot</Label>
                  <Input 
                    id="screenshot" 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)} 
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Upload a clear screenshot of your transaction
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleCryptoDeposit} 
                  disabled={!amount || !txHash || !screenshot || submitting}
                >
                  {submitting ? 'Processing...' : 'Submit & Get 5% Bonus'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default CryptoDeposit;