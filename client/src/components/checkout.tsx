import { useState, useEffect } from 'react';
import { 
  PaymentElement, 
  useStripe, 
  useElements,
  Elements
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { CoinPackage } from '@shared/schema';

// Make sure to call loadStripe outside of a component
// to avoid recreating the Stripe object on every render
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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe) {
      return;
    }

    // Check to see if this is a redirect back from Stripe
    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) {
      return;
    }

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (paymentIntent) {
        switch (paymentIntent.status) {
          case 'succeeded':
            setMessage('Payment succeeded!');
            onSuccess();
            break;
          case 'processing':
            setMessage('Your payment is processing.');
            break;
          case 'requires_payment_method':
            setMessage('Please provide a payment method.');
            break;
          default:
            setMessage('Something went wrong.');
            break;
        }
      }
    });
  }, [stripe, onSuccess]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!stripe || !elements) {
      // Stripe.js hasn't yet loaded
      return;
    }

    setIsLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin,
      },
      redirect: 'if_required',
    });

    if (error) {
      setMessage(error.message || 'An unexpected error occurred.');
    } else {
      // Payment succeeded
      toast({
        title: 'Payment Successful!',
        description: `You have purchased ${packageDetails.coins.toLocaleString()} coins.`,
        variant: 'default',
      });
      onSuccess();
      
      // Invalidate queries to refresh user balance
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
    }

    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement />
      {message && (
        <Alert className="mt-4">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="flex justify-between mt-4">
        <Button 
          type="button" 
          variant="outline" 
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={!stripe || !elements || isLoading}
        >
          {isLoading ? (
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
  const { toast } = useToast();
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [packageDetails, setPackageDetails] = useState<CoinPackage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!packageId || !user) return;

    apiRequest('POST', '/api/coins/create-payment-intent', {
      packageId
    })
      .then((response) => response.json())
      .then((data) => {
        setClientSecret(data.clientSecret);
        setPackageDetails(data.packageDetails);
      })
      .catch((err) => {
        setError('Failed to initialize payment. Please try again.');
        toast({
          title: 'Payment Error',
          description: err.message || 'Failed to initialize payment',
          variant: 'destructive',
        });
      });
  }, [packageId, user, toast]);

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Error</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter>
          <Button onClick={onCancel} className="w-full">
            Go Back
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (!clientSecret || !packageDetails) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const options = {
    clientSecret,
    appearance: {
      theme: 'night',
      labels: 'floating',
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <CheckoutForm 
        clientSecret={clientSecret} 
        packageDetails={packageDetails}
        onSuccess={onSuccess}
        onCancel={onCancel}
      />
    </Elements>
  );
}