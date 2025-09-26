import { ArrowRight, Shield, TrendingUp, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const Landing = () => {
  const navigate = useNavigate();

  const benefits = [
    {
      icon: Shield,
      title: "Secure Investment",
      description: "Get small regular payouts every 22 hours — start from $5"
    },
    {
      icon: TrendingUp,
      title: "Guaranteed Returns",
      description: "Earn up to 300% returns on your investment plans"
    },
    {
      icon: Clock,
      title: "Daily Drops",
      description: "Regular income drops delivered straight to your wallet"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center space-y-10">
            <div className="space-y-6">
              <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                Welcome to <span className="text-secondary">Luno Rise</span>
              </h1>
              <p className="text-lg md:text-2xl text-primary-foreground/80 max-w-2xl mx-auto leading-relaxed">
                Smart investment platform with guaranteed daily returns. 
                Start earning today with as little as <span className="font-bold text-secondary">$5</span>.
              </p>
            </div>

            {/* Benefit Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mt-12">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <Card
                    key={index}
                    className="bg-white/10 border border-white/20 backdrop-blur-md p-8 text-center rounded-2xl shadow-lg transition-transform duration-300 hover:scale-105 hover:shadow-2xl"
                  >
                    <div className="flex flex-col items-center">
                      <Icon className="h-12 w-12 mb-4 text-secondary" />
                      <h3 className="text-xl font-semibold mb-2">{benefit.title}</h3>
                      <p className="text-primary-foreground/70">{benefit.description}</p>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-14">
              <Button
                size="lg"
                variant="success"
                onClick={() => navigate('/auth/register')}
                className="text-lg px-10 py-4 rounded-full shadow-md hover:shadow-xl transition-all duration-300"
              >
                Sign Up Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/auth/login')}
                className="text-lg px-10 py-4 rounded-full border-white text-white hover:bg-white hover:text-primary bg-white/10 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-300"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Landing;
