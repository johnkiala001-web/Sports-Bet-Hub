import { useEffect } from "react";
import { useListBets, getListBetsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";

export default function Bets() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: bets, isLoading } = useListBets({}, {
    query: { enabled: isAuthenticated, queryKey: getListBetsQueryKey({}) }
  });

  if (authLoading || !isAuthenticated) return null;

  const renderBetsList = (filterStatus: string | null) => {
    if (isLoading) {
      return (
        <div className="space-y-4 mt-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl bg-card" />)}
        </div>
      );
    }

    const filteredBets = filterStatus 
      ? bets?.filter(b => b.status === filterStatus) 
      : bets;

    if (!filteredBets || filteredBets.length === 0) {
      return (
        <div className="text-center py-20 bg-card rounded-xl border border-border mt-4 text-muted-foreground">
          <p className="font-bold text-lg mb-1">No bets found</p>
          <p className="text-sm">You don't have any bets in this category.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4 mt-4">
        {filteredBets.map(bet => (
          <Card key={bet.id} className="bg-card border-border overflow-hidden">
            <div className={`h-1 w-full ${
              bet.status === 'won' ? 'bg-primary' : 
              bet.status === 'lost' ? 'bg-destructive' : 'bg-muted-foreground'
            }`} />
            <CardContent className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="bg-secondary text-secondary-foreground text-xs font-bold px-2 py-1 rounded">
                    {bet.type.toUpperCase()}
                  </span>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(bet.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`font-black uppercase tracking-wide text-sm ${
                    bet.status === 'won' ? 'text-primary' : 
                    bet.status === 'lost' ? 'text-destructive' : 'text-muted-foreground'
                  }`}>
                    {bet.status}
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4 border-y border-border/50 py-3">
                {bet.selections.map(sel => (
                  <div key={sel.id} className="text-sm flex justify-between items-center">
                    <div>
                      <span className="font-bold">{sel.homeTeam} vs {sel.awayTeam}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{sel.market}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold">{sel.label}</span>
                      <span className="text-primary font-bold">{sel.odds.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center bg-secondary/30 p-3 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-bold">Stake</p>
                  <p className="font-bold">${bet.stake.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Total Odds</p>
                  <p className="font-bold">{bet.totalOdds.toFixed(2)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase font-bold">Potential Win</p>
                  <p className="font-black text-primary">${bet.potentialWin.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold tracking-tight">My Bets</h1>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-card border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">All Bets</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
          <TabsTrigger value="lost">Lost</TabsTrigger>
        </TabsList>

        <TabsContent value="all">{renderBetsList(null)}</TabsContent>
        <TabsContent value="pending">{renderBetsList('pending')}</TabsContent>
        <TabsContent value="won">{renderBetsList('won')}</TabsContent>
        <TabsContent value="lost">{renderBetsList('lost')}</TabsContent>
      </Tabs>
    </div>
  );
}