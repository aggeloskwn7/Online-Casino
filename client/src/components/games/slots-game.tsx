import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { SLOT_SYMBOLS } from '@/lib/game-utils';
import { SlotsPayout } from '@shared/schema';
import { motion, AnimatePresence } from 'framer-motion';

export default function SlotsGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const [betAmount, setBetAmount] = useState(1);
  const [symbols, setSymbols] = useState<string[][]>([
    ['🍒', '🍋', '🍊'],
    ['🍇', '🔔', '💎'],
    ['7️⃣', '🍀', '⭐']
  ]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SlotsPayout | null>(null);
  const [highlightedCells, setHighlightedCells] = useState<[number, number][]>([]);
  const [showWinMessage, setShowWinMessage] = useState(false);
  
  // Play slots mutation
  const slotsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest('POST', '/api/games/slots', { amount });
      return await res.json();
    },
    onSuccess: (data: SlotsPayout) => {
      // Set the result
      setLastResult(data);
      
      // Update the symbols with animation
      animateSlots(data.symbols);
      
      // Highlight winning lines if any
      if (data.winningLines && data.winningLines.length > 0) {
        // Extract the cell coordinates from winning lines to highlight
        const cells: [number, number][] = [];
        data.winningLines.forEach(line => {
          // Each line contains 6 values: [row1, col1, row2, col2, row3, col3]
          for (let i = 0; i < line.length; i += 2) {
            cells.push([line[i], line[i+1]]);
          }
        });
        setHighlightedCells(cells);
      } else {
        setHighlightedCells([]);
      }
      
      // Only refresh balance after animation completes
      // This prevents spoiling the win/loss before animation ends
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsSpinning(false);
    },
  });
  
  const animateSlots = (finalSymbols: string[][]) => {
    // Start with random symbols
    let spins = 0;
    const maxSpins = 20; // Number of animation frames
    const spinInterval = 80; // ms between frames
    const finalSpinInterval = 150; // slower at the end
    
    const spin = () => {
      spins++;
      
      if (spins < maxSpins) {
        // Random symbols during spinning
        const randomSymbols = Array(3).fill(null).map(() => 
          Array(3).fill(null).map(() => 
            SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
          )
        );
        setSymbols(randomSymbols);
        
        // Continue spinning
        setTimeout(spin, spinInterval);
      } else if (spins === maxSpins) {
        // Start setting final symbols row by row
        setSymbols([
          finalSymbols[0],
          symbols[1],
          symbols[2]
        ]);
        setTimeout(spin, finalSpinInterval);
      } else if (spins === maxSpins + 1) {
        setSymbols([
          finalSymbols[0],
          finalSymbols[1],
          symbols[2]
        ]);
        setTimeout(spin, finalSpinInterval);
      } else {
        // Set all symbols to final
        setSymbols(finalSymbols);
        setIsSpinning(false);
        
        // Show win message after spinning completes with a short delay
        setTimeout(() => {
          // Update user data (balance) only now after animation is complete
          // This prevents spoiling the win/loss by seeing balance change early
          queryClient.invalidateQueries({ queryKey: ['/api/user'] });
          
          // Play sound based on win/lose
          if (lastResult?.isWin) {
            play('win');
          } else {
            play('lose');
          }
          
          setShowWinMessage(true);
        }, 300);
      }
    };
    
    // Start spinning
    spin();
  };
  
  const handleSpin = () => {
    // Validate bet amount
    if (!user || betAmount <= 0 || betAmount > Number(user.balance)) {
      toast({
        title: 'Invalid bet',
        description: 'Please enter a valid bet amount',
        variant: 'destructive',
      });
      return;
    }
    
    // Start spinning
    setIsSpinning(true);
    setHighlightedCells([]); // Clear any highlighted cells
    setShowWinMessage(false); // Hide win message while spinning
    play('slotSpin');
    
    // Make API call
    slotsMutation.mutate(betAmount);
  };
  
  const handleBetChange = (value: number[]) => {
    setBetAmount(value[0]);
  };
  
  const adjustBet = (amount: number) => {
    // If current bet is small, adjust by smaller amounts
    const adjustAmount = betAmount < 1 ? 0.1 : 
                      betAmount < 10 ? 1 : 
                      betAmount < 100 ? 10 : 
                      betAmount < 1000 ? 100 : 1000;
    
    const increment = amount > 0 ? adjustAmount : -adjustAmount;
    const newBet = Math.max(0.1, Math.min(10000, betAmount + increment));
    setBetAmount(Math.round(newBet * 100) / 100); // Round to 2 decimal places
  };
  
  // Function to check if a cell should be highlighted
  const isCellHighlighted = (row: number, col: number): boolean => {
    return highlightedCells.some(cell => cell[0] === row && cell[1] === col);
  };
  
  return (
    <div className="bg-[#2A2A2A] p-4 rounded-xl">
      <div className="grid grid-rows-3 gap-2 mb-4">
        {symbols.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-3 gap-2">
            {row.map((symbol, colIndex) => (
              <div 
                key={`${rowIndex}-${colIndex}`} 
                className={`aspect-square flex items-center justify-center slot-reel bg-[#121212] rounded-lg ${
                  isCellHighlighted(rowIndex, colIndex) ? 'border-2 border-[#FFD700] animate-pulse' : ''
                }`}
              >
                <div className="slot-symbol text-4xl">{symbol}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">Bet Amount</span>
          <div className="flex items-center gap-2">
            <button 
              className="w-6 h-6 bg-[#121212] rounded flex items-center justify-center text-gray-400 hover:text-white"
              onClick={() => adjustBet(-10)}
              disabled={isSpinning}
            >
              -
            </button>
            <span className="font-mono">{formatCurrency(betAmount)}</span>
            <button 
              className="w-6 h-6 bg-[#121212] rounded flex items-center justify-center text-gray-400 hover:text-white"
              onClick={() => adjustBet(10)}
              disabled={isSpinning}
            >
              +
            </button>
          </div>
        </div>
        <Slider 
          defaultValue={[1]} 
          min={0.10} 
          max={10000} 
          step={0.10}
          value={[betAmount]}
          onValueChange={handleBetChange}
          disabled={isSpinning}
          className="w-full"
        />
      </div>
      
      <Button
        className="w-full bg-[#5465FF] hover:bg-[#6677FF] text-white font-bold py-3 px-4 rounded-lg transition duration-200"
        onClick={handleSpin}
        disabled={isSpinning || !user || betAmount > Number(user.balance)}
      >
        {isSpinning ? 'SPINNING...' : 'SPIN'}
      </Button>
      
      <AnimatePresence>
        {lastResult && lastResult.isWin && showWinMessage && (
          <motion.div 
            className="mt-4 p-3 bg-[#121212] rounded-lg text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-[#00E701] font-bold mb-1"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              YOU WON!
            </motion.div>
            <motion.div 
              className="font-mono text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {formatCurrency(lastResult.payout)}
            </motion.div>
            <motion.div 
              className="text-sm text-gray-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              Multiplier: {lastResult.multiplier.toFixed(2)}x
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}