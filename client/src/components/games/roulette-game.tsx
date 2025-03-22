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
  const [selectedBetType, setSelectedBetType] = useState<RouletteBetType>('straight');
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0]);
  const [rotationAngle, setRotationAngle] = useState(0);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('inside');
  
  // Calculate profit and multiplier for current bet
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
    return (
      <div className="grid grid-cols-2 gap-2">
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#E03C3C] to-[#C92A2A] text-white ${
            selectedBetType === 'red' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('red');
            setSelectedNumbers(Object.entries(ROULETTE_COLORS)
              .filter(([_, color]) => color === 'red')
              .map(([num]) => parseInt(num)));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Red
        </motion.button>
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#222222] to-[#121212] text-white ${
            selectedBetType === 'black' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('black');
            setSelectedNumbers(Object.entries(ROULETTE_COLORS)
              .filter(([_, color]) => color === 'black')
              .map(([num]) => parseInt(num)));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Black
        </motion.button>
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
            selectedBetType === 'even' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('even');
            setSelectedNumbers(Array.from({length: 18}, (_, i) => (i + 1) * 2));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Even
        </motion.button>
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
            selectedBetType === 'odd' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('odd');
            setSelectedNumbers(Array.from({length: 18}, (_, i) => (i * 2) + 1));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          Odd
        </motion.button>
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
            selectedBetType === 'low' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('low');
            setSelectedNumbers(Array.from({length: 18}, (_, i) => i + 1));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          1-18
        </motion.button>
        <motion.button 
          className={`h-14 border border-[#333333] text-center flex items-center justify-center text-lg font-bold shadow-md bg-gradient-to-b from-[#444444] to-[#333333] text-white ${
            selectedBetType === 'high' ? 'ring-2 ring-[#5465FF]' : ''
          }`}
          onClick={() => {
            setSelectedBetType('high');
            setSelectedNumbers(Array.from({length: 18}, (_, i) => i + 19));
          }}
          disabled={isSpinning}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          19-36
        </motion.button>
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
  
  // Handle spinning the wheel
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
    
    // Validate that at least one number is selected
    if (selectedNumbers.length === 0) {
      toast({
        title: 'No bet selected',
        description: 'Please select at least one number or bet type',
        variant: 'destructive',
      });
      return;
    }
    
    // Start spinning
    setIsSpinning(true);
    play('spin');
    
    // Make API call
    rouletteMutation.mutate({ 
      amount: betAmount, 
      betType: selectedBetType,
      numbers: selectedNumbers
    });
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
      <div className="flex gap-3 mt-5 mb-5">
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
              value={formatCurrency(profitOnWin)}
              className="w-full bg-gradient-to-b from-[#181818] to-[#121212] rounded-lg border border-[#333333] p-3 font-mono text-[#00E701] font-semibold shadow-inner"
              readOnly
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-[#1A1A1A] text-[#00E701] font-bold px-2 py-1 rounded-full shadow">
              {multiplier}x
            </div>
          </div>
        </div>
      </div>
      
      <motion.button
        className="w-full bg-gradient-to-r from-[#5465FF] to-[#788AFF] hover:bg-gradient-to-r hover:from-[#6677FF] hover:to-[#899BFF] text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-200 text-lg"
        onClick={handleSpin}
        disabled={isSpinning || !user || betAmount > Number(user.balance) || selectedNumbers.length === 0}
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