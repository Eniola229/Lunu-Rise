import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { CountrySelector } from '@/components/CountrySelector';
import { auth, db, googleProvider, appleProvider } from '@/integrations/firebase';
import { createUserWithEmailAndPassword, sendEmailVerification, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDocs, collection, query, where, updateDoc, increment } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { FcGoogle } from "react-icons/fc";
import { FaApple } from "react-icons/fa";

// Simple 8-character referral code generator
const generateReferralCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
};

const Register = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    country: '',
    referralCode: ''
  });

  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam) setFormData(prev => ({ ...prev, referralCode: refParam }));
  }, [searchParams]);

  const handleReferralBonus = async (referralCode: string) => {
    const q = query(collection(db, 'users'), where('referralCode', '==', referralCode));
    const snapshot = await getDocs(q);
    snapshot.forEach(async docSnap => {
      await updateDoc(doc(db, 'users', docSnap.id), { balance: increment(1000) });
    });
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.country) {
      toast.error('Please fill all required fields');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      await sendEmailVerification(user);

      const myReferralCode = generateReferralCode();
      await setDoc(doc(db, 'users', user.uid), {
        email: formData.email,
        phone: formData.phone,
        country: formData.country,
        balance: 0,
        referralCode: myReferralCode,
        referrerCode: formData.referralCode || null,
        createdAt: new Date()
      });

      if (formData.referralCode) await handleReferralBonus(formData.referralCode);

      toast.success('Account created! Check your email for verification.');
      navigate('/auth/login');
    } catch (error: any) {
      toast.error(error.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: typeof googleProvider | typeof appleProvider) => {
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;

      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        const myReferralCode = generateReferralCode();
        await setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          phone: user.phoneNumber || '',
          country: '',
          balance: 0,
          referralCode: myReferralCode,
          referrerCode: searchParams.get('ref') || null,
          createdAt: new Date()
        });

        const ref = searchParams.get('ref');
        if (ref) await handleReferralBonus(ref);
      }

      toast.success('Logged in successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelled. You closed the popup.');
      } else {
        toast.error(error.message || 'Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout showBottomNav={false}>
      <div className="relative min-h-screen bg-gradient-primary flex items-center justify-center p-4">
        {/* Spinner Overlay */}
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
          <div className="flex justify-center gap-4">
            <Button
              onClick={() => handleOAuthSignIn(googleProvider)}
              className="flex items-center justify-center p-3 rounded-full border hover:bg-gray-100 transition"
              variant="secondary"
              disabled={loading}
            >
              {loading ? (
                <span className="animate-pulse text-sm">...</span>
              ) : (
                <FcGoogle className="text-2xl" />
              )}
            </Button>

            <Button
              onClick={() => handleOAuthSignIn(appleProvider)}
              className="flex items-center justify-center p-3 rounded-full border hover:bg-gray-100 transition"
              variant="secondary"
              disabled={loading}
            >
              {loading ? (
                <span className="animate-pulse text-sm">...</span>
              ) : (
                <FaApple className="text-2xl text-black" />
              )}
            </Button>
          </div>

            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div>
                <Label>Country</Label>
                <CountrySelector
                  value={formData.country}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input id="email" type="email" value={formData.email} onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))} required />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input id="phone" type="tel" value={formData.phone} onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))} required />
              </div>
              <div>
                <Label>Password</Label>
                <Input id="password" type="password" value={formData.password} onChange={e => setFormData(prev => ({ ...prev, password: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <Label>Confirm Password</Label>
                <Input id="confirmPassword" type="password" value={formData.confirmPassword} onChange={e => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} required minLength={6} />
              </div>
              <div>
                <Label>Referral Code (Optional)</Label>
                <Input id="referralCode" type="text" value={formData.referralCode} onChange={e => setFormData(prev => ({ ...prev, referralCode: e.target.value }))} />
              </div>

              <Button type="submit" className="w-full" variant="primary_gradient" disabled={loading || !formData.country}>
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Already have an account? <Link to="/auth/login" className="text-primary hover:underline">Sign in</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Register;
