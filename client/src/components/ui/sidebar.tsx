import { useAuth } from '@/hooks/use-auth';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/game-utils';

interface SidebarProps {
  mobile?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ mobile = false, onClose }: SidebarProps) {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  
  const handleLogout = () => {
    logoutMutation.mutate();
    if (onClose) onClose();
  };
  
  const NavLink = ({ href, icon, label }: { href: string; icon: string; label: string }) => {
    const isActive = location === href;
    return (
      <Link href={href}>
        <a 
          className={`flex items-center space-x-3 p-3 rounded-lg mb-1 ${
            isActive 
              ? 'text-white bg-[#5465FF] bg-opacity-20' 
              : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
          }`}
          onClick={onClose}
        >
          <i className={`${icon} text-lg`}></i>
          <span>{label}</span>
        </a>
      </Link>
    );
  };
  
  return (
    <div className={`${mobile ? 'w-64' : 'hidden lg:flex lg:w-64'} flex-col bg-[#1E1E1E] border-r border-[#333333] h-screen fixed left-0 top-0`}>
      {mobile && (
        <div className="absolute top-4 right-4">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <i className="ri-close-line text-xl"></i>
          </Button>
        </div>
      )}
      
      <div className="p-6 flex items-center justify-center border-b border-[#333333]">
        <h1 className="text-2xl font-heading font-bold bg-gradient-to-r from-[#5465FF] to-[#00E701] bg-clip-text text-transparent">CRYPTO CASINO</h1>
      </div>
      
      <div className="flex flex-col flex-grow overflow-y-auto p-4">
        <div className="mb-6">
          <p className="text-gray-400 text-xs uppercase font-semibold mb-2 tracking-wider">Main Menu</p>
          <nav>
            <NavLink href="/" icon="ri-home-4-line" label="Home" />
            <NavLink href="#" icon="ri-exchange-dollar-line" label="Transactions" />
          </nav>
        </div>
        
        <div className="mb-6">
          <p className="text-gray-400 text-xs uppercase font-semibold mb-2 tracking-wider">Games</p>
          <nav>
            <Link href="/slots">
              <a className={`flex items-center space-x-3 p-3 rounded-lg mb-1 ${
                location === '/slots' 
                  ? 'text-white bg-[#5465FF] bg-opacity-20' 
                  : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`} onClick={onClose}>
                <span className="text-lg font-bold">🎰</span>
                <span>Slots</span>
              </a>
            </Link>
            <Link href="/dice">
              <a className={`flex items-center space-x-3 p-3 rounded-lg mb-1 ${
                location === '/dice' 
                  ? 'text-white bg-[#5465FF] bg-opacity-20' 
                  : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`} onClick={onClose}>
                <span className="text-lg text-[#5465FF] font-bold">🎲</span>
                <span>Dice</span>
              </a>
            </Link>
            <Link href="/crash">
              <a className={`flex items-center space-x-3 p-3 rounded-lg mb-1 ${
                location === '/crash' 
                  ? 'text-white bg-[#5465FF] bg-opacity-20' 
                  : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`} onClick={onClose}>
                <span className="text-lg font-bold">🚀</span>
                <span>Crash</span>
              </a>
            </Link>
            <Link href="/roulette">
              <a className={`flex items-center space-x-3 p-3 rounded-lg mb-1 ${
                location === '/roulette' 
                  ? 'text-white bg-[#5465FF] bg-opacity-20' 
                  : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'
              }`} onClick={onClose}>
                <span className="text-lg font-bold">🎯</span>
                <span>Roulette</span>
              </a>
            </Link>
          </nav>
        </div>
      </div>
      
      <div className="p-4 border-t border-[#333333]">
        <div className="bg-[#2A2A2A] rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-400">Balance</p>
            <span className="text-xs bg-[#5465FF] bg-opacity-20 text-[#5465FF] px-2 py-1 rounded">DEMO</span>
          </div>
          <div className="flex items-center space-x-1">
            <i className="ri-coin-line text-yellow-500"></i>
            <span className="font-mono text-xl font-medium">
              {user ? formatCurrency(user.balance) : '0.00'}
            </span>
          </div>
        </div>
        
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-[#5465FF] flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user.username.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <span className="font-medium">{user.username}</span>
            </div>
            <button 
              className="text-gray-400 hover:text-white"
              onClick={handleLogout}
            >
              <i className="ri-logout-box-r-line"></i>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
