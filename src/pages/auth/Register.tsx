import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { CountrySelector } from '@/components/CountrySelector';
import { auth, db } from '@/integrations/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, updateDoc, increment } from 'firebase/firestore';

// 8-character referral code
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
    name: '',
    phone: '',
    country: '',
    password: '',
    confirmPassword: '',
    referralCode: ''
  });

  // pre-fill referral from URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setFormData(prev => ({ ...prev, referralCode: ref }));
  }, [searchParams]);

  const handleReferralBonus = async (code: string) => {
    const q = query(collection(db, 'users'), where('referralCode', '==', code));
    const snap = await getDocs(q);
    snap.forEach(async d => {
      await updateDoc(doc(db, 'users', d.id), { balance: increment(1000) });
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) return toast.error('Enter your name');
    if (!formData.phone) return toast.error('Enter phone number');
    if (!formData.country) return toast.error('Select your country');
    if (formData.password !== formData.confirmPassword) return toast.error('Passwords do not match');
    if (formData.password.length < 6) return toast.error('Password ≥ 6 characters');

    const cleanPhone = formData.phone.replace(/\s/g, '');
    const phoneRe = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRe.test(cleanPhone)) return toast.error('Invalid phone number');

    setLoading(true);
    try {
      const dummyEmail = `${cleanPhone}@lunorise.app`;
      const cred = await createUserWithEmailAndPassword(auth, dummyEmail, formData.password);
      const uid = cred.user.uid;

      const myCode = generateReferralCode();
      await setDoc(doc(db, 'users', uid), {
        name: formData.name.trim(),
        phone: formData.phone,
        country: formData.country,
        balance: 0,
        referralCode: myCode,
        referrerCode: formData.referralCode || null,
        createdAt: new Date(),
        authMethod: 'phone'
      });

      if (formData.referralCode) await handleReferralBonus(formData.referralCode);

      toast.success('Account created!');
      navigate('/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use')
        toast.error('Phone number already registered');
      else toast.error(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="relative min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        {loading && (
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white" />
            <span className="ml-4 text-white text-lg">Loading...</span>
          </div>
        )}

        <Card className="w-full max-w-md z-10">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
            <CardDescription>Join Luno Rise and start earning today</CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <Label>Full Name <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  required
                  disabled={loading}
                />
              </div>

              {/* Phone */}
              <div>
                <Label>Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  type="tel"
                  placeholder="+1234567890"
                  value={formData.phone}
                  onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))}
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground mt-1">Include country code</p>
              </div>

              {/* Country */}
              <div>
                <Label>Country <span className="text-red-500">*</span></Label>
                <CountrySelector
                  value={formData.country}
                  onValueChange={c => setFormData(p => ({ ...p, country: c }))}
                  disabled={loading}
                />
              </div>

              {/* Password */}
              <div>
                <Label>Password <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <Label>Confirm Password <span className="text-red-500">*</span></Label>
                <Input
                  type="password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                  required
                  minLength={6}
                  disabled={loading}
                />
              </div>

              {/* Referral */}
              <div>
                <Label>Referral Code (Optional)</Label>
                <Input
                  type="text"
                  value={formData.referralCode}
                  onChange={e => setFormData(p => ({ ...p, referralCode: e.target.value }))}
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