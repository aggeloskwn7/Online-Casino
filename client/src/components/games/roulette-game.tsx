import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import {
  ROULETTE_NUMBERS,
  ROULETTE_COLORS,
  ROULETTE_PAYOUTS,
  formatCurrency,
  formatMultiplier
} from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { RouletteResult, RouletteBet, RouletteBetType } from '@shared/schema';

// Define a bet object type
type Bet = {
  type: RouletteBetType;
  numbers: number[];
  amount: number;
};

type BetOption = {
  type: RouletteBetType;
  label: string;
  numbers: number[];
  isActive: boolean;
};

export default function RouletteGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const wheelRef = useRef<HTMLDivElement>(null);
  
  const [betAmount, setBetAmount] = useState(1);
  const [isSpinning, setIsSpinning] = useState(false);
  const [lastResult, setLastResult] = useState<RouletteResult | null>(null);
  const [activeBets, setActiveBets] = useState<Bet[]>([]);
  const [selectedBetType, setSelectedBetType] = useState<RouletteBetType>('straight');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0]);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('inside');
  
  // Calculate total bet amount and potential profit
  const totalBetAmount = activeBets.reduce((total, bet) => total + bet.amount, 0) + betAmount;
  
  // Calculate potential profit based on active bets and current selection
  const calculatePotentialProfit = () => {
    // Profit from already placed bets
    const existingBetsProfit = activeBets.reduce((total, bet) => {
      return total + (bet.amount * ROULETTE_PAYOUTS[bet.type]);
    }, 0);
    
    // Profit from current selection (if any)
    const currentSelectionProfit = selectedNumbers.length > 0 
      ? betAmount * ROULETTE_PAYOUTS[selectedBetType]
      : 0;
    
    return existingBetsProfit + currentSelectionProfit;
  };
  
  const potentialProfit = calculatePotentialProfit();
  
  // Calculate profit and multiplier for current bet (used for display)
  const multiplier = selectedNumbers.length > 0 
    ? ROULETTE_PAYOUTS[selectedBetType] 
    : 0;
  const profitOnWin = betAmount * multiplier;
  
  // Inside bets (specific numbers)
  const renderNumberGrid = () => {
    const rows = [];
    
    // First row with 0
    rows.push(
      <div key="zero-row" className="flex">
        <motion.button
          className={`w-12 h-12 border border-[#333333] text-center flex items-center justify-center text-xl font-bold m-0.5 shadow-md ${
            selectedNumbers.includes(0)
              ? 'bg-gradient-to-b from-[#6677FF] to-[#5465FF] text-white'
              : 'bg-gradient-to-b from-[#00A000] to-[#008000] text-white hover:bg-[#006600]'
          }`}
          onClick={() => handleNumberSelect(0)}
          disabled={isSpinning}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          0
        </motion.button>
        <div className="flex flex-col ml-1">
          <button 
            className="w-8 h-6 border border-[#333333] text-center flex items-center justify-center text-xs font-bold m-0.5 bg-[#333333] text-white hover:bg-[#444444]"
            onClick={() => setSelectedBetType('column')}
            disabled={isSpinning}
          >
            2:1
          </button>
          <button 
            className="w-8 h-6 border border-[#333333] text-center flex items-center justify-center text-xs font-bold m-0.5 bg-[#333333] text-white hover:bg-[#444444]"
            onClick={() => setSelectedBetType('column')}
            disabled={isSpinning}
          >
            2:1
          </button>
          <button 
            className="w-8 h-6 border border-[#333333] text-center flex items-center justify-center text-xs font-bold m-0.5 bg-[#333333] text-white hover:bg-[#444444]"
            onClick={() => setSelectedBetType('column')}
            disabled={isSpinning}
          >
            2:1
          </button>
        </div>
      </div>
    );
    
    // Main grid (1-36)
    for (let row = 1; row <= 12; row++) {
      const cells = [];
      for (let col = 1; col <= 3; col++) {
        const number = (3 * (12 - row)) + col;
        const color = ROULETTE_COLORS[number];
        cells.push(
          <motion.button
            key={`cell-${number}`}
            className={`w-12 h-12 border border-[#333333] text-center flex items-center justify-center text-xl font-bold m-0.5 shadow-md ${
              selectedNumbers.includes(number)
                ? 'bg-gradient-to-b from-[#6677FF] to-[#5465FF] text-white'
                : color === 'red'
                  ? 'bg-gradient-to-b from-[#E03C3C] to-[#C92A2A] text-white hover:bg-[#A91A1A]'
                  : 'bg-gradient-to-b from-[#222222] to-[#121212] text-white hover:bg-[#222222]'
            }`}
            onClick={() => handleNumberSelect(number)}
            disabled={isSpinning}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            {number}
          </motion.button>
        );
      }
      rows.push(
        <div key={`row-${row}`} className="flex">
          {cells}
        </div>
      );
    }
    
    // Add bottom row for dozen bets
    rows.push(
      <div key="dozen-row" className="flex mt-1">
        <motion.button 
          className={`w-[148px] h-8 border border-[#333333] text-center flex items-center justify-center text-sm font-bold m-0.5 bg-gradient-to-b from-[#444444] to-[#333333] text-white shadow-md ${
            selectedBetType === 'dozen' && selectedNumbers.includes(1) ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('dozen');
            setSelectedNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          1st 12
        </motion.button>
        <motion.button 
          className={`w-[148px] h-8 border border-[#333333] text-center flex items-center justify-center text-sm font-bold m-0.5 bg-gradient-to-b from-[#444444] to-[#333333] text-white shadow-md ${
            selectedBetType === 'dozen' && selectedNumbers.includes(13) ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('dozen');
            setSelectedNumbers([13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          2nd 12
        </motion.button>
        <motion.button 
          className={`w-[148px] h-8 border border-[#333333] text-center flex items-center justify-center text-sm font-bold m-0.5 bg-gradient-to-b from-[#444444] to-[#333333] text-white shadow-md ${
            selectedBetType === 'dozen' && selectedNumbers.includes(25) ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('dozen');
            setSelectedNumbers([25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]);
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          3rd 12
        </motion.button>
      </div>
    );
    
    return rows;
  };
  
  // Outside bets (red/black, odd/even, etc.)
  const renderOutsideBets = () => {
    // Helper to determine if an outside bet is active in the active bets list
    const isBetActive = (betType: RouletteBetType) => {
      return activeBets.some(bet => bet.type === betType);
    };
    
    // Function to handle clicking an outside bet option
    const handleOutsideBetClick = (betType: RouletteBetType, numbers: number[]) => {
      if (isSpinning) return;
      
      // Check if the bet already exists
      if (isBetActive(betType)) {
        // Remove the bet if it already exists
        setActiveBets(activeBets.filter(bet => bet.type !== betType));
        
        toast({
          title: 'Bet removed',
          description: `${betType} bet has been removed`,
        });
      } else {
        // Add the bet if it doesn't exist
        const newBet: Bet = {
          type: betType,
          numbers: [...numbers],
          amount: betAmount
        };
        
        setActiveBets([...activeBets, newBet]);
        
        toast({
          title: 'Bet added',
          description: `${betType} bet for ${formatCurrency(betAmount)} added`,
        });
      }
    };
    
    // Get all red numbers
    const redNumbers = Object.entries(ROULETTE_COLORS)
      .filter(([_, color]) => color === 'red')
      .map(([num]) => parseInt(num));
    
    // Get all black numbers
    const blackNumbers = Object.entries(ROULETTE_COLORS)
      .filter(([_, color]) => color === 'black')
      .map(([num]) => parseInt(num));
    
    // Even numbers: 2, 4, 6, etc.
    const evenNumbers = Array.from({length: 18}, (_, i) => (i + 1) * 2);
    
    // Odd numbers: 1, 3, 5, etc.
    const oddNumbers = Array.from({length: 18}, (_, i) => (i * 2) + 1);
    
    // Low numbers: 1-18
    const lowNumbers = Array.from({length: 18}, (_, i) => i + 1);
    
    // High numbers: 19-36
    const highNumbers = Array.from({length: 18}, (_, i) => i + 19);
    
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#E03C3C] to-[#C92A2A] text-white ${
              isBetActive('red') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('red', redNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Red
          </motion.button>
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#222222] to-[#121212] text-white ${
              isBetActive('black') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('black', blackNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Black
          </motion.button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
              isBetActive('even') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('even', evenNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Even
          </motion.button>
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
              isBetActive('odd') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('odd', oddNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            Odd
          </motion.button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
              isBetActive('low') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('low', lowNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            1-18
          </motion.button>
          <motion.button 
            className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
              isBetActive('high') ? 'ring-2 ring-[#5465FF]' : ''
            }`}
            onClick={() => handleOutsideBetClick('high', highNumbers)}
            disabled={isSpinning}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            19-36
          </motion.button>
        </div>
        
        <div className="bg-[#181818] p-3 rounded-lg border border-[#333333] shadow-inner">
          <p className="text-center text-sm text-gray-400 mb-2">
            Click on options to toggle bets. Each bet uses your bet amount.
          </p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {activeBets.map((bet, index) => (
              <Badge 
                key={index} 
                className="bg-gradient-to-r from-[#394DFE] to-[#5465FF] text-white font-medium"
              >
                {bet.type} • {formatCurrency(bet.amount)}
              </Badge>
            ))}
            {activeBets.length === 0 && (
              <span className="text-sm text-gray-500 italic">No bets placed yet</span>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  // Render roulette wheel
  const renderRouletteWheel = () => {
    return (
      <div className="relative w-full h-64 flex items-center justify-center overflow-hidden mb-6">
        {/* Outer table border with wood texture */}
        <div className="absolute w-[90%] h-[90%] rounded-full bg-gradient-to-r from-[#8B4513] to-[#654321] border-8 border-[#A0522D] shadow-[0_0_30px_rgba(0,0,0,0.7)]">
          {/* Inner felt with pattern */}
          <div className="absolute inset-4 rounded-full bg-[#01581F] shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]">
            {/* Wheel track/gutter where ball rolls */}
            <div className="absolute inset-10 rounded-full border-4 border-[#A0522D] bg-gradient-to-r from-[#654321] to-[#8B4513] shadow-[inset_0_0_15px_rgba(0,0,0,0.6)]">
              
              {/* Ball */}
              {isSpinning && (
                <motion.div 
                  className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-white to-[#e0e0e0] z-30 shadow-[0_0_5px_rgba(255,255,255,0.8)]"
                  initial={{ 
                    top: "50%", 
                    left: "50%",
                    x: "-50%",
                    y: "-50%"
                  }}
                  animate={{
                    top: ["50%", "10%", "20%", "15%", "25%", "20%"],
                    left: ["50%", "90%", "20%", "70%", "30%", "60%"],
                    rotate: [0, 720, 1080, 1440, 1800],
                  }}
                  transition={{
                    duration: 4,
                    ease: "easeInOut",
                    times: [0, 0.2, 0.4, 0.6, 0.8, 1]
                  }}
                />
              )}
              
              {/* Fixed ball after spinning */}
              {lastResult && !isSpinning && (
                <motion.div 
                  className="absolute w-4 h-4 rounded-full bg-gradient-to-r from-white to-[#e0e0e0] z-30 shadow-[0_0_5px_rgba(255,255,255,0.8)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{
                    top: `calc(50% - ${Math.sin((lastResult.spin % 37) * (2 * Math.PI / 37)) * 40}%)`,
                    left: `calc(50% + ${Math.cos((lastResult.spin % 37) * (2 * Math.PI / 37)) * 40}%)`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
        
        {/* Actual spinning wheel */}
        <div 
          ref={wheelRef}
          className="absolute w-60 h-60 rounded-full bg-gradient-to-r from-[#1A1A1A] to-[#0A0A0A] border-4 border-[#5465FF] flex items-center justify-center transform transition-transform duration-4000 ease-out shadow-[0_0_20px_rgba(84,101,255,0.5)]"
          style={{ transform: `rotate(${rotationAngle}deg)` }}
        >
          {ROULETTE_NUMBERS.map((number, index) => {
            // Calculate position on wheel (37 numbers including 0)
            const angle = (index * (360 / ROULETTE_NUMBERS.length));
            const color = ROULETTE_COLORS[number];
            
            return (
              <div 
                key={number}
                className="absolute w-2 h-2 flex items-center justify-center text-xs text-white"
                style={{
                  transform: `rotate(${angle}deg) translateY(-25px)`,
                  transformOrigin: 'center 25px'
                }}
              >
                <div 
                  className={`w-8 h-12 flex items-center justify-center text-[10px] font-bold shadow-md transform -rotate-[${angle}deg] ${
                    color === 'red' ? 'bg-gradient-to-b from-[#E03C3C] to-[#C92A2A] border border-[#FF5555]' : 
                    color === 'black' ? 'bg-gradient-to-b from-[#222222] to-[#121212] border border-[#333333]' :
                    'bg-gradient-to-b from-[#00A000] to-[#008000] border border-[#00C000]'
                  }`}
                >
                  {number}
                </div>
              </div>
            );
          })}
          <div className="w-30 h-30 rounded-full bg-gradient-to-b from-[#333333] to-[#222222] flex items-center justify-center z-10 shadow-[inset_0_0_15px_rgba(0,0,0,0.6)] border-2 border-[#5465FF]">
            {lastResult ? (
              <motion.div 
                className={`w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg ${
                  lastResult.color === 'red' ? 'bg-gradient-to-b from-[#E03C3C] to-[#C92A2A] border border-[#FF5555]' : 
                  lastResult.color === 'black' ? 'bg-gradient-to-b from-[#222222] to-[#121212] border border-[#333333]' :
                  'bg-gradient-to-b from-[#00A000] to-[#008000] border border-[#00C000]'
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                  delay: 4.1 // Slightly after the wheel stops
                }}
              >
                {lastResult.spin}
              </motion.div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#222222] to-[#181818] border border-[#333333] flex items-center justify-center text-gray-400 text-2xl font-bold shadow-md">
                <span className="animate-pulse">?</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Wheel marker/pointer */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-20 flex flex-col items-center">
          <div className="w-6 h-6 bg-[#5465FF] rotate-45 mb-[-3px] shadow-[0_0_8px_rgba(84,101,255,0.8)]"></div>
          <div className="w-4 h-12 bg-[#5465FF] shadow-[0_0_8px_rgba(84,101,255,0.8)]"></div>
        </div>
        
        {/* Decorative wheel elements */}
        <div className="absolute inset-0 rounded-full border-8 border-transparent pointer-events-none" style={{ 
          boxShadow: 'inset 0 0 40px rgba(255, 215, 0, 0.3)' 
        }}></div>
      </div>
    );
  };
  
  // Handle selecting a number on the grid
  const handleNumberSelect = (number: number) => {
    if (isSpinning) return;
    
    // For straight bets (single number), just set that number
    if (selectedBetType === 'straight') {
      setSelectedNumbers([number]);
      return;
    }
    
    // For other bet types, toggle the number in the selection
    const isSelected = selectedNumbers.includes(number);
    if (isSelected) {
      setSelectedNumbers(selectedNumbers.filter(n => n !== number));
    } else {
      setSelectedNumbers([...selectedNumbers, number]);
    }
  };
  
  // Determine bet type based on selected numbers
  useEffect(() => {
    if (selectedNumbers.length === 1) {
      setSelectedBetType('straight');
    } else if (selectedNumbers.length === 2) {
      setSelectedBetType('split');
    } else if (selectedNumbers.length === 3) {
      setSelectedBetType('street');
    } else if (selectedNumbers.length === 4) {
      setSelectedBetType('corner');
    } else if (selectedNumbers.length === 6) {
      setSelectedBetType('line');
    }
  }, [selectedNumbers]);
  
  // Mutation for spinning the roulette wheel
  const rouletteMutation = useMutation({
    mutationFn: async (data: RouletteBet) => {
      const res = await apiRequest('POST', '/api/games/roulette', data);
      return await res.json();
    },
    onSuccess: (data: RouletteResult) => {
      // Set the result but don't update balance yet (will do after animation)
      setLastResult(data);
      
      // Animate the wheel spinning
      animateRouletteWheel(data.spin);
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
  
  // Animate the roulette wheel spinning
  const animateRouletteWheel = (landingNumber: number) => {
    // Hide win message during spinning
    setShowWinMessage(false);
    
    // Calculate the angle to land on the specific number
    const numberIndex = ROULETTE_NUMBERS.indexOf(landingNumber);
    const numberAngle = (numberIndex * (360 / ROULETTE_NUMBERS.length));
    
    // Add multiple full rotations plus the specific angle to land on the number
    // The marker is at the top, so add 180 degrees to make the number land at the marker
    const targetAngle = (360 * 5) + numberAngle + 180;
    
    // Set the rotation angle with CSS transition for smooth animation
    setRotationAngle(targetAngle);
    
    // Set timeout for the end of animation (matches the CSS transition duration)
    setTimeout(() => {
      setIsSpinning(false);
      
      // Update user data (balance) only now after animation is complete
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Play sound based on win/lose
      if (lastResult?.isWin) {
        play('win');
      } else {
        play('lose');
      }
      
      // Show win message
      setShowWinMessage(true);
    }, 4000); // 4 seconds for the wheel to stop
  };
  
  // Function to add current selection to active bets
  const addBet = () => {
    // Validate bet amount
    if (!user || betAmount <= 0 || betAmount > Number(user.balance)) {
      toast({
        title: 'Invalid bet',
        description: 'Please enter a valid bet amount',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate that at least one number is selected
    if (selectedNumbers.length === 0) {
      toast({
        title: 'No bet selected',
        description: 'Please select at least one number or bet type',
        variant: 'destructive',
      });
      return;
    }
    
    // Create new bet
    const newBet: Bet = {
      type: selectedBetType,
      numbers: [...selectedNumbers],
      amount: betAmount
    };
    
    // Add to active bets
    setActiveBets([...activeBets, newBet]);
    
    // Reset selection for next bet
    if (selectedBetType === 'straight') {
      setSelectedNumbers([0]);
    } else {
      setSelectedNumbers([]);
    }
    
    // Show success toast
    toast({
      title: 'Bet added',
      description: `${selectedBetType} bet for ${formatCurrency(betAmount)} added`,
    });
  };
  
  // Function to clear all active bets
  const clearBets = () => {
    setActiveBets([]);
    toast({
      title: 'Bets cleared',
      description: 'All bets have been cleared',
    });
  };

  // Handle spinning the wheel
  const handleSpin = () => {
    // Check if we have active bets or a current selection
    const hasActiveBets = activeBets.length > 0;
    const hasCurrentSelection = selectedNumbers.length > 0 && betAmount > 0;
    
    if (!hasActiveBets && !hasCurrentSelection) {
      toast({
        title: 'No bets placed',
        description: 'Please place at least one bet',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate total bet amount against balance
    if (!user || totalBetAmount > Number(user.balance)) {
      toast({
        title: 'Insufficient balance',
        description: `Your total bet (${formatCurrency(totalBetAmount)}) exceeds your balance`,
        variant: 'destructive',
      });
      return;
    }
    
    // Start spinning
    setIsSpinning(true);
    play('spin');
    
    // Prepare all bets for the API call
    const allBets = hasCurrentSelection 
      ? [...activeBets, { type: selectedBetType, numbers: selectedNumbers, amount: betAmount }] 
      : activeBets;
    
    // For now, we'll use only the first bet since we need to update the backend to handle multiple bets
    // In a real implementation, we would send all bets to the server
    const primaryBet = allBets[0];
    
    // Make API call with the first bet (backend would need to be updated to handle multiple bets)
    rouletteMutation.mutate({ 
      amount: primaryBet.amount, 
      betType: primaryBet.type,
      numbers: primaryBet.numbers
    });
    
    // Clear active bets after spinning
    setActiveBets([]);
  };
  
  return (
    <div className="bg-[#2A2A2A] p-4 rounded-xl">
      {/* Roulette Wheel */}
      <div className="mb-6">
        {renderRouletteWheel()}
      </div>
      
      {/* Bet Selection Area */}
      <Tabs defaultValue="inside" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full mb-4">
          <TabsTrigger className="w-1/2" value="inside">Inside Bets</TabsTrigger>
          <TabsTrigger className="w-1/2" value="outside">Outside Bets</TabsTrigger>
        </TabsList>
        <TabsContent value="inside" className="space-y-4">
          <div className="overflow-x-auto">
            <div className="inline-block">
              {renderNumberGrid()}
            </div>
          </div>
        </TabsContent>
        <TabsContent value="outside" className="space-y-4">
          {renderOutsideBets()}
        </TabsContent>
      </Tabs>
      
      {/* Current Bet Info */}
      <div className="mt-4 p-4 bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg shadow-md border border-[#333333]">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-medium text-gray-300">Current Bet</span>
          <Badge className="bg-gradient-to-r from-[#5465FF] to-[#6677FF] shadow-sm">
            {selectedBetType.charAt(0).toUpperCase() + selectedBetType.slice(1)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedNumbers.length > 0 ? (
            selectedNumbers.length <= 12 ? (
              selectedNumbers.map(num => (
                <Badge key={num} variant="outline" className="bg-[#1A1A1A] border-[#333333] text-gray-200 font-mono">
                  {num}
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="bg-[#1A1A1A] border-[#333333] text-gray-200">
                {selectedNumbers.length} numbers
              </Badge>
            )
          ) : (
            <span className="text-sm text-gray-500 italic">No numbers selected</span>
          )}
        </div>
        <div className="flex justify-between items-center text-sm bg-[#1A1A1A] p-2 rounded-md">
          <span className="text-gray-300 font-medium">Payout Ratio</span>
          <span className="text-[#00E701] font-bold">{multiplier}:1</span>
        </div>
      </div>
      
      {/* Bet Amount and Spin Button */}
      {/* Display active bets */}
      {activeBets.length > 0 && (
        <div className="mt-4 p-4 bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg shadow-md border border-[#333333]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-medium text-gray-300">Active Bets</span>
            <Badge 
              className="bg-gradient-to-r from-[#E03C3C] to-[#C92A2A] cursor-pointer hover:from-[#D12A2A] hover:to-[#B91A1A]"
              onClick={clearBets}
            >
              Clear All
            </Badge>
          </div>
          <div className="divide-y divide-[#333333] max-h-40 overflow-y-auto">
            {activeBets.map((bet, index) => (
              <div key={index} className="py-2 flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-[#1A1A1A] flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-medium">
                      {bet.type.charAt(0).toUpperCase() + bet.type.slice(1)}
                    </div>
                    <div className="text-xs text-gray-400">
                      {bet.numbers.length <= 6 
                        ? bet.numbers.join(', ') 
                        : `${bet.numbers.length} numbers`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-mono font-medium">
                    {formatCurrency(bet.amount)}
                  </div>
                  <div className="text-xs text-[#00E701]">
                    {formatMultiplier(ROULETTE_PAYOUTS[bet.type])}x
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center text-sm bg-[#1A1A1A] p-2 rounded-md mt-3">
            <span className="text-gray-300 font-medium">Total bet amount</span>
            <span className="text-white font-bold font-mono">{formatCurrency(activeBets.reduce((sum, bet) => sum + bet.amount, 0))}</span>
          </div>
        </div>
      )}

      <div className="flex gap-3 mt-5 mb-3">
        <div className="w-1/2">
          <span className="text-sm font-medium text-gray-300 block mb-1.5">Bet Amount</span>
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
              className="w-full bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg border border-[#333333] p-3 font-mono text-white shadow-inner"
              disabled={isSpinning}
            />
            <motion.button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#5465FF] font-semibold bg-[#1A1A1A] px-2 py-1 rounded hover:bg-[#222222]"
              onClick={() => user && setBetAmount(Number(user.balance))}
              disabled={isSpinning}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              MAX
            </motion.button>
          </div>
        </div>
        <div className="w-1/2">
          <span className="text-sm font-medium text-gray-300 block mb-1.5">Profit on Win</span>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(potentialProfit)}
              className="w-full bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg border border-[#333333] p-3 font-mono text-[#00E701] font-semibold shadow-inner"
              readOnly
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-[#1A1A1A] text-[#00E701] font-bold px-2 py-1 rounded-full shadow">
              {multiplier}x
            </div>
          </div>
        </div>
      </div>
      
      {/* Inside Bet and Spin Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <motion.button
          className="w-full bg-gradient-to-r from-[#333333] to-[#444444] hover:bg-gradient-to-r hover:from-[#3c3c3c] hover:to-[#505050] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-200 text-base"
          onClick={addBet}
          disabled={isSpinning || !user || betAmount <= 0 || betAmount > Number(user.balance) || selectedNumbers.length === 0}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          <div className="flex items-center justify-center">
            <span className="mr-2">PLACE NUMBER BET</span>
            <span className="text-sm">+</span>
          </div>
        </motion.button>
        
        <motion.button
          className="w-full bg-gradient-to-r from-[#5465FF] to-[#788AFF] hover:bg-gradient-to-r hover:from-[#6677FF] hover:to-[#899BFF] text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-200 text-base"
          onClick={handleSpin}
          disabled={isSpinning || !user || (activeBets.length === 0 && (betAmount <= 0 || selectedNumbers.length === 0))}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
        >
          {isSpinning ? (
            <div className="flex items-center justify-center">
              <span className="mr-2">SPINNING</span>
              <span className="animate-pulse">...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <span className="mr-2">SPIN</span>
              <span className="text-sm">🎡</span>
            </div>
          )}
        </motion.button>
      </div>
      
      {/* Multiple bets are now allowed by default */}
      
      <AnimatePresence>
        {lastResult && lastResult.isWin && showWinMessage && (
          <motion.div 
            className="mt-4 p-5 bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg text-center shadow-xl border border-[#5465FF]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-[#00E701] font-bold text-xl mb-2 flex items-center justify-center"
              initial={{ scale: 0.8 }}
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, 2, -2, 0]
              }}
              transition={{ 
                duration: 0.5,
                repeat: 2,
                repeatType: "reverse" 
              }}
            >
              <span className="mr-2">🎉</span>
              YOU WON!
              <span className="ml-2">🎉</span>
            </motion.div>
            <motion.div 
              className="font-mono text-2xl font-bold text-white my-3"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.4, type: "spring" }}
            >
              {formatCurrency(lastResult.payout)}
            </motion.div>
            <motion.div 
              className="text-sm bg-[#1A1A1A] py-2 px-4 rounded-full inline-block text-[#5465FF] mt-1 font-bold"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              <span className="mr-1">×</span>{multiplier} Multiplier
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}