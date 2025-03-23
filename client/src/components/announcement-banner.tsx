import { useEffect, useState } from 'react';
import { X, AlertCircle, CheckCircle, InfoIcon, AlertTriangle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

interface Announcement {
  id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isPinned: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export function AnnouncementBanner() {
  const [activeAnnouncementIndex, setActiveAnnouncementIndex] = useState(0);
  const [isDismissed, setIsDismissed] = useState(false);

  // Fetch active announcements
  const { data, isLoading } = useQuery({
    queryKey: ['/api/announcements'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/announcements');
      return await res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const announcements: Announcement[] = data || [];
  
  // If there are multiple announcements, rotate through them
  useEffect(() => {
    if (announcements.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveAnnouncementIndex((prev) => (prev + 1) % announcements.length);
    }, 5000); // Rotate every 5 seconds
    
    return () => clearInterval(interval);
  }, [announcements.length]);

  // Reset dismissed state when announcements change
  useEffect(() => {
    setIsDismissed(false);
  }, [announcements]);

  // If no announcements or all dismissed, don't render anything
  if (isLoading || isDismissed || announcements.length === 0) return null;

  const activeAnnouncement = announcements[activeAnnouncementIndex];
  
  const getBgColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
      case 'success':
        return 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800';
      case 'warning':
        return 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800';
    }
  };

  const getTextColor = (type: string) => {
    switch (type) {
      case 'info':
        return 'text-blue-700 dark:text-blue-300';
      case 'success':
        return 'text-green-700 dark:text-green-300';
      case 'warning':
        return 'text-yellow-700 dark:text-yellow-300';
      case 'error':
        return 'text-red-700 dark:text-red-300';
      default:
        return 'text-blue-700 dark:text-blue-300';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'info':
        return <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />;
      default:
        return <InfoIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={`fixed top-0 left-0 right-0 z-50 p-3 shadow-md border-b ${getBgColor(activeAnnouncement.type)}`}
        >
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-grow">
              <div className="flex-shrink-0">
                {getIcon(activeAnnouncement.type)}
              </div>
              <div className="flex-grow">
                <h3 className={`font-semibold ${getTextColor(activeAnnouncement.type)}`}>
                  {activeAnnouncement.title}
                </h3>
                <p className={`text-sm ${getTextColor(activeAnnouncement.type)}`}>
                  {activeAnnouncement.message}
                </p>
              </div>
              {announcements.length > 1 && (
                <div className="flex items-center space-x-1 mr-4">
                  {announcements.map((_, index) => (
                    <span
                      key={index}
                      className={`h-2 w-2 rounded-full ${index === activeAnnouncementIndex ? getTextColor(activeAnnouncement.type) : 'bg-gray-300 dark:bg-gray-600'}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className={`p-0 h-8 w-8 rounded-full ${getTextColor(activeAnnouncement.type)}`}
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}