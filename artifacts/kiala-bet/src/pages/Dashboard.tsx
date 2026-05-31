import { useEffect, useState } from "react";
import { useGetDashboard, getGetDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useLocation } from "wouter";
import { Wallet, History, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const { isAuthenticated, isLoading: authLoading, user, logout } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: dashboard, isLoading } = useGetDashboard({
    query: {
      enabled: isAuthenticated,
      queryKey: getGetDashboardQueryKey(),
    }
  });

  if (authLoading || !isAuthenticated) return null;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!dashboard) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.username}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => logout()}>Logout</Button>
          <Button asChild><Link href="/wallet">Deposit Funds</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">KES {dashboard.wallet.balance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              +KES {dashboard.wallet.bonusBalance.toFixed(2)} Bonus
            </p>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Bets</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{dashboard.pendingBets}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Waiting for results
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Won</CardTitle>
            <Trophy className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-primary">KES {dashboard.betSummary.totalWon.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Lifetime winnings
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(dashboard.betSummary.winRate * 100).toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Based on {dashboard.betSummary.totalBets} total bets
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Bets</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bets">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {dashboard.recentBets.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No recent bets.
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.recentBets.map(bet => (
                  <div key={bet.id} className="flex justify-between items-center p-3 rounded-lg bg-secondary/50">
                    <div>
                      <div className="font-bold text-sm">
                        {bet.type === 'single' ? 'Single' : 'Accumulator'} Bet
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(bet.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">KES {bet.stake.toFixed(2)}</div>
                      <div className={`text-xs font-bold uppercase ${
                        bet.status === 'won' ? 'text-primary' : 
                        bet.status === 'lost' ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {bet.status}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Active Bonuses</CardTitle>
          </CardHeader>
          <CardContent>
            {dashboard.activeBonuses.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                No active bonuses at the moment.
              </div>
            ) : (
              <div className="space-y-4">
                {dashboard.activeBonuses.map(bonus => (
                  <div key={bonus.id} className="flex justify-between items-center p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <div className="flex items-center gap-3">
                      <Gift className="h-5 w-5 text-primary" />
                      <div>
                        <div className="font-bold text-sm capitalize">{bonus.type} Bonus</div>
                        <div className="text-xs text-muted-foreground">
                          Expires: {bonus.expiresAt ? new Date(bonus.expiresAt).toLocaleDateString() : 'Never'}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-primary text-lg">
                      KES {bonus.amount.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
// Note: Adding a local import fix for Gift icon
import { Gift } from "lucide-react";