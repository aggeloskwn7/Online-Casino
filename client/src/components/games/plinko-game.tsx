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
const ROWS = 10; // Number of rows of pins
const BUCKET_COUNT = 11; // Number of buckets (should match multipliers array length)
const PIN_SIZE = 10;
const PIN_SPACING_X = 40;
const PIN_SPACING_Y = 40;
const PIN_RADIUS = PIN_SIZE / 2;
const BALL_SIZE = 14;
const BOARD_WIDTH = PIN_SPACING_X * (BUCKET_COUNT);
const BOARD_HEIGHT = PIN_SPACING_Y * ROWS + 60; // Extra space for buckets

// Define multiplier buckets for different risk levels - buckets match the number of pins in the last row
const MULTIPLIERS: Record<RiskLevel, number[]> = {
  low: [2.0, 1.5, 1.0, 0.8, 0.5, 0.8, 1.0, 1.5, 2.0, 3.0, 4.0],
  medium: [5.0, 3.0, 2.0, 1.0, 0.5, 0.2, 0.5, 1.0, 2.0, 3.0, 5.0],
  high: [10.0, 5.0, 3.0, 1.5, 0.5, 0.1, 0.5, 1.5, 3.0, 5.0, 10.0]
};

// Calculate pin positions - ensure they line up with buckets
const calculatePins = (): PinPosition[] => {
  const pins: PinPosition[] = [];
  
  // Calculate the center point of the board
  const centerX = BOARD_WIDTH / 2;
  
  // Start from the top with a single pin
  for (let row = 0; row < ROWS; row++) {
    const pinsInRow = row + 1;
    // Total width of pins in this row
    const rowWidth = (pinsInRow - 1) * PIN_SPACING_X;
    // Calculate starting X to center pins on the board
    const startX = centerX - rowWidth / 2;
    
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

// Calculate bucket positions - precisely align with pins in the last row
const calculateBuckets = (riskLevel: RiskLevel): Bucket[] => {
  const multipliers = MULTIPLIERS[riskLevel];
  
  // Use the same center-based calculation as with pins
  const centerX = BOARD_WIDTH / 2;
  // Total width of the entire last row of pins
  const rowWidth = (ROWS - 1) * PIN_SPACING_X;
  // Starting position for buckets, aligned with where pins would be
  const startX = centerX - rowWidth / 2;
  
  const bucketWidth = PIN_SPACING_X; // Equal to spacing between pins
  
  return multipliers.map((multiplier: number, index: number) => {
    // Calculate position to align with where balls would fall
    return {
      x: startX + index * bucketWidth,
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
        
        // Get the final position from the path
        const finalPosition = fullPath[fullPath.length - 1].position;
        // Match the bucket directly with the final position
        const safeBucketIndex = Math.min(Math.max(0, finalPosition), buckets.length - 1);
        setLandingBucket(safeBucketIndex);
        
        // Get the exact position of the bucket from our buckets array
        const bucket = buckets[safeBucketIndex];
        // Center the ball in the bucket - position it where it looks visually correct
        setBallPosition({ 
          x: bucket.x + (bucket.width / 2), 
          y: BOARD_HEIGHT - 20 // Adjust vertical position to match the sloped bucket top
        });
        
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
      
      // Calculate new position based on pin locations
      const pathStep = fullPath[currentStep];
      // Use the exact same calculation logic as our pins
      const pinsInRow = pathStep.row + 1;
      const centerX = BOARD_WIDTH / 2;
      const rowWidth = (pinsInRow - 1) * PIN_SPACING_X;
      const startX = centerX - rowWidth / 2;
      const x = startX + pathStep.position * PIN_SPACING_X;
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
          
          {/* Bucket separators - vertical lines to separate buckets */}
          <div className="absolute" style={{ bottom: 0, left: 0, width: "100%", height: 45 }}>
            {buckets.slice(0, -1).map((bucket, index) => (
              <div 
                key={`separator-${index}`}
                className="absolute h-full w-[1px] bg-primary/30"
                style={{ 
                  left: bucket.x + bucket.width,
                  zIndex: 5
                }}
              />
            ))}
          </div>
          
          {/* Multiplier Buckets - Positioned directly below the pins for proper alignment */}
          <div className="absolute" style={{ bottom: 0, left: 0, width: "100%", height: 40 }}>
            {buckets.map((bucket, index) => (
              <div
                key={`bucket-${index}`}
                className={`absolute flex items-center justify-center text-xs font-bold ${
                  landingBucket === index 
                    ? bucket.multiplier >= 1 
                      ? 'bg-green-500/30 text-green-500' 
                      : 'bg-red-500/30 text-red-500'
                    : bucket.multiplier >= 1 
                      ? 'bg-primary/20 text-primary' 
                      : 'bg-muted/40 text-muted-foreground'
                }`}
                style={{
                  left: bucket.x,
                  width: bucket.width,
                  height: "100%",
                  // Add sloped tops to buckets
                  clipPath: 'polygon(0% 20%, 50% 0%, 100% 20%, 100% 100%, 0% 100%)'
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