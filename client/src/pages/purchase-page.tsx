import { useState } from 'react';
import MainLayout from '@/components/layouts/main-layout';
import { ProtectedRoute } from '@/lib/protected-route';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Coins, CreditCard } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import CoinPackages from '@/components/coin-packages';
import Checkout from '@/components/checkout';
import { useLocation } from 'wouter';

enum PurchaseStep {
  SELECT_PACKAGE = 'select_package',
  CHECKOUT = 'checkout',
  SUCCESS = 'success'
}

export function PurchasePage() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<PurchaseStep>(PurchaseStep.SELECT_PACKAGE);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);

  const handleContinue = () => {
    if (!selectedPackageId) {
      toast({
        title: 'No Package Selected',
        description: 'Please select a coin package to continue',
        variant: 'destructive',
      });
      return;
    }

    setStep(PurchaseStep.CHECKOUT);
  };

  const handleCancel = () => {
    if (step === PurchaseStep.CHECKOUT) {
      setStep(PurchaseStep.SELECT_PACKAGE);
    } else {
      navigate('/');
    }
  };

  const handleSuccess = () => {
    setStep(PurchaseStep.SUCCESS);
    toast({
      title: 'Purchase Completed!',
      description: 'Your coins have been added to your account',
    });
  };

  return (
    <div className="container max-w-6xl py-8">
      <Card className="border-none shadow-none bg-transparent">
        <CardHeader>
          <div className="flex items-center">
            <Coins className="h-6 w-6 mr-2 text-yellow-500" />
            <CardTitle>Purchase Coins</CardTitle>
          </div>
          <CardDescription>
            Add more coins to your account to continue playing games
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === PurchaseStep.SELECT_PACKAGE && (
            <>
              <CoinPackages onSelectPackage={setSelectedPackageId} />
              
              <div className="mt-8 flex justify-end">
                <Button 
                  className="ml-2" 
                  onClick={handleContinue}
                  disabled={!selectedPackageId}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Continue to Payment
                </Button>
              </div>
            </>
          )}

          {step === PurchaseStep.CHECKOUT && selectedPackageId && (
            <Card className="border shadow">
              <CardHeader>
                <CardTitle>Secure Checkout</CardTitle>
                <CardDescription>
                  Your payment is processed securely through Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Checkout
                  packageId={selectedPackageId}
                  onSuccess={handleSuccess}
                  onCancel={handleCancel}
                />
              </CardContent>
            </Card>
          )}

          {step === PurchaseStep.SUCCESS && (
            <Card className="border border-green-500 shadow">
              <CardHeader>
                <CardTitle className="text-green-500">Purchase Successful!</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">
                  Your coins have been added to your account balance. Thank you for your purchase!
                </p>
                <div className="flex space-x-2">
                  <Button onClick={() => navigate('/')}>Return to Home</Button>
                  <Button variant="outline" onClick={() => setStep(PurchaseStep.SELECT_PACKAGE)}>
                    Make Another Purchase
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      <div className="mt-8">
        <Separator className="my-4" />
        <div className="text-sm text-muted-foreground">
          <h3 className="font-medium mb-2">Important Information:</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>Coins are virtual currency and have no real-world value</li>
            <li>All purchases are final and non-refundable</li>
            <li>Purchased coins will be added to your account immediately after payment</li>
            <li>For any issues with your purchase, please contact customer support</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function ProtectedPurchasePage() {
  return <ProtectedRoute path="/purchase" component={PurchasePage} />;
}