import { useAuth } from '@/hooks/use-auth';
import MainLayout from '@/components/layouts/main-layout';
import FeaturedGames from '@/components/featured-games';
import SlotsGame from '@/components/games/slots-game';
import DiceGame from '@/components/games/dice-game';
import CrashGame from '@/components/games/crash-game';
import TransactionHistory from '@/components/transaction-history';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';

export default function HomePage() {
  const { user } = useAuth();
  
  return (
    <MainLayout>
      <div className="w-full max-w-[1400px] px-4 md:px-6 py-4 mx-auto overflow-hidden">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#2A2A2A] to-[#1E1E1E] border border-[#333333] p-6 rounded-xl mb-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#5465FF] opacity-10 rounded-full -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00E701] opacity-10 rounded-full -ml-10 -mb-10"></div>
          
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-heading font-bold mb-2">Welcome to Crypto Casino</h2>
            <p className="text-gray-400 max-w-xl mb-4">Experience the thrill of crypto casino games with our virtual currency. Play responsibly!</p>
            <Button className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-medium py-2 px-6 rounded-lg transition duration-200">
              Get Started
            </Button>
          </div>
        </div>
        
        {/* VIP Membership Banner */}
        {!user?.subscriptionTier && (
          <div className="mb-10">
            <div className="bg-gradient-to-r from-amber-900 to-yellow-800 border border-amber-700 p-6 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-yellow-500 opacity-10 rounded-full -mr-16 -mt-16"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-amber-700 opacity-10 rounded-full -ml-10 -mb-10"></div>
              
              <div className="relative">
                <div className="flex items-center mb-2">
                  <i className="ri-vip-crown-2-line text-yellow-500 text-2xl mr-2"></i>
                  <h2 className="text-xl md:text-2xl font-heading font-bold">Upgrade to VIP Membership</h2>
                </div>
                <p className="text-amber-100 max-w-xl mb-4">Enjoy exclusive benefits including daily coin bonuses, reward multipliers, and VIP status badges!</p>
                <div className="flex flex-wrap gap-3 mb-4">
                  <div className="flex items-center px-3 py-1 bg-black bg-opacity-30 rounded-full">
                    <i className="ri-coin-line text-yellow-500 mr-1"></i>
                    <span className="text-sm">Daily Coins</span>
                  </div>
                  <div className="flex items-center px-3 py-1 bg-black bg-opacity-30 rounded-full">
                    <i className="ri-speed-up-line text-yellow-500 mr-1"></i>
                    <span className="text-sm">Win Multipliers</span>
                  </div>
                  <div className="flex items-center px-3 py-1 bg-black bg-opacity-30 rounded-full">
                    <i className="ri-award-line text-yellow-500 mr-1"></i>
                    <span className="text-sm">VIP Badges</span>
                  </div>
                </div>
                <Link href="/subscriptions">
                  <Button className="bg-yellow-600 hover:bg-yellow-500 text-white font-medium py-2 px-6 rounded-lg transition duration-200 flex items-center">
                    <i className="ri-vip-crown-2-line mr-2"></i>
                    See VIP Plans
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
        
        {/* Featured Games */}
        <div className="mb-10">
          <h2 className="text-xl font-heading font-bold mb-4">Featured Games</h2>
          <FeaturedGames />
        </div>
        
        {/* Game Previews */}
        <div className="mb-10">
          <h2 className="text-xl font-heading font-bold flex items-center mb-4">
            <i className="ri-slot-machine-line mr-2 text-[#5465FF]"></i> Slots Machine
          </h2>
          <div className="bg-[#2A2A2A] rounded-xl border border-[#333333] p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:w-1/2 mb-6 lg:mb-0">
                <h3 className="text-lg font-heading font-bold mb-2">Lucky Slots</h3>
                <p className="text-gray-400 mb-4">Spin the reels and match symbols to win. Get three identical symbols in a row to win big prizes!</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">96.5% RTP</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">10+ Paylines</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Free Spins</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Multipliers</span>
                </div>
                
                <Link href="/slots">
                  <Button className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-medium py-2 px-6 rounded-lg transition duration-200">
                    Play Full Game
                  </Button>
                </Link>
              </div>
              
              <div className="lg:w-1/2 max-w-md mx-auto">
                <SlotsGame />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-10">
          <h2 className="text-xl font-heading font-bold flex items-center mb-4">
            <i className="ri-dice-line mr-2 text-[#5465FF]"></i> Dice
          </h2>
          <div className="bg-[#2A2A2A] rounded-xl border border-[#333333] p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:w-1/2 mb-6 lg:mb-0">
                <h3 className="text-lg font-heading font-bold mb-2">Crypto Dice</h3>
                <p className="text-gray-400 mb-4">Set your target, place your bet, and roll the dice. Win if the roll matches your prediction!</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Provably Fair</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Custom Odds</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Auto Bet</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Low House Edge</span>
                </div>
                
                <Link href="/dice">
                  <Button className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-medium py-2 px-6 rounded-lg transition duration-200">
                    Play Full Game
                  </Button>
                </Link>
              </div>
              
              <div className="lg:w-1/2 max-w-md mx-auto">
                <DiceGame />
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-10">
          <h2 className="text-xl font-heading font-bold flex items-center mb-4">
            <i className="ri-rocket-line mr-2 text-[#5465FF]"></i> Crash
          </h2>
          <div className="bg-[#2A2A2A] rounded-xl border border-[#333333] p-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="lg:w-1/2 mb-6 lg:mb-0">
                <h3 className="text-lg font-heading font-bold mb-2">Rocket Crash</h3>
                <p className="text-gray-400 mb-4">Place your bet and watch the multiplier increase. Cash out before the rocket crashes to secure your winnings!</p>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Live Multiplier</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Auto Cash-out</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Game History</span>
                  <span className="text-xs bg-[#1E1E1E] px-2 py-1 rounded-full text-gray-400">Player Bets</span>
                </div>
                
                <Link href="/crash">
                  <Button className="bg-[#5465FF] hover:bg-[#6677FF] text-white font-medium py-2 px-6 rounded-lg transition duration-200">
                    Play Full Game
                  </Button>
                </Link>
              </div>
              
              <div className="lg:w-1/2 max-w-md mx-auto">
                <CrashGame />
              </div>
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="mb-10">
          <h2 className="text-xl font-heading font-bold mb-4">Recent Activity</h2>
          <TransactionHistory />
        </div>
      </div>
    </MainLayout>
  );
}
