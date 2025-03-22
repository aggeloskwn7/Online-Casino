import { ReactNode, useState } from 'react';
import Sidebar from '@/components/ui/sidebar';
import MobileNav from '@/components/ui/mobile-nav';

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setMobileMenuOpen(prev => !prev);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-[#121212] text-white">
      {/* Sidebar (desktop) */}
      <Sidebar />
      
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-80 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      {/* Mobile sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:hidden z-50 transition-transform duration-300 ease-in-out`}>
        <Sidebar mobile onClose={() => setMobileMenuOpen(false)} />
      </div>
      
      {/* Main content */}
      <div className="flex-grow lg:ml-64">
        {/* Top Nav (Mobile & Tablet) */}
        <MobileNav onMenuClick={toggleMobileMenu} />
        
        {/* Main content area */}
        <main className="p-4 md:p-6 lg:p-8 pb-20 lg:pb-8">
          {children}
        </main>
        
        {/* Mobile Navigation (Fixed Bottom) */}
        <MobileNav type="bottom" />
      </div>
    </div>
  );
}
