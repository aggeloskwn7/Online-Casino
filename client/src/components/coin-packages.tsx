import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Coins } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CoinPackage } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';

interface CoinPackagesProps {
  onSelectPackage: (packageId: string) => void;
}

export default function CoinPackages({ onSelectPackage }: CoinPackagesProps) {
  const { toast } = useToast();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const { data: packages, isLoading, error } = useQuery<CoinPackage[]>({
    queryKey: ['/api/coins/packages'],
    retry: 2,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (error) {
    toast({
      title: 'Error loading packages',
      description: 'Failed to load coin packages. Please try again later.',
      variant: 'destructive',
    });
  }

  const handleSelect = (packageId: string) => {
    setSelectedPackageId(packageId);
    onSelectPackage(packageId);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border shadow relative overflow-hidden">
            <CardContent className="p-6 flex flex-col space-y-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-12 w-full my-2" />
              <Skeleton className="h-10 w-full mt-4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {packages && packages.map((pkg: CoinPackage) => (
        <Card 
          key={pkg.id}
          className={`border relative overflow-hidden transition-all hover:shadow-lg cursor-pointer
            ${selectedPackageId === pkg.id ? 'border-primary shadow-md' : 'border-border'}
          `}
          onClick={() => handleSelect(pkg.id)}
        >
          {pkg.featured && (
            <div className="absolute top-0 right-0">
              <Badge variant="default" className="rounded-none rounded-bl-lg">
                Featured
              </Badge>
            </div>
          )}
          {pkg.discount && pkg.discount > 0 && (
            <div className="absolute top-0 left-0">
              <Badge variant="destructive" className="rounded-none rounded-br-lg">
                {pkg.discount}% OFF
              </Badge>
            </div>
          )}
          <CardContent className="p-6 pt-10">
            <h3 className="text-lg font-semibold mb-2">{pkg.name}</h3>
            <div className="flex items-center justify-center my-4 bg-muted/20 p-4 rounded-lg">
              <Coins className="h-8 w-8 mr-2 text-yellow-500" />
              <span className="text-3xl font-bold">{pkg.coins.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-center mb-4">
              <span className="text-xl font-bold">${pkg.price.toFixed(2)}</span>
              {pkg.discount && pkg.discount > 0 && (
                <span className="ml-2 text-muted-foreground line-through text-sm">
                  ${(pkg.price / (1 - pkg.discount / 100)).toFixed(2)}
                </span>
              )}
            </div>
            <Button 
              variant={selectedPackageId === pkg.id ? "default" : "outline"} 
              className="w-full"
              onClick={() => handleSelect(pkg.id)}
            >
              {selectedPackageId === pkg.id ? 'Selected' : 'Select Package'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}