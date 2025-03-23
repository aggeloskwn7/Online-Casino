import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/use-sound';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  BlackjackState, 
  BlackjackBet, 
  BlackjackAction, 
  BlackjackHand, 
  Card 
} from '@shared/schema';
import { 
  calculateBlackjackHandValue, 
  getCardDisplayValue, 
  getCardColor, 
  isBusted, 
  isBlackjack 
} from '@/lib/card-utils';
import { formatCurrency } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { 
  Card as UICard, 
  CardContent, 
  CardFooter 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, RefreshCw } from 'lucide-react';

export default function BlackjackGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const queryClient = useQueryClient();
  
  // Game state
  const [betAmount, setBetAmount] = useState<number>(10);
  const [gameState, setGameState] = useState<BlackjackState | null>(null);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [isDealing, setIsDealing] = useState(false);
  
  // Start a new blackjack game
  const startGameMutation = useMutation({
    mutationFn: async (data: BlackjackBet) => {
      const res = await apiRequest('POST', '/api/games/blackjack/start', data);
      return await res.json() as BlackjackState;
    },
    onSuccess: (data: BlackjackState) => {
      setGameState(data);
      setIsDealing(true);
      setActiveHandIndex(0);
      play('cardDeal');
      
      // Simulate dealing animation
      setTimeout(() => {
        setIsDealing(false);
      }, 1000);
      
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error starting game',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle player actions (hit, stand, double, split)
  const actionMutation = useMutation({
    mutationFn: async (data: { action: BlackjackAction }) => {
      const res = await apiRequest('POST', '/api/games/blackjack/action', data);
      return await res.json() as BlackjackState;
    },
    onSuccess: (data: BlackjackState) => {
      setGameState(data);
      
      // Play appropriate sounds
      if (data.status === 'player-turn') {
        play('cardDeal');
      } else if (data.status === 'dealer-turn' || data.status === 'complete') {
        play('cardDeal');
        
        // If game is complete, show outcome dialog after dealer animation
        if (data.status === 'complete') {
          setTimeout(() => {
            if (data.result === 'win') {
              play('win');
            } else if (data.result === 'lose') {
              play('lose');
            } else {
              play('cardDeal');
            }
            setShowOutcomeDialog(true);
          }, 1500);
        }
      }
      
      // Update active hand index if needed based on server state
      // The server's response includes a currentHandIndex property
      if (data.playerHands && data.currentHandIndex !== undefined) {
        setActiveHandIndex(data.currentHandIndex);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error performing action',
        description: error.message,
        variant: 'destructive',
      });
    }
  });
  
  // Handle bet amount changes
  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value > 0) {
      setBetAmount(value);
    }
  };
  
  // Start a new game with the current bet amount
  const handleStartGame = () => {
    if (user && betAmount) {
      // Validate bet amount
      if (betAmount <= 0) {
        toast({
          title: 'Invalid bet',
          description: 'Bet amount must be greater than 0',
          variant: 'destructive',
        });
        return;
      }
      
      if (betAmount > Number(user.balance)) {
        toast({
          title: 'Insufficient balance',
          description: 'You don\'t have enough balance for this bet',
          variant: 'destructive',
        });
        return;
      }
      
      startGameMutation.mutate({ amount: betAmount });
    }
  };
  
  // Handle player actions
  const handleAction = (action: BlackjackAction) => {
    if (gameState) {
      actionMutation.mutate({ action });
    }
  };
  
  // Reset game state for a new game
  const handleNewGame = () => {
    setGameState(null);
    setShowOutcomeDialog(false);
  };
  
  // Get the active hand from game state
  const getActiveHand = (): BlackjackHand | undefined => {
    if (!gameState || !gameState.playerHands) return undefined;
    return gameState.playerHands[activeHandIndex];
  };
  
  // Render a playing card
  const renderCard = (card: Card, index: number, isDealer = false, isLast = false) => {
    const isHidden = card.hidden;
    
    return (
      <div 
        key={`${card.suit}-${card.value}-${index}`}
        className={`relative w-16 h-24 md:w-20 md:h-32 rounded-md shadow-md 
                   ${isHidden ? 'bg-blue-700' : 'bg-white'} 
                   flex items-center justify-center
                   ${isLast && isDealing ? 'animate-slide-in-right' : ''}`}
        style={{
          marginLeft: index > 0 ? '-2rem' : '0',
          zIndex: index,
        }}
      >
        {!isHidden && (
          <>
            <div className={`absolute top-1 left-1 text-${getCardColor(card)}`}>
              {getCardDisplayValue(card)}
            </div>
            <div className="text-2xl">{card.suit}</div>
            <div className={`absolute bottom-1 right-1 text-${getCardColor(card)}`}>
              {getCardDisplayValue(card)}
            </div>
          </>
        )}
        {isHidden && (
          <div className="text-white text-2xl font-bold">?</div>
        )}
      </div>
    );
  };
  
  // Render a hand of cards
  const renderHand = (hand: BlackjackHand, isDealer = false) => {
    // If no cards, don't render anything
    if (!hand.cards || hand.cards.length === 0) return null;
    
    return (
      <div className="flex flex-col items-center mb-4">
        <div className="flex items-center mb-2">
          <span className="mr-2 font-bold">
            {isDealer ? 'Dealer' : 'Your Hand'}
            {!isDealer && gameState && gameState.playerHands.length > 1 && ` (${activeHandIndex + 1}/${gameState.playerHands.length})`}
          </span>
          <span className="text-lg">
            {hand.value !== undefined && !isDealer && ` - Value: ${hand.value}`}
            {isBlackjack(hand.cards) && !hand.isSplit && <Badge className="ml-2 bg-yellow-500">Blackjack!</Badge>}
            {hand.isBusted && <Badge className="ml-2 bg-red-500">Busted!</Badge>}
          </span>
        </div>
        <div className="flex">
          {hand.cards.map((card, index) => 
            renderCard(card, index, isDealer, index === hand.cards.length - 1)
          )}
        </div>
      </div>
    );
  };
  
  // Render game controls based on current state
  const renderGameControls = () => {
    if (!gameState) {
      // Game hasn't started yet, show bet controls
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <span>Bet Amount:</span>
            <Input
              type="number"
              value={betAmount}
              onChange={handleBetAmountChange}
              min={1}
              max={user ? Number(user.balance) : 100}
              className="w-24"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setBetAmount(5)}>5</Button>
            <Button onClick={() => setBetAmount(10)}>10</Button>
            <Button onClick={() => setBetAmount(25)}>25</Button>
            <Button onClick={() => setBetAmount(50)}>50</Button>
            <Button onClick={() => setBetAmount(100)}>100</Button>
          </div>
          <Button 
            onClick={handleStartGame} 
            disabled={startGameMutation.isPending}
            variant="default"
            className="mt-2"
          >
            {startGameMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            Deal Cards
          </Button>
        </div>
      );
    }
    
    // Game in progress, show action buttons
    if (gameState.status === 'player-turn') {
      const activeHand = getActiveHand();
      if (!activeHand) return null;
      
      // Get default actions if not provided by server
      const defaultActions: BlackjackAction[] = ['hit', 'stand'];
      const actions = gameState.allowedActions || defaultActions;
      
      return (
        <div className="flex flex-wrap gap-2">
          {actions.includes('hit') && (
            <Button onClick={() => handleAction('hit')} disabled={actionMutation.isPending}>Hit</Button>
          )}
          {actions.includes('stand') && (
            <Button onClick={() => handleAction('stand')} disabled={actionMutation.isPending}>Stand</Button>
          )}
          {actions.includes('double') && (
            <Button onClick={() => handleAction('double')} disabled={actionMutation.isPending}>Double</Button>
          )}
          {actions.includes('split') && (
            <Button onClick={() => handleAction('split')} disabled={actionMutation.isPending}>Split</Button>
          )}
        </div>
      );
    }
    
    // Dealer's turn, show message
    if (gameState.status === 'dealer-turn') {
      return (
        <div className="text-center">
          <p className="mb-2">Dealer is playing...</p>
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      );
    }
    
    // Game complete, show new game button
    if (gameState.status === 'complete') {
      return (
        <Button onClick={handleNewGame} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          New Game
        </Button>
      );
    }
    
    return null;
  };
  
  // Render game outcome dialog
  const renderOutcomeDialog = () => {
    if (!gameState || !showOutcomeDialog) return null;
    
    let title = '';
    let description = '';
    
    if (gameState.result === 'win') {
      title = 'You Won!';
      description = `You won ${formatCurrency(gameState.payout || 0)}`;
    } else if (gameState.result === 'lose') {
      title = 'You Lost';
      const totalBet = gameState.playerHands.reduce((sum, hand) => sum + (hand.bet || 0), 0);
      description = `You lost ${formatCurrency(totalBet)}`;
    } else if (gameState.result === 'push') {
      title = 'Push';
      description = 'It\'s a tie! Your bet has been returned.';
    }
    
    return (
      <AlertDialog open={showOutcomeDialog} onOpenChange={setShowOutcomeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleNewGame}>Play Again</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <UICard className="w-full">
        <CardContent className="p-6">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-bold mb-2">Blackjack</h2>
            <p className="text-muted-foreground">
              Try to beat the dealer by getting a hand value as close to 21 as possible without going over.
            </p>
          </div>
          
          <div className="min-h-[400px] flex flex-col justify-between">
            {/* Dealer's Cards */}
            {gameState && gameState.dealerHand && (
              <div className="mb-8">
                {renderHand(gameState.dealerHand, true)}
              </div>
            )}
            
            {/* Player's Cards */}
            {gameState && gameState.playerHands && getActiveHand() && (
              <div className="mb-8">
                {renderHand(getActiveHand()!)}
              </div>
            )}
            
            {/* Game Controls */}
            <div className="mt-auto">
              {renderGameControls()}
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="bg-muted/50 p-4 border-t flex justify-between">
          <div>
            <span className="font-medium">Balance:</span>{' '}
            <span className="text-green-600 font-bold">{formatCurrency(user?.balance || 0)}</span>
          </div>
          
          {gameState && (
            <div>
              <span className="font-medium">Bet:</span>{' '}
              <span className="text-amber-600 font-bold">
                {formatCurrency(getActiveHand()?.bet || 0)}
              </span>
            </div>
          )}
        </CardFooter>
      </UICard>
      
      {renderOutcomeDialog()}
    </div>
  );
}