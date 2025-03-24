import React from 'react';
import { Helmet } from 'react-helmet-async';
import PlinkoGame from '@/components/games/plinko-game';
import { PlinkoControls } from '@/components/games/plinko-controls';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from '@/components/ui/sidebar';
import TransactionHistory from '@/components/transaction-history';
import MobileNav from '@/components/ui/mobile-nav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { PlinkoResult } from '@/types/plinko-types';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

// Quick Login Form Component
function QuickLoginForm() {
  const { loginMutation } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ username, password });
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <CardTitle>Quick Login</CardTitle>
        <CardDescription>You need to login to play Plinko</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium">Username</label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>
          <Button 
            type="submit" 
            className="w-full"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? 'Logging in...' : 'Login'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function PlinkoPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gameResult, setGameResult] = useState<PlinkoResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHistory, setShowHistory] = useState(true); // Initially show history
  
  // Hide history during animation and show it again after
  React.useEffect(() => {
    if (isAnimating) {
      // Hide history while animation is in progress
      setShowHistory(false);
    } else if (gameResult) {
      // After animation completes (isAnimating becomes false)
      // Wait a bit longer to make sure user sees the result first
      const timer = setTimeout(() => {
        setShowHistory(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, gameResult]);

  return (
    <>
      <Helmet>
        <title>Plinko Game | Casino</title>
      </Helmet>

      <div className="flex min-h-screen bg-background">
        {/* Sidebar for desktop */}
        {!isMobile && <Sidebar />}

        {/* Mobile sidebar - conditionally rendered */}
        {isMobile && sidebarOpen && (
          <div className="fixed inset-0 z-50 bg-background">
            <Sidebar mobile onClose={() => setSidebarOpen(false)} />
          </div>
        )}

        {/* Mobile top navigation */}
        {isMobile && (
          <MobileNav type="top" onMenuClick={() => setSidebarOpen(true)} />
        )}

        {/* Main content - FAR AWAY from sidebar */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 pt-16 md:p-6 md:pt-16 lg:pl-[260px] lg:pt-8">
            <div className="max-w-7xl mx-auto space-y-6">
              <h1 className="text-3xl font-bold tracking-tight mb-8">Plinko</h1>
              
              {/* Show login form if user is not authenticated */}
              {!user ? (
                <div className="max-w-md mx-auto">
                  <QuickLoginForm />
                  <div className="text-center text-muted-foreground mt-4">
                    <p>Please login to play Plinko and other games.</p>
                    <p className="mt-2">Username: <strong>aggeloskwn</strong>, Password: <strong>admin</strong></p>
                  </div>
                </div>
              ) : (
                /* Game board and controls side by side - only shown when logged in */
                <div className="grid grid-cols-12 gap-6 mb-8">
                  {/* Game board */}
                  <div className="col-span-12 lg:col-span-8 bg-card rounded-lg border shadow-sm overflow-hidden">
                    <PlinkoGame 
                      externalResult={gameResult}
                      onAnimatingChange={setIsAnimating}
                    />
                  </div>
                  
                  {/* Controls right next to the board */}
                  <div className="col-span-12 lg:col-span-4">
                    <PlinkoControls 
                      onBetPlaced={setGameResult}
                      isAnimating={isAnimating}
                    />
                  </div>
                </div>
              )}
              
              {/* Recent games BELOW everything - conditionally shown when logged in and not animating */}
              {user && showHistory && (
                <div className="w-full bg-card rounded-lg border shadow-sm">
                  <div className="p-4">
                    <h2 className="text-xl font-semibold mb-4">Recent Games</h2>
                    <ScrollArea className="h-[300px] pr-4">
                      <TransactionHistory gameType="plinko" maxItems={25} />
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}