import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatMultiplier } from "@/lib/game-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { getQueryFn } from "@/lib/queryClient";
import { Transaction, RouletteResult } from "@shared/schema";
import { ROULETTE_COLORS } from "@/lib/game-utils";

export default function RouletteHistory() {
  // Fetch the roulette game transactions
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">No game history yet</p>
        <p className="text-sm text-gray-500 mt-2">Place a bet and spin the wheel</p>
      </div>
    );
  }

  // Filter and only show roulette games, sorted by most recent
  const rouletteGames = transactions
    .filter(t => t.gameType === "roulette")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="divide-y divide-[#333333]">
      {rouletteGames.map((game, index) => {
        const isWin = game.isWin;
        // Default values for display if we can't infer from the transaction
        let spin = 0;
        let color: 'red' | 'black' | 'green' = 'black';
        let betType = 'unknown';
        
        // Try to determine the result from the game's last spin
        if (Number(game.multiplier) > 0) {
          // Get approximate bet type based on multiplier
          const multiplierNum = Number(game.multiplier);
          if (multiplierNum >= 35) betType = 'straight';
          else if (multiplierNum >= 17) betType = 'split';
          else if (multiplierNum >= 11) betType = 'street';
          else if (multiplierNum >= 8) betType = 'corner';
          else if (multiplierNum >= 5) betType = 'line';
          else if (multiplierNum >= 2) betType = 'dozen';
          else betType = 'outside';
        }
        
        return (
          <motion.div 
            key={game.id} 
            className="p-4 bg-[#1A1A1A] hover:bg-[#222222] transition-colors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 flex items-center justify-center text-white font-bold rounded-full ${
                  isWin ? 'bg-gradient-to-b from-[#00A000] to-[#008000]' : 'bg-gradient-to-b from-[#E03C3C] to-[#C92A2A]'
                }`}>
                  {isWin ? '✓' : '✗'}
                </div>
                <div>
                  <div className="font-medium">
                    {betType.charAt(0).toUpperCase() + betType.slice(1)} Bet
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(game.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-medium ${isWin ? 'text-[#00E701]' : 'text-[#E03C3C]'}`}>
                  {isWin ? '+' : '-'}{formatCurrency(Math.abs(Number(game.payout)))}
                </div>
                <div className="text-xs text-gray-400">
                  {formatMultiplier(Number(game.multiplier))}x multiplier
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}