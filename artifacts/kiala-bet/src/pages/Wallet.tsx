import { useEffect, useState } from "react";
import { useGetWallet, useListTransactions, useDepositFunds, getGetWalletQueryKey, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CreditCard, Smartphone, Banknote, ArrowDownCircle, ArrowUpCircle } from "lucide-react";

export default function Wallet() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"mpesa" | "airtel" | "card" | "demo">("demo");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { enabled: isAuthenticated, queryKey: getGetWalletQueryKey() }
  });

  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 10 }, {
    query: { enabled: isAuthenticated, queryKey: getListTransactionsQueryKey({ limit: 10 }) }
  });

  const depositMutation = useDepositFunds();

  const handleDeposit = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    depositMutation.mutate(
      { data: { amount: val, method } },
      {
        onSuccess: () => {
          toast({ title: "Deposit Successful", description: `Added KES ${val.toFixed(2)} to your wallet.` });
          setAmount("");
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 10 }) });
        },
        onError: () => {
          toast({ title: "Deposit Failed", variant: "destructive" });
        }
      }
    );
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold tracking-tight">Wallet</h1>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30">
            <CardHeader className="pb-2">
              <CardTitle>Available Balance</CardTitle>
            </CardHeader>
            <CardContent>
              {walletLoading ? (
                <div className="h-10 bg-secondary animate-pulse rounded w-1/2"></div>
              ) : (
                <>
                  <div className="text-4xl font-black text-white">KES {wallet?.balance.toFixed(2)}</div>
                  <div className="text-sm text-primary font-medium mt-1">
                    +KES {wallet?.bonusBalance.toFixed(2)} Bonus
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Deposit Funds</CardTitle>
              <CardDescription>Add money to your account to place bets.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Amount (KES)</label>
                <Input 
                  type="number" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder="0.00" 
                  className="text-lg font-bold bg-secondary"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setMethod("demo")}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border ${method === 'demo' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary hover:border-primary/50'}`}
                  >
                    <Banknote className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">Demo</span>
                  </button>
                  <button 
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-secondary/50 opacity-50 cursor-not-allowed"
                  >
                    <Smartphone className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">M-Pesa <br/>(Soon)</span>
                  </button>
                  <button 
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-secondary/50 opacity-50 cursor-not-allowed"
                  >
                    <Smartphone className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">Airtel <br/>(Soon)</span>
                  </button>
                  <button 
                    disabled
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-secondary/50 opacity-50 cursor-not-allowed"
                  >
                    <CreditCard className="h-6 w-6 mb-1" />
                    <span className="text-xs font-bold">Card <br/>(Soon)</span>
                  </button>
                </div>
              </div>

              <Button 
                className="w-full font-bold" 
                size="lg" 
                onClick={handleDeposit}
                disabled={depositMutation.isPending || !amount}
              >
                {depositMutation.isPending ? "Processing..." : "Deposit Now"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Card className="bg-card border-border h-full">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              {txLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl"></div>)}
                </div>
              ) : transactions?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Banknote className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>No transactions yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions?.map(tx => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${tx.type === 'deposit' || tx.type === 'win' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                          {tx.type === 'deposit' || tx.type === 'win' ? <ArrowDownCircle className="h-5 w-5" /> : <ArrowUpCircle className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="font-bold text-sm capitalize">{tx.description || tx.type}</p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.type === 'deposit' || tx.type === 'win' ? 'text-primary' : ''}`}>
                          {tx.type === 'deposit' || tx.type === 'win' ? '+' : '-'}KES {tx.amount.toFixed(2)}
                        </p>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          {tx.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}