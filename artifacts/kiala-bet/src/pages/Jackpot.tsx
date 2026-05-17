import { useEffect, useState } from "react";
import { useListJackpots } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Clock } from "lucide-react";

export default function Jackpot() {
  const { data: jackpots, isLoading } = useListJackpots();

  // Simple countdown component
  const Countdown = ({ targetDate }: { targetDate: string }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
      const target = new Date(targetDate).getTime();
      
      const interval = setInterval(() => {
        const now = new Date().getTime();
        const distance = target - now;
        
        if (distance < 0) {
          clearInterval(interval);
          setTimeLeft("CLOSED");
          return;
        }
        
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
      }, 1000);
      
      return () => clearInterval(interval);
    }, [targetDate]);

    return (
      <div className="flex items-center gap-2 font-mono text-xl font-bold bg-background/50 px-4 py-2 rounded-lg text-primary">
        <Clock className="h-5 w-5" />
        {timeLeft}
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300 inline-block uppercase tracking-tighter">
          Kiala Jackpots
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Predict all matches correctly to win massive cash prizes. Play the Mega Jackpot on weekends or Midweek Jackpot.
        </p>
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80 w-full rounded-2xl" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      ) : jackpots && jackpots.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {jackpots.map(jackpot => (
            <Card key={jackpot.id} className="bg-card border-primary/20 overflow-hidden relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />
              <CardHeader className="text-center relative z-10 pb-2 border-b border-border/50">
                <div className="mx-auto bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-2xl uppercase tracking-wider font-black">{jackpot.name}</CardTitle>
                <div className="text-5xl font-black text-primary my-4 tracking-tighter">
                  ${jackpot.poolAmount.toLocaleString()}
                </div>
                <div className="flex justify-center mb-4">
                  <Countdown targetDate={jackpot.drawDate} />
                </div>
              </CardHeader>
              <CardContent className="relative z-10 p-6 bg-secondary/30">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold">Ticket Price</p>
                    <p className="text-xl font-bold">${jackpot.ticketPrice}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase font-bold text-right">Fixtures</p>
                    <p className="text-xl font-bold text-right">{jackpot.fixtures?.length || 0}</p>
                  </div>
                </div>
                <Button className="w-full font-bold text-lg h-14" size="lg">
                  Play Now
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-card rounded-xl border border-border">
          <p className="text-xl font-bold text-muted-foreground">No active jackpots at the moment.</p>
        </div>
      )}
    </div>
  );
}