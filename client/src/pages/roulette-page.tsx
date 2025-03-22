import MainLayout from "@/components/layouts/main-layout";
import RouletteGame from "@/components/games/roulette-game";
import TransactionHistory from "@/components/transaction-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef } from "react";

export default function RoulettePage() {
  const pageRef = useRef<HTMLDivElement>(null);
  
  // Scroll to top when page loads
  useEffect(() => {
    if (pageRef.current) {
      pageRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);
  
  return (
    <MainLayout>
      <div ref={pageRef} className="container px-4 py-8 mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-8">Roulette</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card className="border-none shadow-lg bg-transparent">
              <CardHeader className="p-4 border-b border-[#333333]">
                <CardTitle className="text-xl">Roulette Game</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RouletteGame />
              </CardContent>
            </Card>
          </div>
          
          <div className="lg:col-span-1">
            <Card className="border-none shadow-lg bg-transparent">
              <CardHeader className="p-4 border-b border-[#333333]">
                <CardTitle className="text-xl">History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TransactionHistory gameType="roulette" maxItems={10} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}