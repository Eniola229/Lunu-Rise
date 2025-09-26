import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import Layout from '@/components/Layout';
import { CountrySelector } from '@/components/CountrySelector';
import { auth, googleProvider, appleProvider, db } from '@/integrations/firebase';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // AuthContext
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    country: ''
  });

  // Redirect automatically if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.country) {
      toast.error('Please select your country');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const loggedUser = userCredential.user;

      if (!loggedUser.emailVerified) {
        toast.error('Please verify your email before logging in.');
        return;
      }

      toast.success('Login successful!');
      // navigation will be triggered by AuthContext effect
    } catch (error: any) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        toast.error('Invalid email or password.');
      } else {
        toast.error(error.message || 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: typeof googleProvider | typeof appleProvider) => {
    setLoading(true);
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const loggedUser = userCredential.user;

      // Check if user exists in Firestore
      const q = query(collection(db, 'users'), where('email', '==', loggedUser.email));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        toast.error('User does not exist. Please register first.');
        return;
      }

      toast.success('Login successful!');
      // navigation will be triggered by AuthContext effect
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Login cancelled. You closed the popup.');
      } else if (error.code === 'auth/account-exists-with-different-credential') {
        toast.error('An account already exists with the same email but different sign-in method.');
      } else {
        toast.error(error.message || 'Login failed');
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
            <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>Sign in to your account</CardDescription>
          </CardHeader>
          <CardContent>
            {/* OAuth Buttons */}
            <Button
              onClick={() => handleOAuthLogin(googleProvider)}
              className="w-full mb-2"
              variant="secondary"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Login with Google'}
            </Button>
            <Button
              onClick={() => handleOAuthLogin(appleProvider)}
              className="w-full mb-4"
              variant="secondary"
              disabled={loading}
            >
              {loading ? 'Loading...' : 'Login with Apple'}
            </Button>

            {/* Email login form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <Label htmlFor="country">Country</Label>
                <CountrySelector
                  value={formData.country}
                  onValueChange={(country) => setFormData(prev => ({ ...prev, country }))}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Enter email"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="primary_gradient"
                disabled={loading || !formData.country}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 space-y-4">
              <div className="text-center">
                <Link to="/auth/forgot-password" className="text-sm text-primary hover:underline">
                  Forgot your password?
                </Link>
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to="/auth/register" className="text-primary hover:underline">
                    Sign up
                  </Link>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Login;
