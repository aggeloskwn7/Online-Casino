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

// PlinkoResult interface for passing between components
interface PlinkoResult {
  isWin: boolean;
  amount: number;
  payout: number;
  multiplier: number;
  path: { row: number, position: number }[];
}

export default function PlinkoPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [gameResult, setGameResult] = useState<PlinkoResult | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

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
              
              {/* Game board and controls side by side */}
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
              
              {/* Recent games BELOW everything */}
              <div className="w-full bg-card rounded-lg border shadow-sm">
                <div className="p-4">
                  <h2 className="text-xl font-semibold mb-4">Recent Games</h2>
                  <ScrollArea className="h-[300px] pr-4">
                    <TransactionHistory gameType="plinko" maxItems={25} />
                  </ScrollArea>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}