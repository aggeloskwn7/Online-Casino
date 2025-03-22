import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Define featured games
const featuredGames = [
  {
    id: 'slots',
    name: 'Lucky Slots',
    description: 'Classic slot machine with multiple paylines',
    path: '/slots',
    icon: 'ri-slot-machine-line',
    rating: 4.5,
    tag: 'Popular',
    tagColor: '#5465FF',
    preview: (
      <div className="flex space-x-2">
        <div className="w-16 h-28 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-4xl">🍒</div>
        <div className="w-16 h-28 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-4xl">7️⃣</div>
        <div className="w-16 h-28 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-4xl">💎</div>
      </div>
    )
  },
  {
    id: 'dice',
    name: 'Crypto Dice',
    description: 'Bet on dice rolls with customizable odds',
    path: '/dice',
    icon: 'ri-dice-line',
    rating: 4.0,
    preview: (
      <div className="flex space-x-4">
        <div className="w-16 h-16 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-3xl relative">
          <div className="absolute w-4 h-4 rounded-full bg-white top-2 left-2"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white bottom-2 right-2"></div>
        </div>
        <div className="w-16 h-16 bg-[#2A2A2A] rounded-lg flex items-center justify-center text-3xl relative">
          <div className="absolute w-4 h-4 rounded-full bg-white top-2 left-2"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white top-2 right-2"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white bottom-2 left-2"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white bottom-2 right-2"></div>
          <div className="absolute w-4 h-4 rounded-full bg-white m-auto inset-0"></div>
        </div>
      </div>
    )
  },
  {
    id: 'crash',
    name: 'Rocket Crash',
    description: 'Cash out before the rocket crashes',
    path: '/crash',
    icon: 'ri-rocket-line',
    rating: 5.0,
    tag: 'Trending',
    tagColor: '#00E701',
    preview: (
      <div className="relative">
        <div className="w-20 h-20 rounded-full bg-[#5465FF] bg-opacity-20 flex items-center justify-center">
          <i className="ri-rocket-line text-3xl text-[#5465FF]"></i>
        </div>
        <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 font-mono font-bold text-[#00E701] text-xl">
          2.35x
        </div>
      </div>
    )
  }
];

export default function FeaturedGames() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {featuredGames.map((game) => (
        <div 
          key={game.id}
          className="bg-[#2A2A2A] rounded-xl overflow-hidden border border-[#333333] hover:border-[#5465FF] transition duration-200"
        >
          <div className="h-40 relative overflow-hidden bg-[#1E1E1E]">
            <div className="absolute inset-0 flex items-center justify-center">
              {game.preview}
            </div>
            {game.tag && (
              <div className="absolute bottom-0 left-0 w-full p-2 bg-gradient-to-t from-[#121212] to-transparent">
                <span 
                  className="text-xs px-2 py-1 rounded-full"
                  style={{ 
                    backgroundColor: `${game.tagColor}20`, 
                    color: game.tagColor 
                  }}
                >
                  {game.tag}
                </span>
              </div>
            )}
          </div>
          <div className="p-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-heading font-bold">{game.name}</h3>
              <div className="flex items-center space-x-1 text-yellow-500">
                {Array(5).fill(0).map((_, i) => {
                  const value = game.rating - i;
                  return (
                    <i 
                      key={i} 
                      className={`
                        text-xs
                        ${value >= 1 ? 'ri-star-fill' : value >= 0.5 ? 'ri-star-half-fill' : 'ri-star-line'}
                      `}
                    ></i>
                  );
                })}
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-3">{game.description}</p>
            <Link href={game.path}>
              <Button className="w-full bg-[#5465FF] hover:bg-[#6677FF] text-white font-medium py-2 rounded-lg transition duration-200">
                Play Now
              </Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
