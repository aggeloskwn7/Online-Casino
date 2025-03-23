import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { CoinPackage } from '@shared/schema';
import { Loader2, Coins } from 'lucide-react';
import { formatCurrency } from '@/lib/game-utils';

interface CoinPackagesProps {
  onSelectPackage: (packageId: string) => void;
}

export default function CoinPackages({ onSelectPackage }: CoinPackagesProps) {
  const { toast } = useToast();
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  
  const { data: packages, isLoading, error } = useQuery<CoinPackage[]>({
    queryKey: ['/api/coins/packages'],
    onError: (error: Error) => {
      toast({
        title: 'Failed to load coin packages',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (error || !packages) {
    return (
      <div className="text-center p-4">
        <p className="text-destructive">Failed to load coin packages</p>
        <Button onClick={() => window.location.reload()} variant="outline" className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }
  
  const handleSelectPackage = (packageId: string) => {
    setSelectedPackageId(packageId);
    onSelectPackage(packageId);
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {packages.map((pkg) => {
        // Calculate original price if there's a discount
        const originalPrice = pkg.discount ? (pkg.price / (1 - pkg.discount / 100)).toFixed(2) : null;
        
        return (
          <Card 
            key={pkg.id} 
            className={`overflow-hidden transition-all duration-300 ${
              pkg.featured ? 'border-primary shadow-lg' : ''
            } ${selectedPackageId === pkg.id ? 'ring-2 ring-primary' : ''}`}
          >
            {pkg.featured && (
              <div className="bg-primary text-primary-foreground text-center py-1 text-sm font-medium">
                MOST POPULAR
              </div>
            )}
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                {pkg.name}
                {pkg.discount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {pkg.discount}% OFF
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Best value for casual players</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center items-center mb-4">
                <Coins className="h-10 w-10 text-yellow-500 mr-2" />
                <span className="text-3xl font-bold">{pkg.coins.toLocaleString()}</span>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">${pkg.price.toFixed(2)}</div>
                {originalPrice && (
                  <div className="text-sm text-muted-foreground line-through">
                    ${originalPrice}
                  </div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {formatCurrency(pkg.coins / pkg.price)} coins per dollar
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={() => handleSelectPackage(pkg.id)}
                variant={selectedPackageId === pkg.id ? "default" : pkg.featured ? "default" : "outline"}
              >
                {selectedPackageId === pkg.id ? 'Selected' : 'Select Package'}
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}