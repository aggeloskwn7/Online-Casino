import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/use-sound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatMultiplier } from '@/lib/game-utils';
import { ArrowDown, ArrowUp, Coins, Award, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Define types for the Plinko game
interface PinPosition {
  row: number;
  x: number;
  y: number;
  radius: number;
}

interface Bucket {
  x: number;
  width: number;
  multiplier: number;
}

interface PathStep {
  row: number;
  position: number;
}

interface BallPosition {
  x: number;
  y: number;
}

interface PlinkoResult {
  isWin: boolean;
  payout: number;
  multiplier: number;
  path: PathStep[];
}

type RiskLevel = 'low' | 'medium' | 'high';

// Define the pin grid dimensions
const ROWS = 16;
const COLUMNS = 17; // Maximum pins in the last row
const PIN_SIZE = 12;
const PIN_SPACING_X = 40;
const PIN_SPACING_Y = 40;
const PIN_RADIUS = PIN_SIZE / 2;
const BALL_SIZE = 14;
const BOARD_WIDTH = PIN_SPACING_X * (COLUMNS - 1);
const BOARD_HEIGHT = PIN_SPACING_Y * ROWS + 150; // Extra space for buckets

// Define multiplier buckets for different risk levels
const MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [1.5, 1.2, 1.0, 0.5, 0.3, 0.2, 0.3, 0.5, 1.0, 1.2, 1.5, 2.0, 3.0],
  medium: [5.0, 2.0, 1.5, 1.0, 0.5, 0.2, 0.1, 0.2, 0.5, 1.0, 1.5, 2.0, 5.0],
  high: [10.0, 3.0, 1.5, 0.5, 0.3, 0.2, 0.1, 0.2, 0.3, 0.5, 1.5, 3.0, 10.0]
};

// Calculate pin positions
const calculatePins = (): PinPosition[] => {
  const pins: PinPosition[] = [];
  
  for (let row = 0; row < ROWS; row++) {
    const pinsInRow = row + 1;
    const startX = (BOARD_WIDTH - (pinsInRow - 1) * PIN_SPACING_X) / 2;
    
    for (let i = 0; i < pinsInRow; i++) {
      pins.push({
        row,
        x: startX + i * PIN_SPACING_X,
        y: row * PIN_SPACING_Y + 60, // Add top margin
        radius: PIN_RADIUS
      });
    }
  }
  
  return pins;
};

// Calculate bucket positions
const calculateBuckets = (riskLevel: RiskLevel): Bucket[] => {
  const multipliers = MULTIPLIERS[riskLevel];
  const bucketWidth = BOARD_WIDTH / multipliers.length;
  
  return multipliers.map((multiplier: number, index: number) => {
    return {
      x: index * bucketWidth + bucketWidth / 2,
      width: bucketWidth,
      multiplier
    };
  });
};

