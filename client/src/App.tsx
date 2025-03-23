import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "./hooks/use-auth";
import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import SlotsPage from "@/pages/slots-page";
import DicePage from "@/pages/dice-page";
import CrashPage from "@/pages/crash-page";
import RoulettePage from "@/pages/roulette-page";
import BlackjackPage from "@/pages/blackjack-page";
import AdminPage from "@/pages/admin-page";
import { ProtectedRoute } from "./lib/protected-route";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <ProtectedRoute path="/slots" component={SlotsPage} />
      <ProtectedRoute path="/dice" component={DicePage} />
      <ProtectedRoute path="/crash" component={CrashPage} />
      <ProtectedRoute path="/roulette" component={RoulettePage} />
      <ProtectedRoute path="/blackjack" component={BlackjackPage} />
      <ProtectedRoute path="/admin" component={AdminPage} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
