import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DiceRoll } from '@shared/schema';
import { motion, AnimatePresence } from 'framer-motion';

export default function DiceGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const [betAmount, setBetAmount] = useState(1);
  const [target, setTarget] = useState(50);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceRoll | null>(null);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [showWinMessage, setShowWinMessage] = useState(false);
  
  // Calculate profit on win
  const winChance = target;
  const multiplier = 99 / target;
  const profitOnWin = betAmount * (multiplier - 1);
  
  // Play dice mutation
  const diceMutation = useMutation({
    mutationFn: async (data: { amount: number, target: number }) => {
      const res = await apiRequest('POST', '/api/games/dice', data);
      return await res.json();
    },
    onSuccess: (data: DiceRoll) => {
      // Set the result
      setLastResult(data);
      
      // Animate dice roll
      animateDiceRoll(data.result);
      
      // Balance update will happen after animation completes
      // No toast notifications to avoid spoiling the result
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsRolling(false);
    },
  });
  
  const animateDiceRoll = (finalValue: number) => {
    let rolls = 0;
    const maxRolls = 10;
    const rollInterval = 100;
    
    // Hide win message during rolling
    setShowWinMessage(false);
    
    const roll = () => {
      rolls++;
      
      if (rolls < maxRolls) {
        // Random dice value
        setDiceValue(Math.floor(Math.random() * 100) + 1);
        setTimeout(roll, rollInterval);
      } else {
        // Final dice value
        setDiceValue(finalValue);
        setIsRolling(false);
        
        // Show win message after rolling completes with a short delay
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
    
    // Start rolling
    roll();
  };
  
  const handleRoll = () => {
    // Validate bet amount and target
    if (!user || betAmount <= 0 || betAmount > Number(user.balance)) {
      toast({
        title: 'Invalid bet',
        description: 'Please enter a valid bet amount',
        variant: 'destructive',
      });
      return;
    }
    
    // Start rolling
    setIsRolling(true);
    play('diceRoll');
    
    // Make API call
    diceMutation.mutate({ amount: betAmount, target });
  };
  
  const handleTargetChange = (value: number[]) => {
    setTarget(value[0]);
  };
  
  // Render dice dots based on value
  const renderDiceFace = () => {
    if (diceValue === null) {
      // Default dice face (4)
      return (
        <>
          <div className="absolute w-3 h-3 rounded-full bg-white top-3 left-3"></div>
          <div className="absolute w-3 h-3 rounded-full bg-white top-3 right-3"></div>
          <div className="absolute w-3 h-3 rounded-full bg-white bottom-3 left-3"></div>
          <div className="absolute w-3 h-3 rounded-full bg-white bottom-3 right-3"></div>
        </>
      );
    }
    
    // For dice game, we'll show a number instead of dots
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white font-mono font-bold">
        {diceValue}
      </div>
    );
  };
  
  return (
    <div className="bg-[#2A2A2A] p-4 rounded-xl">
      <div className="flex justify-center mb-6">
        <div className={`dice w-16 h-16 bg-[#121212] rounded-lg flex items-center justify-center relative ${
          lastResult?.isWin 
            ? 'neon-glow' 
            : lastResult && !lastResult.isWin 
              ? 'lose-glow' 
              : ''
        }`}>
          {renderDiceFace()}
        </div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Roll Under to Win</span>
          <span className="font-mono text-lg font-bold">{target}</span>
        </div>
        <Slider 
          defaultValue={[50]} 
          min={2} 
          max={98} 
          step={1}
          value={[target]}
          onValueChange={handleTargetChange}
          disabled={isRolling}
          className="w-full my-2"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Higher Risk</span>
          <span>Lower Risk</span>
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <div className="w-1/2">
          <span className="text-sm text-gray-400 block mb-1">Bet Amount</span>
          <div className="relative">
            <Input
              type="text"
              value={betAmount.toString()}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                // Ensure only one decimal point
                const parts = value.split('.');
                const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                setBetAmount(Number(sanitized) || 0);
              }}
              className="w-full bg-[#121212] rounded-lg border border-[#333333] p-2 font-mono"
              disabled={isRolling}
            />
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#5465FF]"
              onClick={() => user && setBetAmount(Number(user.balance))}
              disabled={isRolling}
            >
              MAX
            </button>
          </div>
        </div>
        <div className="w-1/2">
          <span className="text-sm text-gray-400 block mb-1">Profit on Win</span>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(profitOnWin)}
              className="w-full bg-[#121212] rounded-lg border border-[#333333] p-2 font-mono"
              readOnly
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#00E701]">
              {multiplier.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>
      
      <Button
        className="w-full bg-[#5465FF] hover:bg-[#6677FF] text-white font-bold py-3 px-4 rounded-lg transition duration-200"
        onClick={handleRoll}
        disabled={isRolling || !user || betAmount > Number(user.balance)}
      >
        {isRolling ? 'ROLLING...' : 'ROLL DICE'}
      </Button>
      
      <AnimatePresence>
        {lastResult && lastResult.isWin && lastResult.payout > betAmount && showWinMessage && (
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
              Multiplier: {multiplier.toFixed(2)}x
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