// Main component
export default function PlinkoGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  
  const [amount, setAmount] = useState<number>(10);
  const [risk, setRisk] = useState<RiskLevel>('medium');
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<PathStep[] | null>(null);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [pins, setPins] = useState<PinPosition[]>(calculatePins());
  const [buckets, setBuckets] = useState<Bucket[]>(calculateBuckets('medium'));
  const [ballPosition, setBallPosition] = useState<BallPosition>({ x: BOARD_WIDTH / 2, y: 0 });
  const [landingBucket, setLandingBucket] = useState<number | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update buckets when risk level changes
  useEffect(() => {
    setBuckets(calculateBuckets(risk));
  }, [risk]);
  
  // Interface for the bet data
  interface BetData {
    amount: number;
    risk: RiskLevel;
  }
  
  // Mutation for placing a bet
  const placeBetMutation = useMutation<PlinkoResult, Error, BetData>({
    mutationFn: async (data: BetData) => {
      const res = await apiRequest('POST', '/api/games/plinko', data);
      return await res.json();
    },
    onSuccess: (data: PlinkoResult) => {
      // Start animation with the returned path
      animateBall(data.path);
      setResult(data);
      
      // Invalidate user data to update the balance
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      // Play sounds
      play('bet');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to place bet',
        variant: 'destructive'
      });
    }
  });
  
  // Handle bet form submission
  const handlePlaceBet = (): void => {
    if (isAnimating) return;
    
    if (!user) {
      toast({
        title: 'Login Required',
        description: 'Please login to play',
        variant: 'destructive'
      });
      return;
    }
    
    if (amount < 1) {
      toast({
        title: 'Invalid Bet',
        description: 'Minimum bet is 1 coin',
        variant: 'destructive'
      });
      return;
    }
    
    if (amount > 10000) {
      toast({
        title: 'Invalid Bet',
        description: 'Maximum bet is 10,000 coins',
        variant: 'destructive'
      });
      return;
    }
    
    if (user.balance < amount) {
      toast({
        title: 'Insufficient Balance',
        description: 'Not enough coins in your balance',
        variant: 'destructive'
      });
      return;
    }
    
    // Place the bet
    placeBetMutation.mutate({ amount, risk });
  };
  
  // Animation function for the ball
  const animateBall = (path: PathStep[]): void => {
    setIsAnimating(true);
    
    // Reset ball position to the top center
    setBallPosition({ x: BOARD_WIDTH / 2, y: 0 });
    
    // Store the path for visualization
    const fullPath = path || generateRandomPath();
    setCurrentPath(fullPath);
    
    let currentStep = 0;
    const totalSteps = fullPath.length;
    const stepDuration = 100; // ms per step
    
    const animate = (): void => {
      if (currentStep >= totalSteps) {
        // Animation complete
        setIsAnimating(false);
        
        // Calculate which bucket the ball landed in
        const finalX = fullPath[fullPath.length - 1].position * PIN_SPACING_X + (BOARD_WIDTH - (ROWS * PIN_SPACING_X)) / 2;
        const bucketIndex = Math.floor((finalX / BOARD_WIDTH) * buckets.length);
        const safeBucketIndex = Math.min(Math.max(0, bucketIndex), buckets.length - 1);
        setLandingBucket(safeBucketIndex);
        
        // Play sound based on win/loss
        if (result && result.isWin) {
          play('win');
        } else {
          play('lose');
        }
        
        // Show result toast
        if (result) {
          toast({
            title: result.isWin ? 'You Won!' : 'Better Luck Next Time',
            description: result.isWin 
              ? `You won ${formatCurrency(result.payout)} coins with a ${formatMultiplier(result.multiplier)}x multiplier!`
              : `Ball landed on ${formatMultiplier(result.multiplier)}x`,
            variant: result.isWin ? 'default' : 'default'
          });
        }
        
        return;
      }
      
      // Calculate new position
      const pathStep = fullPath[currentStep];
      const x = pathStep.position * PIN_SPACING_X + (BOARD_WIDTH - (pathStep.row * PIN_SPACING_X)) / 2;
      const y = pathStep.row * PIN_SPACING_Y + 60;
      
      // Update ball position
      setBallPosition({ x, y });
      
      // Play pin hit sound
      if (currentStep > 0 && currentStep < totalSteps - 1) {
        play('click');
      }
      
      // Move to next step
      currentStep++;
      animationRef.current = setTimeout(animate, stepDuration);
    };
    
    // Start animation
    animate();
  };
  
  // Helper function to generate a random path (for testing)
  const generateRandomPath = (): PathStep[] => {
    const path: PathStep[] = [];
    let position = 0;
    
    for (let row = 0; row < ROWS; row++) {
      path.push({ row, position });
      
      // Randomly move left or right
      if (Math.random() > 0.5 && position < row) {
        position += 1;
      }
    }
    
    // Add final position (bucket)
    path.push({ row: ROWS, position });
    
    return path;
  };
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);
  
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newAmount = parseInt(e.target.value, 10) || 0;
    setAmount(newAmount);
  };
  
  const adjustAmount = (adjustment: number): void => {
    const newAmount = Math.max(1, amount + adjustment);
    setAmount(newAmount);
  };
  
  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-2">Plinko</h2>
        <p className="text-muted-foreground mb-4">
          Watch the ball drop and win big with multipliers up to 100x!
        </p>
      </div>
      
      {/* Plinko Board */}
      <div className="flex justify-center mb-6">
        <div 
          className="relative bg-gradient-to-b from-background/80 to-background border rounded-lg p-4"
          style={{ width: BOARD_WIDTH + 50, height: BOARD_HEIGHT + 20 }}
        >
          {/* Pins */}
          {pins.map((pin, index) => (
            <div
              key={`pin-${index}`}
              className="absolute rounded-full bg-primary/70"
              style={{
                width: PIN_SIZE,
                height: PIN_SIZE,
                left: pin.x - PIN_RADIUS,
                top: pin.y - PIN_RADIUS,
              }}
            />
          ))}
          
          {/* Multiplier Buckets */}
          <div 
            className="absolute flex"
            style={{ 
              bottom: 10, 
              left: 0, 
              width: BOARD_WIDTH, 
              height: 80 
            }}
          >
            {buckets.map((bucket, index) => (
              <div
                key={`bucket-${index}`}
                className={`flex items-center justify-center text-xs font-bold border-r last:border-r-0 ${
                  landingBucket === index 
                    ? bucket.multiplier >= 1 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-red-500/20 text-red-500'
                    : bucket.multiplier >= 1 
                      ? 'bg-primary/10 text-primary' 
                      : 'bg-muted/30 text-muted-foreground'
                }`}
                style={{
                  width: bucket.width,
                  height: '100%',
                }}
              >
                {formatMultiplier(bucket.multiplier)}x
              </div>
            ))}
          </div>
          
          {/* Ball */}
          <AnimatePresence>
            {isAnimating && (
              <motion.div
                className="absolute bg-yellow-400 rounded-full shadow-md shadow-yellow-200 z-10"
                style={{
                  width: BALL_SIZE,
                  height: BALL_SIZE,
                }}
                initial={{ 
                  x: BOARD_WIDTH / 2 - BALL_SIZE / 2,
                  y: -BALL_SIZE 
                }}
                animate={{ 
                  x: ballPosition.x - BALL_SIZE / 2,
                  y: ballPosition.y - BALL_SIZE / 2
                }}
                transition={{ type: 'spring', damping: 10 }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Game Controls */}
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Place Your Bet</CardTitle>
          <CardDescription>
            Higher risk means higher potential rewards
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Risk Level */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Risk Level</label>
            <Select
              value={risk}
              onValueChange={(value: RiskLevel) => setRisk(value)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* Bet Amount */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Bet Amount</label>
            <div className="flex space-x-2 items-center">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => adjustAmount(-10)}
                disabled={amount <= 10 || isAnimating || placeBetMutation.isPending}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={amount}
                onChange={handleAmountChange}
                min={1}
                max={10000}
                className="text-center"
                disabled={isAnimating || placeBetMutation.isPending}
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => adjustAmount(10)}
                disabled={isAnimating || placeBetMutation.isPending}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-between gap-2 mt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setAmount(Math.max(1, Math.floor(amount / 2)))}
                disabled={amount <= 1 || isAnimating || placeBetMutation.isPending}
              >
                ½
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setAmount(amount * 2)}
                disabled={amount >= 5000 || isAnimating || placeBetMutation.isPending}
              >
                2×
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                className="flex-1"
                onClick={() => {
                  if (user?.balance) {
                    setAmount(Math.floor(user.balance));
                  }
                }}
                disabled={!user?.balance || isAnimating || placeBetMutation.isPending}
              >
                Max
              </Button>
            </div>
          </div>
          
          {/* Quick Bets */}
          <div className="grid grid-cols-3 gap-2">
            <Button 
              variant="outline" 
              onClick={() => setAmount(10)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              10
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAmount(50)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              50
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAmount(100)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              100
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAmount(500)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              500
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAmount(1000)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              1K
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAmount(5000)}
              disabled={isAnimating || placeBetMutation.isPending}
            >
              5K
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full"
            size="lg"
            disabled={
              isAnimating || 
              placeBetMutation.isPending || 
              !user || 
              amount < 1 || 
              amount > 10000 || 
              (user && user.balance < amount)
            }
            onClick={handlePlaceBet}
          >
            {isAnimating || placeBetMutation.isPending ? (
              <div className="flex items-center">
                <span className="animate-spin mr-2">⏳</span>
                Dropping...
              </div>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Drop Ball
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      {/* Result Display */}
      {result && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`p-4 rounded-lg ${
              result.isWin ? 'bg-green-500/10 border border-green-500/20' : 'bg-muted/10 border border-muted/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                {result.isWin ? (
                  <Award className="h-6 w-6 text-green-500 mr-2" />
                ) : (
                  <Coins className="h-6 w-6 text-muted-foreground mr-2" />
                )}
                <div>
                  <h3 className={`font-bold ${result.isWin ? 'text-green-500' : 'text-muted-foreground'}`}>
                    {result.isWin ? 'You Won!' : 'Better Luck Next Time'}
                  </h3>
                  <p className="text-sm">
                    {result.isWin 
                      ? `${formatCurrency(result.payout)} coins with ${formatMultiplier(result.multiplier)}x multiplier!` 
                      : `Ball landed on ${formatMultiplier(result.multiplier)}x`}
                  </p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handlePlaceBet}
                disabled={isAnimating || placeBetMutation.isPending}
              >
                Play Again
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}