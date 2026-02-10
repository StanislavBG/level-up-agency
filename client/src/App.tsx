import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import PracticeSession from "@/pages/PracticeSession";
import Assessment from "@/pages/Assessment";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/session/:id" component={PracticeSession} />
      <Route path="/assessment/:sessionId" component={Assessment} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
