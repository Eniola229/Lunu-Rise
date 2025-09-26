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
    <div className="min-h-screen bg-gradient-primary text-primary-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold">
                Welcome to <span className="text-secondary">Luno Rise</span>
              </h1>
              <p className="text-xl md:text-2xl text-primary-foreground/80 max-w-2xl mx-auto">
                Smart investment platform with guaranteed daily returns. Start earning today with as little as $5.
              </p>
            </div>

            {/* Benefit Chips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <Card key={index} className="bg-card/10 border-primary-foreground/20 backdrop-blur-sm p-6 text-center">
                    <Icon className="h-12 w-12 mx-auto mb-4 text-secondary" />
                    <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
                    <p className="text-primary-foreground/70">{benefit.description}</p>
                  </Card>
                );
              })}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-12">
              <Button
                size="lg"
                variant="success"
                onClick={() => navigate('/auth/register')}
                className="text-lg px-8 py-3"
              >
                Sign Up Now
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/auth/login')}
                className="text-lg px-8 py-3 border-white text-white hover:bg-white hover:text-primary bg-white/10 backdrop-blur-sm"
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