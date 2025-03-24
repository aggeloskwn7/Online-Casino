import React from 'react';
import { Helmet } from 'react-helmet-async';
import PlinkoGame from '@/components/games/plinko-game';
import { ScrollArea } from '@/components/ui/scroll-area';
import Sidebar from '@/components/ui/sidebar';
import TransactionHistory from '@/components/transaction-history';
import MobileNav from '@/components/ui/mobile-nav';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';

export default function PlinkoPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-4 md:p-6">
            <div className="max-w-6xl mx-auto space-y-6">
              <h1 className="text-3xl font-bold tracking-tight mb-8">Plinko</h1>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Game area */}
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm">
                    <div className="p-4">
                      <PlinkoGame />
                    </div>
                  </div>
                </div>

                {/* Transaction history */}
                <div className="space-y-6">
                  <div className="bg-card rounded-lg border shadow-sm">
                    <div className="p-4">
                      <h2 className="text-xl font-semibold mb-4">Recent Games</h2>
                      <ScrollArea className="h-[400px] pr-4">
                        <TransactionHistory gameType="plinko" maxItems={25} />
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}