import { useGreeting } from "@/hooks/use-greeting";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { data, isLoading, error } = useGreeting();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-destructive">
        Error loading greeting
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Abstract minimal background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-gray-100 to-transparent rounded-full blur-3xl -z-10 opacity-60" />

      <main className="text-center space-y-6 max-w-3xl animate-in fade-in slide-in-from-bottom-8 duration-700 ease-out">
        <span className="inline-block px-3 py-1 text-xs font-medium tracking-widest uppercase text-muted-foreground border border-border rounded-full bg-secondary/30">
          Welcome
        </span>
        
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-display text-primary leading-tight text-balance">
          {data?.message || "Hello World"}
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-lg mx-auto leading-relaxed">
          A minimalist starting point for something extraordinary. Clean lines, clear typography, and infinite potential.
        </p>
      </main>
      
      <footer className="absolute bottom-8 text-xs text-muted-foreground/50 font-mono">
        v1.0.0 &middot; system status: online
      </footer>
    </div>
  );
}
