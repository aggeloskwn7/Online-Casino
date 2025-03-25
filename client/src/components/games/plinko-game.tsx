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
import { 
  PlinkoResult, 
  RiskLevel, 
  BallPosition, 
  Bucket, 
  PathStep, 
  PinPosition 
} from '@/types/plinko-types';

// Define the pin grid dimensions
const ROWS = 10; // Number of rows of pins
const BUCKET_COUNT = 11; // Number of buckets (should match multipliers array length)
const PIN_SIZE = 10;
// Create responsive spacing based on viewport width
const getSpacing = () => {
  // Check if window is available (client-side)
  if (typeof window !== 'undefined') {
    // For mobile screens, use smaller spacing
    if (window.innerWidth < 480) {
      return { x: 24, y: 24 };
    }
    // For small tablets
    else if (window.innerWidth < 768) {
      return { x: 32, y: 32 };
    }
    // For larger screens
    else {
      return { x: 40, y: 40 };
    }
  }
  // Default fallback for SSR
  return { x: 40, y: 40 };
};

// Initial spacing values - will be updated in useEffect
const PIN_SPACING_X = 40;
const PIN_SPACING_Y = 40;
const PIN_RADIUS = PIN_SIZE / 2;
const BALL_SIZE = 14;
// These values will be dynamically calculated based on screen size
let BOARD_WIDTH = PIN_SPACING_X * (BUCKET_COUNT);
let BOARD_HEIGHT = PIN_SPACING_Y * ROWS + 60; // Extra space for buckets

