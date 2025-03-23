import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layouts/main-layout";
import { Loader2, Gift, Calendar, Trophy, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/game-utils";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

// Reward calendar item component
const RewardCalendarItem = ({ 
  day, 
  amount, 
  currentStreak, 
  claimed = false, 
  isMilestone = false 
}: { 
  day: number, 
  amount: number, 
  currentStreak: number, 
  claimed?: boolean, 
  isMilestone?: boolean 
}) => {
  const isPast = day < currentStreak;
  const isToday = day === currentStreak;
  const isFuture = day > currentStreak;

  return (
    <div className={`
      p-3 rounded-lg border flex flex-col items-center justify-center text-center
      ${isPast ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
      ${isToday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 ring-2 ring-blue-500 dark:ring-blue-400' : ''}
      ${isMilestone ? 'border-yellow-300 dark:border-yellow-700' : 'border-gray-200 dark:border-gray-800'}
      ${isFuture ? 'opacity-70' : ''}
    `}>
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center mb-1
        ${isPast ? 'bg-green-500 text-white' : ''}
        ${isToday ? 'bg-blue-500 text-white' : ''}
        ${isMilestone ? 'bg-yellow-400 dark:bg-yellow-600 text-black dark:text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}
        ${isFuture ? 'bg-gray-200 dark:bg-gray-700' : ''}
      `}>
        {isPast ? <Check size={16} /> : day}
      </div>
      <div className="text-xs font-medium mt-1">
        {formatCurrency(amount)}
      </div>
      {isMilestone && (
        <div className="mt-1">
          <Trophy size={14} className="text-yellow-500" />
        </div>
      )}
    </div>
  );
};

// Reward history item component
const RewardHistoryItem = ({ day, amount, date }: { day: number, amount: number, date: string }) => {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center">
        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400 flex items-center justify-center mr-3">
          <Gift size={16} />
        </div>
        <div>
          <div className="font-medium">Day {day} Reward</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(date).toLocaleDateString()}
          </div>
        </div>
      </div>
      <div className="font-semibold text-green-600 dark:text-green-400">
        +{formatCurrency(amount)}
      </div>
    </div>
  );
};

export default function RewardsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAnimation, setShowAnimation] = useState(false);
  const [rewardAmount, setRewardAmount] = useState(0);

  // Fetch the daily reward check
  const { 
    data: rewardStatus, 
    isLoading: isCheckingReward 
  } = useQuery({ 
    queryKey: ['/api/rewards/check'],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchOnWindowFocus: true
  });

  // Fetch the reward schedule
  const { 
    data: rewardSchedule, 
    isLoading: isLoadingSchedule 
  } = useQuery({ 
    queryKey: ['/api/rewards/schedule'],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Fetch the user's reward history
  const { 
    data: rewardHistory, 
    isLoading: isLoadingHistory 
  } = useQuery({ 
    queryKey: ['/api/rewards/history'],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  // Mutation for claiming the daily reward
  const claimRewardMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/rewards/claim");
      return await res.json();
    },
    onSuccess: (data) => {
      setRewardAmount(data.rewardAmount);
      setShowAnimation(true);
      
      // Invalidate relevant queries to update the UI
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/check'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/history'] });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      // Show toast after animation completes
      setTimeout(() => {
        toast({
          title: "Daily Reward Claimed!",
          description: `You received ${formatCurrency(data.rewardAmount)} coins!`,
          variant: "success",
        });
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to claim reward",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Close the animation after it plays
  useEffect(() => {
    if (showAnimation) {
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showAnimation]);

  if (isCheckingReward || isLoadingSchedule || isLoadingHistory) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-5xl py-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Daily Rewards</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Log in daily to receive increasing rewards for up to 30 days!
        </p>

        {/* Daily login reward card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2">
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Calendar className="mr-2 h-5 w-5" />
                  Daily Login Rewards
                </CardTitle>
                <CardDescription>
                  Log in daily to build your streak and earn increasing rewards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Current Streak: Day {rewardStatus?.streak || 0}</span>
                    <span>Next Milestone: Day {Math.ceil((rewardStatus?.nextRewardDay || 1) / 5) * 5}</span>
                  </div>
                  <Progress 
                    value={((rewardStatus?.streak || 0) % 5) * 20} 
                    className="h-2" 
                  />
                </div>
                
                <div className="grid grid-cols-5 gap-2 mb-6">
                  {rewardSchedule?.slice(0, 10).map((reward: any) => (
                    <RewardCalendarItem 
                      key={reward.day}
                      day={reward.day}
                      amount={reward.amount}
                      currentStreak={rewardStatus?.nextRewardDay || 1}
                      isMilestone={reward.isMilestone}
                      claimed={reward.day < (rewardStatus?.nextRewardDay || 1)}
                    />
                  ))}
                </div>
                
                <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <div className="flex items-center">
                    <Trophy size={16} className="text-yellow-500 mr-1" />
                    <span>Milestone days (5, 7, 10, 14, etc.) offer bonus rewards!</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={() => claimRewardMutation.mutate()}
                  disabled={!rewardStatus?.isEligible || claimRewardMutation.isPending}
                  className="w-full"
                >
                  {claimRewardMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Gift className="h-4 w-4 mr-2" />
                  )}
                  {rewardStatus?.isEligible 
                    ? `Claim Day ${rewardStatus?.nextRewardDay} Reward`
                    : "Already Claimed Today"}
                </Button>
              </CardFooter>
            </Card>
          </div>
          
          <div>
            <Card className="w-full h-full">
              <CardHeader>
                <CardTitle>Reward History</CardTitle>
                <CardDescription>Your most recent rewards</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] overflow-y-auto">
                {rewardHistory?.length > 0 ? (
                  <div>
                    {rewardHistory.slice(0, 10).map((reward: any, index: number) => (
                      <div key={reward.id}>
                        <RewardHistoryItem 
                          day={reward.day}
                          amount={parseFloat(reward.amount)}
                          date={reward.createdAt}
                        />
                        {index < rewardHistory.slice(0, 10).length - 1 && (
                          <Separator className="my-2" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Gift className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No rewards claimed yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Reward calendar for days 11-30 */}
        <Card className="w-full mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
              Rewards Calendar
            </CardTitle>
            <CardDescription>
              See all 30 days of daily login rewards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mb-2">
              {rewardSchedule?.slice(10, 20).map((reward: any) => (
                <RewardCalendarItem 
                  key={reward.day}
                  day={reward.day}
                  amount={reward.amount}
                  currentStreak={rewardStatus?.nextRewardDay || 1}
                  isMilestone={reward.isMilestone}
                  claimed={reward.day < (rewardStatus?.nextRewardDay || 1)}
                />
              ))}
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {rewardSchedule?.slice(20, 30).map((reward: any) => (
                <RewardCalendarItem 
                  key={reward.day}
                  day={reward.day}
                  amount={reward.amount}
                  currentStreak={rewardStatus?.nextRewardDay || 1}
                  isMilestone={reward.isMilestone}
                  claimed={reward.day < (rewardStatus?.nextRewardDay || 1)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* How it works */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="mt-1 mr-4 flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  1
                </div>
                <div>
                  <h3 className="font-medium">Log in daily</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visit the site each day to maintain your streak. Missing a day will reset your streak to 0.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="mt-1 mr-4 flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  2
                </div>
                <div>
                  <h3 className="font-medium">Claim your reward</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Once per day, you can claim coins based on your current streak day.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="mt-1 mr-4 flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  3
                </div>
                <div>
                  <h3 className="font-medium">Reach milestones for bonuses</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Every 5th day (5, 10, 15...) gives a 1.5x bonus. Weekly milestones (7, 14, 21, 28) give a 2x bonus. 
                    Day 30 gives a special 3x bonus!
                  </p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="mt-1 mr-4 flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  4
                </div>
                <div>
                  <h3 className="font-medium">Complete all 30 days</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    After completing all 30 days, your streak will reset to day 1, and you can start earning again!
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Reward animation overlay */}
      {showAnimation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="bg-gradient-to-br from-yellow-300 to-amber-600 p-8 rounded-xl shadow-2xl text-center"
          >
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Trophy className="h-16 w-16 mx-auto mb-4 text-white" />
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-3xl font-bold text-white mb-2">Daily Reward!</h2>
              <p className="text-xl text-white/90 mb-4">You've received</p>
              <p className="text-4xl font-bold text-white mb-2">
                {formatCurrency(rewardAmount)}
              </p>
              <p className="text-white/80">Day {rewardStatus?.streak} completed!</p>
            </motion.div>
          </motion.div>
        </div>
      )}
    </MainLayout>
  );
}