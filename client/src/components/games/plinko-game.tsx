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
const ROWS = 10; // Reduced from 16
const COLUMNS = 11; // Reduced from 17
const PIN_SIZE = 10; // Reduced from 14
const PIN_SPACING_X = 40; // Reduced from 45
const PIN_SPACING_Y = 40; // Reduced from 45
const PIN_RADIUS = PIN_SIZE / 2;
const BALL_SIZE = 14; // Reduced from 16
const BOARD_WIDTH = PIN_SPACING_X * (COLUMNS - 1);
const BOARD_HEIGHT = PIN_SPACING_Y * ROWS + 100; // Reduced extra space

// Define multiplier buckets for different risk levels - buckets match the number of pins in the last row
const MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [2.0, 1.5, 1.0, 0.8, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0],
  medium: [5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.5, 1.0, 2.0, 3.0, 5.0],
  high: [10.0, 5.0, 3.0, 1.5, 0.5, 0.1, 0.5, 1.5, 3.0, 5.0, 10.0]
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
interface PlinkoGameProps {
  onResultChange?: (result: PlinkoResult | null) => void;
  onAnimatingChange?: (isAnimating: boolean) => void;
  externalResult?: PlinkoResult | null;
}

export default function PlinkoGame({ 
  onResultChange, 
  onAnimatingChange,
  externalResult 
}: PlinkoGameProps = {}) {
  const { play } = useSound();
  const { toast } = useToast();
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<PathStep[] | null>(null);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  const [risk, setRisk] = useState<RiskLevel>('medium');
  const [pins, setPins] = useState<PinPosition[]>(calculatePins());
  const [buckets, setBuckets] = useState<Bucket[]>(calculateBuckets('medium'));
  const [ballPosition, setBallPosition] = useState<BallPosition>({ x: BOARD_WIDTH / 2, y: 0 });
  const [landingBucket, setLandingBucket] = useState<number | null>(null);
  
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Update buckets when risk level changes
  useEffect(() => {
    setBuckets(calculateBuckets(risk));
  }, [risk]);
  
  // Update internal state when external result changes
  useEffect(() => {
    if (externalResult && !isAnimating) {
      setResult(externalResult);
      setRisk(externalResult.path[0]?.row === 0 ? 'medium' : externalResult.path[0].position === 0 ? 'low' : 'high');
      animateBall(externalResult.path);
    }
  }, [externalResult]);
  
  // Notify parent component of animation state changes
  useEffect(() => {
    if (onAnimatingChange) {
      onAnimatingChange(isAnimating);
    }
  }, [isAnimating, onAnimatingChange]);
  
  // Notify parent component of result changes
  useEffect(() => {
    if (onResultChange) {
      onResultChange(result);
    }
  }, [result, onResultChange]);
  
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
        
        // Update ball position to land in the bucket
        const bucketWidth = BOARD_WIDTH / buckets.length;
        const bucketCenter = (safeBucketIndex * bucketWidth) + (bucketWidth / 2);
        setBallPosition({ x: bucketCenter, y: BOARD_HEIGHT - 25 });
        
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
  
  // Handle play again by replaying the current animation
  const handlePlayAgain = (): void => {
    if (result && !isAnimating) {
      animateBall(result.path);
    }
  };
  
  return (
    <div className="p-4">
      <div className="text-center mb-4">
        <p className="text-muted-foreground">
          Watch the ball drop and win big with multipliers up to 100x!
        </p>
      </div>
      
      {/* Game board - Full width */}
      <div className="flex flex-col items-center">
        <div 
          className="relative bg-gradient-to-b from-background/80 to-background border rounded-lg overflow-hidden"
          style={{ 
            width: Math.min(BOARD_WIDTH + 50, 700), 
            height: Math.min(BOARD_HEIGHT + 60, 600), // Increased height for buckets
            maxWidth: "100%" 
          }}
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
          
          {/* Bucket separators - little triangles pointing up to separate buckets */}
          <div className="absolute" style={{ bottom: 40, left: 0, width: "100%", height: 10 }}>
            {Array.from({ length: buckets.length - 1 }).map((_, index) => (
              <div 
                key={`separator-${index}`}
                className="absolute border-t-primary border-t-[5px] border-l-transparent border-l-[5px] border-r-transparent border-r-[5px]"
                style={{ 
                  left: `${((index + 1) / buckets.length) * 100}%`,
                  transform: 'translateX(-50%)',
                  zIndex: 5
                }}
              />
            ))}
          </div>
          
          {/* Multiplier Buckets - Directly below the pins INSIDE the board */}
          <div 
            className="absolute flex"
            style={{ 
              width: "100%",
              bottom: 5,
              left: 0,
              height: 40
            }}
          >
            {buckets.map((bucket, index) => (
              <div
                key={`bucket-${index}`}
                className={`flex-1 flex items-center justify-center text-xs font-bold border-r last:border-r-0 ${
                  landingBucket === index 
                    ? bucket.multiplier >= 1 
                      ? 'bg-green-500/30 text-green-500 border-green-500/50' 
                      : 'bg-red-500/30 text-red-500 border-red-500/50'
                    : bucket.multiplier >= 1 
                      ? 'bg-primary/20 text-primary border-primary/30' 
                      : 'bg-muted/40 text-muted-foreground border-muted/30'
                }`}
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
      
      {/* Result Display - Below everything */}
      {result && (
        <div className="mt-6">
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
                  onClick={handlePlayAgain}
                  disabled={isAnimating}
                >
                  Play Again
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}