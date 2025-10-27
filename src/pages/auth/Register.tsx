import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { auth, db } from '@/integrations/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, updateDoc, increment } from 'firebase/firestore';

// Simple 8-character referral code generator
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) {
      setFormData(prev => ({ ...prev, referralCode: refParam }));
    }
  }, [searchParams]);

  const handleReferralBonus = async (referralCode: string) => {
    const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
    const snapshot = await getDocs(q);
    snapshot.forEach(async (docSnap) => {
      await updateDoc(doc(db, 'users', docSnap.id), { balance: increment(1000) });
    });
  };

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.phone || !formData.password || !formData.confirmPassword) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    // Simple phone format check
    const cleanPhone = formData.phone.replace(/\s/g, '');
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(cleanPhone)) {
      toast.error('Enter a valid phone number (e.g., +1234567890)');
      return;
    }

    setLoading(true);
    try {
      const dummyEmail = `${cleanPhone}@lunorise.app`;
      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, formData.password);
      const user = userCredential.user;

      const myReferralCode = generateReferralCode();
      await setDoc(doc(db, 'users', user.uid), {
        phone: formData.phone,
        balance: 0,
        referralCode: myReferralCode,
        referrerCode: formData.referralCode || null,
        createdAt: new Date(),
        authMethod: 'phone'
      });

      if (formData.referralCode) {
        await handleReferralBonus(formData.referralCode);
      }

      toast.success('Account created successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This phone number is already registered.');
      } else {
        toast.error(error.message || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="relative min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white"></div>
            <span className="ml-4 text-white text-lg">Loading...</span>
          </div>
        )}

        <Card className="w-full max-w-md z-10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>Join Luno Rise and start earning today</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handlePhoneSignUp} className="space-y-4">
              <div>
                <Label>Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">Include country code</p>
              </div>

              <div>
                <Label>Password <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Confirm Password <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              <div>
                <Label>Referral Code (Optional)</Label>
                <Input
                  type="text"
                  value={formData.referralCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, referralCode: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary_gradient"
                disabled={loading}
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/auth/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Register;