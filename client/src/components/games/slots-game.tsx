import { useState } from 'react';
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

export default function SlotsGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const [betAmount, setBetAmount] = useState(100);
  const [symbols, setSymbols] = useState<string[]>(['🍒', '🍋', '🍒']);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<SlotsPayout | null>(null);
  
  // Play slots mutation
  const slotsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const res = await apiRequest('POST', '/api/games/slots', { amount });
      return await res.json();
    },
    onSuccess: (data: SlotsPayout) => {
      // Update user data (balance)
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Set the result
      setLastResult(data);
      
      // Update the symbols with animation
      animateSlots(data.symbols);
      
      // Play sound based on win/lose
      if (data.isWin) {
        play('win');
      } else {
        play('lose');
      }
      
      // Show toast
      if (data.isWin) {
        toast({
          title: 'You won!',
          description: `You won ${formatCurrency(data.payout)} with multiplier ${data.multiplier.toFixed(2)}x`,
          variant: 'default',
        });
      } else {
        toast({
          title: 'You lost',
          description: `Better luck next time!`,
        });
      }
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
  
  const animateSlots = (finalSymbols: string[]) => {
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
          SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]
        );
        setSymbols(randomSymbols);
        
        // Continue spinning
        setTimeout(spin, spinInterval);
      } else if (spins === maxSpins) {
        // Set the first symbol to final
        setSymbols([finalSymbols[0], symbols[1], symbols[2]]);
        setTimeout(spin, finalSpinInterval);
      } else if (spins === maxSpins + 1) {
        // Set the second symbol to final
        setSymbols([finalSymbols[0], finalSymbols[1], symbols[2]]);
        setTimeout(spin, finalSpinInterval);
      } else {
        // Set all symbols to final
        setSymbols(finalSymbols);
        setIsSpinning(false);
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
    play('slotSpin');
    
    // Make API call
    slotsMutation.mutate(betAmount);
  };
  
  const handleBetChange = (value: number[]) => {
    setBetAmount(value[0]);
  };
  
  const adjustBet = (amount: number) => {
    const newBet = Math.max(10, Math.min(1000, betAmount + amount));
    setBetAmount(newBet);
  };
  
  return (
    <div className="bg-[#2A2A2A] p-4 rounded-xl">
      <div className="flex gap-2 mb-4">
        {symbols.map((symbol, index) => (
          <div key={index} className="flex-1 slot-reel bg-[#121212] rounded-lg">
            <div className="slot-symbol">{symbol}</div>
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
          defaultValue={[100]} 
          min={10} 
          max={1000} 
          step={10}
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
      
      {lastResult && lastResult.isWin && (
        <div className="mt-4 p-3 bg-[#121212] rounded-lg text-center">
          <div className="text-[#00E701] font-bold mb-1">YOU WON!</div>
          <div className="font-mono">{formatCurrency(lastResult.payout)}</div>
        </div>
      )}
    </div>
  );
}
