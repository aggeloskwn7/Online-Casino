import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, generateCrashCurvePoints } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';

type GameState = 'idle' | 'betting' | 'in-progress' | 'crashed' | 'cashed-out';

export default function CrashGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play, stop } = useSound();
  const [betAmount, setBetAmount] = useState(1);
  const [autoCashout, setAutoCashout] = useState(2);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashoutPoint, setCashoutPoint] = useState(0);
  const [gameId, setGameId] = useState('');
  const [curvePoints, setCurvePoints] = useState<{ x: number; y: number }[]>([]);
  const [showWinMessage, setShowWinMessage] = useState(false);
  
  // Animation frame reference
  const animationRef = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  // Start crash game mutation
  const startCrashMutation = useMutation({
    mutationFn: async (data: { amount: number, autoCashout?: number }) => {
      const res = await apiRequest('POST', '/api/games/crash/start', data);
      return await res.json();
    },
    onSuccess: (data: { gameId: string, crashPoint: number, betAmount: number, autoCashout?: number }) => {
      // Update user data (balance was reduced)
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Store game data
      setGameId(data.gameId);
      setCrashPoint(data.crashPoint);
      setGameState('in-progress');
      gameStartTime.current = Date.now();
      
      // Start animation
      startAnimation(data.crashPoint);
      
      // Start sound
      play('slotSpin', { loop: true });
      
      // Auto cashout logic
      if (data.autoCashout && data.autoCashout > 1) {
        setAutoCashout(data.autoCashout);
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setGameState('idle');
    },
  });
  
  // Cashout mutation
  const cashoutMutation = useMutation({
    mutationFn: async (data: { gameId: string, amount: number, crashPoint: number, cashoutPoint: number }) => {
      const res = await apiRequest('POST', '/api/games/crash/cashout', data);
      return await res.json();
    },
    onSuccess: (data) => {
      // Update user data (balance was increased)
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Update game state
      setGameState('cashed-out');
      setCashoutPoint(data.cashoutPoint);
      
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Stop sound and play win sound
      stop('slotSpin');
      play('cashout');
      
      // Show win message with a short delay
      setTimeout(() => {
        setShowWinMessage(true);
      }, 300);
      
      // No toast notifications to avoid spoiling the result
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const startAnimation = (targetCrashPoint: number) => {
    // Reset multiplier
    setCurrentMultiplier(1);
    
    // Generate curve points
    const width = 300;
    const height = 150;
    const points = generateCrashCurvePoints(targetCrashPoint, width, height);
    setCurvePoints(points);
    
    // Start animation loop
    const animate = () => {
      const now = Date.now();
      const elapsed = (now - gameStartTime.current) / 1000;
      
      // Calculate current multiplier (exponential growth)
      // Using a custom formula to make it match the crash point
      const growthFactor = Math.log(targetCrashPoint) / 5; // Adjust time to crash
      const newMultiplier = Math.exp(elapsed * growthFactor);
      setCurrentMultiplier(Math.min(newMultiplier, targetCrashPoint));
      
      // Check if we've reached the crash point
      if (newMultiplier >= targetCrashPoint) {
        // Game crashed
        setGameState('crashed');
        stop('slotSpin');
        play('crash');
        
        // Show crash message with a short delay
        setTimeout(() => {
          setShowWinMessage(true);
        }, 300);
        
        // No toast notifications to avoid spoiling the result
        
        return;
      }
      
      // Check for auto cashout
      if (autoCashout > 1 && newMultiplier >= autoCashout && gameState === 'in-progress') {
        handleCashout();
        return;
      }
      
      // Continue animation
      animationRef.current = requestAnimationFrame(animate);
      
      // Draw curve
      drawCurve();
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  const drawCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate progress based on current multiplier vs crash point
    const progress = Math.min(currentMultiplier / crashPoint, 1);
    const visiblePoints = curvePoints.slice(0, Math.floor(progress * curvePoints.length));
    
    // Draw axes
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height); // x-axis
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(0, 0); // y-axis
    ctx.stroke();
    
    // Draw curve
    if (visiblePoints.length > 1) {
      ctx.strokeStyle = '#5465FF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
      
      for (let i = 1; i < visiblePoints.length; i++) {
        ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
      }
      
      ctx.stroke();
      
      // Draw rocket at the end of the curve
      const lastPoint = visiblePoints[visiblePoints.length - 1];
      ctx.fillStyle = '#5465FF';
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  
  const handleStartGame = () => {
    // Validate bet amount
    if (!user || betAmount <= 0 || betAmount > Number(user.balance)) {
      toast({
        title: 'Invalid bet',
        description: 'Please enter a valid bet amount',
        variant: 'destructive',
      });
      return;
    }
    
    // Start game
    setGameState('betting');
    
    // Make API call
    startCrashMutation.mutate({ 
      amount: betAmount, 
      autoCashout: autoCashout > 1 ? autoCashout : undefined 
    });
  };
  
  const handleCashout = () => {
    if (gameState !== 'in-progress' || !gameId) return;
    
    // Make API call
    cashoutMutation.mutate({
      gameId,
      amount: betAmount,
      crashPoint,
      cashoutPoint: currentMultiplier
    });
  };
  
  const handleReset = () => {
    // Reset game state
    setGameState('idle');
    setCurrentMultiplier(1);
    setCrashPoint(0);
    setCashoutPoint(0);
    setGameId('');
    setCurvePoints([]);
    setShowWinMessage(false);
    
    // Stop animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
  
  return (
    <div className="bg-[#2A2A2A] p-4 rounded-xl">
      <div className="relative h-40 mb-4 bg-[#121212] rounded-lg overflow-hidden flex items-center justify-center">
        <canvas 
          ref={canvasRef} 
          width={300} 
          height={150} 
          className="absolute inset-0 w-full h-full"
        />
        
        <div className="absolute bottom-0 left-0 w-full h-px bg-gray-700"></div>
        <div className="absolute bottom-0 left-0 h-full w-px bg-gray-700"></div>
        
        <div className="relative z-10">
          <i className="ri-rocket-line text-3xl text-[#5465FF]"></i>
          <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 font-mono font-bold text-xl">
            {gameState === 'idle' ? '1.00×' : `${currentMultiplier.toFixed(2)}×`}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
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
              disabled={gameState !== 'idle'}
            />
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#5465FF]"
              onClick={() => user && setBetAmount(Number(user.balance))}
              disabled={gameState !== 'idle'}
            >
              MAX
            </button>
          </div>
        </div>
        <div>
          <span className="text-sm text-gray-400 block mb-1">Auto Cash Out</span>
          <div className="relative">
            <Input
              type="text"
              value={autoCashout.toString()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setAutoCashout(Number(val));
              }}
              className="w-full bg-[#121212] rounded-lg border border-[#333333] p-2 font-mono"
              disabled={gameState !== 'idle'}
            />
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">×</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {gameState === 'idle' && (
          <Button
            className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-bold py-3 px-4 rounded-lg transition duration-200 col-span-2"
            onClick={handleStartGame}
            disabled={!user || betAmount > Number(user.balance)}
          >
            PLACE BET
          </Button>
        )}
        
        {gameState === 'betting' && (
          <Button
            className="bg-[#5465FF] text-white font-bold py-3 px-4 rounded-lg transition duration-200 col-span-2"
            disabled
          >
            PLACING BET...
          </Button>
        )}
        
        {gameState === 'in-progress' && (
          <>
            <Button
              className="bg-[#00E701] hover:bg-[#00FF01] text-white font-bold py-3 px-4 rounded-lg transition duration-200 col-span-2"
              onClick={handleCashout}
            >
              CASH OUT ({currentMultiplier.toFixed(2)}×)
            </Button>
          </>
        )}
        
        {(gameState === 'crashed' || gameState === 'cashed-out') && (
          <Button
            className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-bold py-3 px-4 rounded-lg transition duration-200 col-span-2"
            onClick={handleReset}
          >
            {gameState === 'cashed-out' ? 'PLAY AGAIN' : 'TRY AGAIN'}
          </Button>
        )}
      </div>
      
      <AnimatePresence>
        {gameState === 'cashed-out' && showWinMessage && (betAmount * cashoutPoint > betAmount) && (
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
              CASHED OUT!
            </motion.div>
            <motion.div 
              className="font-mono text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              {formatCurrency(betAmount * cashoutPoint)}
            </motion.div>
            <motion.div 
              className="text-sm text-gray-400 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.3 }}
            >
              Multiplier: {cashoutPoint.toFixed(2)}×
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {gameState === 'crashed' && showWinMessage && (
          <motion.div 
            className="mt-4 p-3 bg-[#121212] rounded-lg text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          >
            <motion.div 
              className="text-[#FF3A5E] font-bold mb-1"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              CRASHED!
            </motion.div>
            <motion.div 
              className="font-mono text-lg"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.3 }}
            >
              @ {crashPoint.toFixed(2)}×
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
