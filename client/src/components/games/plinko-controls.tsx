import { useState, useEffect, ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useSound } from "@/hooks/use-sound";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/game-utils";
import { ArrowUp, ArrowDown, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlinkoResult, BetData, RiskLevel } from "@/types/plinko-types";

interface PlinkoControlsProps {
  onBetPlaced: (result: PlinkoResult) => void;
  isAnimating: boolean;
  risk?: RiskLevel;
  onRiskChange?: (risk: RiskLevel) => void;
}

export function PlinkoControls({ 
  onBetPlaced, 
  isAnimating, 
  risk: externalRisk,
  onRiskChange 
}: PlinkoControlsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  
  const [amount, setAmount] = useState<number>(10);
  // Use external risk if provided, otherwise default to medium
  const [risk, setRisk] = useState<RiskLevel>(externalRisk || 'medium');
  
  // Handle local risk changes and notify parent
  const handleRiskChange = (newRisk: RiskLevel) => {
    setRisk(newRisk);
    if (onRiskChange) {
      onRiskChange(newRisk);
    }
  };
  
  // Sync with external risk prop when it changes
  useEffect(() => {
    if (externalRisk && externalRisk !== risk) {
      setRisk(externalRisk);
    }
  }, [externalRisk, risk]);
  
  // Mutation for placing a bet
  const placeBetMutation = useMutation<PlinkoResult, Error, BetData>({
    mutationFn: async (data: BetData) => {
      console.log('Sending bet data:', data);
      const res = await apiRequest('POST', '/api/games/plinko', data);
      return await res.json();
    },
    onSuccess: (data: PlinkoResult) => {
      console.log('Received successful result:', data);
      // Pass the result to the parent component
      onBetPlaced(data);
      
      // Invalidate user data to update the balance
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/transactions'] });
      
      // Play sounds
      play('bet');
    },
    onError: (error: any) => {
      console.error('Plinko bet error:', error.response ? error.response.data : error.message);
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
    
    // Removed maximum bet limit check as per requirements
    
    if (Number(user.balance) < amount) {
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
  
  const handleAmountChange = (e: ChangeEvent<HTMLInputElement>): void => {
    const newAmount = parseInt(e.target.value, 10) || 0;
    setAmount(newAmount);
  };
  
  const adjustAmount = (adjustment: number): void => {
    const newAmount = Math.max(1, amount + adjustment);
    setAmount(newAmount);
  };
  
  return (
    <Card className="shadow-sm h-full">
      <CardHeader className="pb-2">
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
            onValueChange={(value: RiskLevel) => handleRiskChange(value)}
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
          
          {/* Risk level explanation */}
          <div className="rounded-md p-3 text-xs bg-muted/50">
            {risk === "low" && (
              <>
                <span className="font-semibold text-green-500">Low Risk:</span>
                <ul className="mt-1 space-y-1 list-disc pl-4">
                  <li>More consistent small wins (up to 2x)</li>
                  <li>90% chance to win something</li>
                  <li>Max payout: 2x your bet</li>
                </ul>
              </>
            )}
            {risk === "medium" && (
              <>
                <span className="font-semibold text-yellow-500">Medium Risk:</span>
                <ul className="mt-1 space-y-1 list-disc pl-4">
                  <li>Balanced risk and reward</li>
                  <li>35% chance to win something</li>
                  <li>Max payout: 4x your bet</li>
                </ul>
              </>
            )}
            {risk === "high" && (
              <>
                <span className="font-semibold text-red-500">High Risk:</span>
                <ul className="mt-1 space-y-1 list-disc pl-4">
                  <li>Mostly losses, but huge potential wins</li>
                  <li>20% chance to win something</li>
                  <li>Max payout: 15x your bet</li>
                </ul>
              </>
            )}
          </div>
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
                  setAmount(Math.floor(Number(user.balance)));
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
          variant="default"
          disabled={
            isAnimating || 
            placeBetMutation.isPending || 
            !user || 
            amount < 1 || 
            (user && Number(user.balance) < amount)
          }
          onClick={handlePlaceBet}
        >
          {isAnimating || placeBetMutation.isPending ? (
            <div className="flex items-center justify-center">
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
  );
}