import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import BottomNavigation from './BottomNavigation';

interface LayoutProps {
  children: ReactNode;
  showBottomNav?: boolean;
}

const Layout = ({ children, showBottomNav = true }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <main className={cn("pb-16", !showBottomNav && "pb-0")}>
        {children}
      </main>
      {showBottomNav && <BottomNavigation />}
    </div>
  );
};

export default Layout;