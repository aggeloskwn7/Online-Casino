import { useAuth } from '@/hooks/use-auth';
import { Link, useLocation } from 'wouter';
import { formatCurrency } from '@/lib/game-utils';

interface MobileNavProps {
  type?: 'top' | 'bottom';
  onMenuClick?: () => void;
}

export default function MobileNav({ type = 'top', onMenuClick }: MobileNavProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  
  if (type === 'top') {
    return (
      <header className="lg:hidden bg-[#1E1E1E] border-b border-[#333333] p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button className="text-2xl" onClick={onMenuClick}>
            <i className="ri-menu-line"></i>
          </button>
          <h1 className="text-xl font-heading font-bold bg-gradient-to-r from-[#5465FF] to-[#00E701] bg-clip-text text-transparent">CRYPTO CASINO</h1>
          <div className="flex items-center space-x-1">
            <i className="ri-coin-line text-yellow-500"></i>
            <span className="font-mono font-medium">
              {user ? formatCurrency(user.balance) : '0.00'}
            </span>
          </div>
        </div>
      </header>
    );
  }
  
  // Bottom navigation
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#1E1E1E] border-t border-[#333333] flex justify-around py-2 z-10">
      <Link href="/">
        <a className={`flex flex-col items-center p-2 ${location === '/' ? 'text-[#5465FF]' : 'text-gray-400'}`}>
          <i className="ri-home-4-line text-lg"></i>
          <span className="text-xs mt-1">Home</span>
        </a>
      </Link>
      <Link href="/slots">
        <a className={`flex flex-col items-center p-2 ${location === '/slots' ? 'text-[#5465FF]' : 'text-gray-400'}`}>
          <i className="ri-slot-machine-line text-lg"></i>
          <span className="text-xs mt-1">Slots</span>
        </a>
      </Link>
      <Link href="/dice">
        <a className={`flex flex-col items-center p-2 ${location === '/dice' ? 'text-[#5465FF]' : 'text-gray-400'}`}>
          <i className="ri-dice-line text-lg"></i>
          <span className="text-xs mt-1">Dice</span>
        </a>
      </Link>
      <Link href="/crash">
        <a className={`flex flex-col items-center p-2 ${location === '/crash' ? 'text-[#5465FF]' : 'text-gray-400'}`}>
          <i className="ri-rocket-line text-lg"></i>
          <span className="text-xs mt-1">Crash</span>
        </a>
      </Link>
    </nav>
  );
}