// Define multiplier buckets for different risk levels - buckets match the number of pins in the last row
// These should match server-side values in games.ts
const MULTIPLIERS: Record<RiskLevel, number[]> = {
  // Low risk: More balanced, mostly small multipliers, no extreme values
  low: [2.0, 1.5, 1.2, 0.9, 0.7, 0.6, 0.7, 0.9, 1.2, 1.5, 2.0],
  
  // Medium risk: More variation, higher highs and lower lows
  medium: [4.0, 2.5, 1.5, 1.0, 0.5, 0.2, 0.5, 1.0, 1.5, 2.5, 4.0],
  
  // High risk: Extreme variation, very high highs and very low lows
  high: [15.0, 7.0, 3.0, 1.0, 0.5, 0.1, 0.5, 1.0, 3.0, 7.0, 15.0]
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

// Calculate bucket positions - centered precisely in the card
const calculateBuckets = (riskLevel: RiskLevel): Bucket[] => {
  const multipliers = MULTIPLIERS[riskLevel];
  
  // Get total width of all buckets combined
  const bucketWidth = PIN_SPACING_X; // Each bucket has width equal to pin spacing
  const totalBucketsWidth = bucketWidth * multipliers.length;
  
  // Center the buckets in the card by starting from the center point
  const centerX = BOARD_WIDTH / 2;
  const startX = centerX - (totalBucketsWidth / 2);
  
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
  risk?: RiskLevel; // Add risk prop
  onRiskChange?: (risk: RiskLevel) => void; // Add risk change callback
}

export default function PlinkoGame({ 
  onResultChange, 
  onAnimatingChange,
  externalResult,
  risk: externalRisk, // Use a different name to avoid conflict
  onRiskChange 
}: PlinkoGameProps = {}) {
  const { play } = useSound();
  const { toast } = useToast();
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<PathStep[] | null>(null);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  // Use external risk if provided, otherwise default to medium
  const [risk, setRisk] = useState<RiskLevel>(externalRisk || 'medium');
  const [pins, setPins] = useState<PinPosition[]>(calculatePins());
  const [buckets, setBuckets] = useState<Bucket[]>(calculateBuckets('medium'));
  const [ballPosition, setBallPosition] = useState<BallPosition>({ x: BOARD_WIDTH / 2, y: 0 });
  const [landingBucket, setLandingBucket] = useState<number | null>(null);
  // Add state for spacing
  const [spacing, setSpacing] = useState({ x: PIN_SPACING_X, y: PIN_SPACING_Y });
  const [boardDimensions, setBoardDimensions] = useState({ width: BOARD_WIDTH, height: BOARD_HEIGHT });
  
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a resize handler to recalculate board dimensions based on screen size
  useEffect(() => {
    const handleResize = () => {
      const newSpacing = getSpacing();
      // Update spacing values
      setSpacing(newSpacing);
      
      // Recalculate board dimensions
      const newWidth = newSpacing.x * BUCKET_COUNT;
      const newHeight = newSpacing.y * ROWS + 60;
      
      setBoardDimensions({ width: newWidth, height: newHeight });
      
      // Recalculate pins with new spacing
      const pinPositions = calculatePinsWithSpacing(newSpacing.x, newSpacing.y);
      setPins(pinPositions);
      
      // Recalculate buckets with new spacing
      setBuckets(calculateBucketsWithSpacing(risk, newSpacing.x, newWidth));
    };
    
    // Call once on mount
    handleResize();
    
    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [risk]);
  
  // Helper functions to calculate pins and buckets with dynamic spacing
  const calculatePinsWithSpacing = (spacingX: number, spacingY: number): PinPosition[] => {
    const pins: PinPosition[] = [];
    const boardWidth = spacingX * BUCKET_COUNT;
    const centerX = boardWidth / 2;
    
    for (let row = 0; row < ROWS; row++) {
      const pinsInRow = row + 1;
      const rowWidth = (pinsInRow - 1) * spacingX;
      const startX = centerX - rowWidth / 2;
      
      for (let i = 0; i < pinsInRow; i++) {
        pins.push({
          row,
          x: startX + i * spacingX,
          y: row * spacingY + 60,
          radius: PIN_RADIUS
        });
      }
    }
    
    return pins;
  };
  
  const calculateBucketsWithSpacing = (riskLevel: RiskLevel, spacingX: number, boardWidth: number): Bucket[] => {
    const multipliers = MULTIPLIERS[riskLevel];
    const bucketWidth = spacingX;
    const totalBucketsWidth = bucketWidth * multipliers.length;
    const centerX = boardWidth / 2;
    const startX = centerX - (totalBucketsWidth / 2);
    
    return multipliers.map((multiplier: number, index: number) => {
      return {
        x: startX + index * bucketWidth,
        width: bucketWidth,
        multiplier
      };
    });
  };
  
  // Update buckets when risk level changes or when result contains multipliers
  useEffect(() => {
    // If we have external result with multipliers from the server, use those
    if (result?.multipliers) {
      // Calculate buckets using server's multipliers 
      const bucketWidth = PIN_SPACING_X;
      const totalBucketsWidth = bucketWidth * result.multipliers.length;
      const centerX = BOARD_WIDTH / 2;
      const startX = centerX - (totalBucketsWidth / 2);
      
      const serverBuckets = result.multipliers.map((multiplier: number, index: number) => {
        return {
          x: startX + index * bucketWidth,
          width: bucketWidth,
          multiplier
        };
      });
      
      setBuckets(serverBuckets);
    } else {
      // Otherwise use client-side multipliers based on risk level
      setBuckets(calculateBuckets(risk));
    }
  }, [risk, result]);
  
  // Update internal state when external result changes
  useEffect(() => {
    if (externalResult && !isAnimating) {
      setResult(externalResult);
      // Use the risk level directly from server response
      setRisk(externalResult.risk);
      animateBall(externalResult.path);
      
      console.log('Received game result from server:', externalResult);
      if (externalResult.multipliers) {
        console.log('Using server-provided multipliers:', externalResult.multipliers);
      }
    }
  }, [externalResult]);
  
  // Sync with external risk level
  useEffect(() => {
    if (externalRisk && externalRisk !== risk) {
      setRisk(externalRisk);
      console.log('Risk level updated from parent:', externalRisk);
    }
  }, [externalRisk, risk]);
  
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
  
  // Notify parent component of risk changes
  useEffect(() => {
    if (onRiskChange) {
      onRiskChange(risk);
    }
  }, [risk, onRiskChange]);
  
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
    
    // Dynamic step duration - ball starts slow, speeds up, then slows down again for realism
    // Overall much slower animation as requested
    const getStepDuration = (step: number, total: number): number => {
      // Start slow (falling from top)
      if (step < total * 0.2) {
        return 700 - (step * 15); // Starts at 700ms, gradually speeds up
      } 
      // Middle section - faster (ball has momentum) but still slower than before
      else if (step < total * 0.8) {
        return 450;
      } 
      // End section - slows down as it approaches the buckets
      else {
        const remainingSteps = total - step;
        return 450 + ((total * 0.2 - remainingSteps) * 30); // Gradually slows down to 580ms
      }
    };
    
    const animate = (): void => {
      if (currentStep >= totalSteps) {
        // Animation complete
        setIsAnimating(false);
        
        // Get the final position from the path
        const finalPosition = fullPath[fullPath.length - 1].position;
        // Match the bucket directly with the final position
        const safeBucketIndex = Math.min(Math.max(0, finalPosition), buckets.length - 1);
        setLandingBucket(safeBucketIndex);
        
        // Calculate the final position using the exact same bucket centering math
        const bucketWidth = PIN_SPACING_X;
        const totalBucketsWidth = bucketWidth * BUCKET_COUNT;
        const centerX = BOARD_WIDTH / 2;
        const startX = centerX - (totalBucketsWidth / 2);
        const finalX = startX + safeBucketIndex * bucketWidth + bucketWidth / 2;
        
        // Add a much more pronounced bounce effect in the bucket for a more satisfying landing
        // First position - higher in the bucket for dramatic effect
        setBallPosition({ 
          x: finalX,
          y: BOARD_HEIGHT - 45 // Higher position for initial bounce
        });
        
        // Start a more pronounced bounce sequence - longer and more steps
        setTimeout(() => {
          // First bounce - down very low in bucket
          setBallPosition({ 
            x: finalX,
            y: BOARD_HEIGHT - 10 // Lower position (bounce down)
          });
          
          setTimeout(() => {
            // Second bounce - higher
            setBallPosition({ 
              x: finalX,
              y: BOARD_HEIGHT - 28
            });
            
            setTimeout(() => {
              // Third bounce - down again
              setBallPosition({ 
                x: finalX,
                y: BOARD_HEIGHT - 15
              });
              
              setTimeout(() => {
                // Fourth bounce - up slightly
                setBallPosition({ 
                  x: finalX,
                  y: BOARD_HEIGHT - 22
                });
                
                setTimeout(() => {
                  // Final resting position
                  setBallPosition({ 
                    x: finalX,
                    y: BOARD_HEIGHT - 20 // Final position
                  });
                }, 120);
              }, 120);
            }, 120);
          }, 150);
        }, 180);
        
        // Play sound based on win/loss
        if (result && result.isWin) {
          play('win');
        } else {
          play('lose');
        }
        
        // Removed toast notifications as requested
        
        return;
      }
      
      // Calculate new position based on pin locations
      const pathStep = fullPath[currentStep];
      let newX = 0;
      let newY = 0;
      
      if (pathStep.row < ROWS) {
        // For pins (rows 0 to ROWS-1), use the pin calculation
        const pinsInRow = pathStep.row + 1;
        const centerX = BOARD_WIDTH / 2;
        const rowWidth = (pinsInRow - 1) * PIN_SPACING_X;
        const startX = centerX - rowWidth / 2;
        newX = startX + pathStep.position * PIN_SPACING_X;
        newY = pathStep.row * PIN_SPACING_Y + 60;
      } else {
        // For the final row (buckets), use the bucket calculation
        const bucketWidth = PIN_SPACING_X;
        const totalBucketsWidth = bucketWidth * BUCKET_COUNT;
        const centerX = BOARD_WIDTH / 2;
        const startX = centerX - (totalBucketsWidth / 2);
        newX = startX + pathStep.position * bucketWidth + bucketWidth / 2;
        newY = BOARD_HEIGHT - 20;
      }
      
      // Add realistic physics with jitter and pin deflection effects
      // Calculate the relative path progress (0 to 1)
      const progress = currentStep / totalSteps;
      
      // Jitter amount increases as the ball gains speed then reduces at the end
      let jitterAmount = 0;
      if (progress < 0.2) {
        // Starting - minimal jitter
        jitterAmount = 1 + (progress * 5); 
      } else if (progress < 0.8) {
        // Middle - maximum jitter (ball moving fast)
        jitterAmount = 4;
      } else {
        // End - reducing jitter (ball slowing down)
        jitterAmount = 4 * (1 - ((progress - 0.8) / 0.2));
      }
      
      // Calculate jitter in X direction
      const jitterX = Math.random() * jitterAmount - jitterAmount/2;
      
      // Add small vertical jitter when hitting pins (but not at the end)
      const jitterY = currentStep < totalSteps - 2 
        ? Math.random() * 2 - 1 
        : 0;
      
      // Calculate deflection effect (when ball hits pin)
      let deflectionX = 0;
      if (currentStep > 0 && currentStep < totalSteps - 1 && fullPath[currentStep-1].position !== fullPath[currentStep].position) {
        // Ball changed direction from previous pin - add deflection
        deflectionX = fullPath[currentStep].position > fullPath[currentStep-1].position ? -2 : 2;
      }
      
      // Update ball position with realistic physics effects
      setBallPosition({ 
        x: newX + jitterX + deflectionX, 
        y: newY + jitterY 
      });
      
      // Play pin hit sound
      if (currentStep > 0 && currentStep < totalSteps - 1) {
        play('click');
      }
      
      // Move to next step with dynamic duration based on current position
      currentStep++;
      
      // Calculate the duration for the next step based on position
      const nextDuration = getStepDuration(currentStep, totalSteps);
      
      // Schedule next animation frame with dynamic timing
      animationRef.current = setTimeout(animate, nextDuration);
    };
    
    // Start animation with initial duration
    const initialDuration = getStepDuration(0, totalSteps);
    animationRef.current = setTimeout(animate, initialDuration);
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
      
      {/* Game board container */}
      <div className="flex flex-col items-center">
        <div 
          className="relative bg-gradient-to-b from-background/80 to-background border rounded-lg overflow-hidden"
          style={{ 
            width: Math.min(boardDimensions.width + 60, 700),
            height: Math.min(boardDimensions.height + 40, 600),
            maxWidth: "100%",
            transition: "width 0.3s, height 0.3s" // Smooth transition when dimensions change
          }}
        >
          {/* Center everything inside the container */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Dynamic size board for pins and buckets */}
            <div 
              className="relative scale-[0.9] sm:scale-100" 
              style={{ 
                width: boardDimensions.width, 
                height: boardDimensions.height,
                transition: "width 0.3s, height 0.3s" // Smooth transition when dimensions change
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
              
              {/* Bucket separators */}
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
              
              {/* Buckets */}
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
                      clipPath: 'polygon(0% 20%, 50% 0%, 100% 20%, 100% 100%, 0% 100%)'
                    }}
                  >
                    {formatMultiplier(bucket.multiplier)}×
                  </div>
                ))}
              </div>
              
              {/* Ball */}
              <AnimatePresence>
                {isAnimating && (
                  <motion.div
                    className="absolute rounded-full z-10 overflow-hidden"
                    style={{
                      width: BALL_SIZE,
                      height: BALL_SIZE,
                      background: 'radial-gradient(circle at 35% 35%, #ffea00 5%, #ffbe00 60%, #ff9800 100%)',
                      boxShadow: '0 0 10px 2px rgba(255, 190, 0, 0.3), inset 0 0 6px 1px rgba(255, 255, 255, 0.5)'
                    }}
                    initial={{ 
                      x: BOARD_WIDTH / 2 - BALL_SIZE / 2,
                      y: -BALL_SIZE,
                      rotate: 0
                    }}
                    animate={{ 
                      x: ballPosition.x - BALL_SIZE / 2,
                      y: ballPosition.y - BALL_SIZE / 2,
                      // Add rotation based on position for a rolling effect
                      rotate: ballPosition.x * 0.5
                    }}
                    transition={{ 
                      type: 'spring', 
                      damping: 14, 
                      stiffness: 90,
                      mass: 1.2
                    }}
                  >
                    {/* Shine effect */}
                    <div 
                      className="absolute"
                      style={{
                        width: '40%',
                        height: '40%',
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
                        top: '15%',
                        left: '15%',
                        borderRadius: '50%'
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      
      {/* Result Display removed as requested */}
    </div>
  );
}