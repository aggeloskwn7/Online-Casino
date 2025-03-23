import { useEffect, useState } from 'react';
import { 
  useStripe, 
  useElements, 
  PaymentElement,
  Elements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CoinPackage } from '@shared/schema';

// Make sure to call loadStripe outside of a component's render to avoid
// recreating the Stripe object on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

interface CheckoutFormProps {
  clientSecret: string;
  packageDetails: CoinPackage;
  onSuccess: () => void;
  onCancel: () => void;
}

function CheckoutForm({ clientSecret, packageDetails, onSuccess, onCancel }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + '/purchase',
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          title: 'Payment Failed',
          description: error.message || 'Something went wrong with your payment.',
          variant: 'destructive',
        });
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        toast({
          title: 'Payment Successful',
          description: `You purchased ${packageDetails.coins.toLocaleString()} coins!`,
        });
        onSuccess();
      } else {
        toast({
          title: 'Payment Status',
          description: 'Your payment is processing.',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement className="mb-6" />
      
      <div className="mt-4 border-t pt-4">
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground">Package:</span>
          <span className="font-medium">{packageDetails.name}</span>
        </div>
        <div className="flex justify-between mb-2">
          <span className="text-muted-foreground">Coins:</span>
          <span className="font-medium">{packageDetails.coins.toLocaleString()}</span>
        </div>
        {packageDetails.discount > 0 && (
          <div className="flex justify-between mb-2">
            <span className="text-muted-foreground">Discount:</span>
            <span className="font-medium text-green-500">{packageDetails.discount}% OFF</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-lg mt-2 pt-2 border-t">
          <span>Total:</span>
          <span>${packageDetails.price.toFixed(2)}</span>
        </div>
      </div>
      
      <div className="flex justify-between mt-6">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isProcessing}
        >
          Back
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || !elements || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${packageDetails.price.toFixed(2)}`
          )}
        </Button>
      </div>
    </form>
  );
}

interface CheckoutProps {
  packageId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function Checkout({ packageId, onSuccess, onCancel }: CheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const { toast } = useToast();
  
  // Get package details
  const { data: packages, isLoading: isPackagesLoading } = useQuery({
    queryKey: ['/api/coins/packages'],
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  
  const packageDetails = packages?.find((pkg: CoinPackage) => pkg.id === packageId);
  
  // Create payment intent
  const { mutate: createPaymentIntent, isPending: isCreatingPayment } = useMutation({
    mutationFn: async () => {
      if (!packageDetails) throw new Error('Package not found');
      
      const res = await apiRequest('POST', '/api/coins/create-payment-intent', {
        packageId,
        amount: packageDetails.price
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to create payment');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
    },
    onError: (error: Error) => {
      toast({
        title: 'Payment Setup Failed',
        description: error.message || 'Could not initialize payment. Please try again.',
        variant: 'destructive',
      });
      onCancel();
    }
  });
  
  // When package details are loaded, create payment intent
  useEffect(() => {
    if (packageDetails && !clientSecret && !isCreatingPayment) {
      createPaymentIntent();
    }
  }, [packageDetails, clientSecret, isCreatingPayment, createPaymentIntent]);
  
  // Show loading state
  if (isPackagesLoading || isCreatingPayment || !clientSecret || !packageDetails) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Setting up payment...</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ 
      clientSecret,
      appearance: {
        theme: 'night',
        labels: 'floating'
      }
    }}>
      <CheckoutForm 
        clientSecret={clientSecret} 
        packageDetails={packageDetails}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}