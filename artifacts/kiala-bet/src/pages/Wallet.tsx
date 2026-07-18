import { useEffect, useState } from "react";
import { useGetWallet, useListTransactions, useDepositFunds, getGetWalletQueryKey, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CreditCard, Smartphone, Banknote, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MpesaStep = "idle" | "sending" | "waiting_pin" | "success";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000, 5000];

export default function Wallet() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<"mpesa" | "demo">("mpesa");
  const [phone, setPhone] = useState<string>("");
  const [mpesaStep, setMpesaStep] = useState<MpesaStep>("idle");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { enabled: isAuthenticated, queryKey: getGetWalletQueryKey() }
  });

  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 20 }, {
    query: { enabled: isAuthenticated, queryKey: getListTransactionsQueryKey({ limit: 20 }) }
  });

  const depositMutation = useDepositFunds();

  const handleMpesaDeposit = async () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val < 10) {
      toast({ title: "Minimum deposit is KES 10", variant: "destructive" });
      return;
    }
    const normalizedPhone = phone.replace(/\s/g, "");
    if (!normalizedPhone || !/^(07|01|2547|2541|\+2547|\+2541)\d{7,8}$/.test(normalizedPhone)) {
      toast({ title: "Enter a valid M-Pesa number (e.g. 0712345678)", variant: "destructive" });
      return;
    }

    setMpesaStep("sending");
    // Simulate STK push delay
    await new Promise(r => setTimeout(r, 1200));
    setMpesaStep("waiting_pin");

    // Simulate user entering PIN
    await new Promise(r => setTimeout(r, 3000));

    depositMutation.mutate(
      { data: { amount: val, method: "mpesa", phone: normalizedPhone } },
      {
        onSuccess: () => {
          setMpesaStep("success");
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 20 }) });
          setTimeout(() => {
            setMpesaStep("idle");
            setAmount("");
          }, 3000);
        },
        onError: () => {
          setMpesaStep("idle");
          toast({ title: "Deposit Failed", variant: "destructive" });
        }
      }
    );
  };

  const handleDemoDeposit = () => {
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    depositMutation.mutate(
      { data: { amount: val, method: "demo" } },
      {
        onSuccess: () => {
          toast({ title: "Demo Deposit Successful", description: `KES ${val.toFixed(2)} added.` });
          setAmount("");
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 20 }) });
        },
        onError: () => toast({ title: "Deposit Failed", variant: "destructive" })
      }
    );
  };

  if (authLoading || !isAuthenticated) return null;

  const displayPhone = phone || (user?.username?.startsWith("07") ? user.username : "");

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Wallet</h1>

      {/* Balance card */}
      <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30">
        <CardContent className="p-6">
          {walletLoading ? (
            <div className="h-10 bg-secondary animate-pulse rounded w-1/2"></div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium mb-1">Available Balance</p>
                <div className="text-4xl font-black text-white">KES {wallet?.balance.toFixed(2)}</div>
                <div className="text-sm text-primary font-medium mt-1">
                  +KES {wallet?.bonusBalance.toFixed(2)} Bonus
                </div>
              </div>
              <div className="w-14 h-14 bg-primary/20 rounded-full flex items-center justify-center">
                <Banknote className="h-7 w-7 text-primary" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deposit card */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Deposit Funds</CardTitle>
          <CardDescription>Add money to start betting</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Method tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setMethod("mpesa")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all",
                method === "mpesa"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
              )}
            >
              <Smartphone className="h-4 w-4" />
              M-Pesa
            </button>
            <button
              onClick={() => setMethod("demo")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-bold transition-all",
                method === "demo"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/50"
              )}
            >
              <Banknote className="h-4 w-4" />
              Demo
            </button>
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-secondary/20 text-muted-foreground/40 text-sm font-bold cursor-not-allowed"
            >
              <CreditCard className="h-4 w-4" />
              Card
            </button>
          </div>

          {/* Quick amounts */}
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Quick Select</p>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_AMOUNTS.map(a => (
                <button
                  key={a}
                  onClick={() => setAmount(String(a))}
                  className={cn(
                    "py-2.5 rounded-lg text-sm font-bold border transition-all",
                    amount === String(a)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                  )}
                >
                  +{a.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Amount (KES)</label>
            <Input
              type="number"
              min="10"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="text-lg font-bold bg-secondary/50 text-right"
            />
            <p className="text-xs text-muted-foreground">Minimum KES 10. All transactions are subject to 5% tax.</p>
          </div>

          {/* M-Pesa specific */}
          {method === "mpesa" && (
            <>
              {mpesaStep === "idle" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">M-Pesa Phone Number</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0712 345 678"
                    className="bg-secondary/50 font-medium"
                  />
                </div>
              )}

              {mpesaStep === "sending" && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
                  <div>
                    <p className="font-bold text-sm">Sending M-Pesa request...</p>
                    <p className="text-xs text-muted-foreground">Connecting to Safaricom M-Pesa</p>
                  </div>
                </div>
              )}

              {mpesaStep === "waiting_pin" && (
                <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <Smartphone className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-yellow-300">Check your phone!</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      An M-Pesa STK push has been sent to <span className="text-foreground font-bold">{phone}</span>.
                      Enter your M-Pesa PIN to complete the payment of <span className="text-foreground font-bold">KES {amount}</span>.
                    </p>
                    <div className="flex gap-1 mt-2">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mpesaStep === "success" && (
                <div className="flex items-center gap-3 bg-primary/10 border border-primary/30 rounded-xl p-4">
                  <CheckCircle2 className="h-6 w-6 text-primary shrink-0" />
                  <div>
                    <p className="font-bold text-sm text-primary">Payment Successful!</p>
                    <p className="text-xs text-muted-foreground">KES {amount} has been added to your KialaBet wallet.</p>
                  </div>
                </div>
              )}

              {mpesaStep === "idle" && (
                <Button
                  className="w-full h-12 text-base font-bold bg-[#4CAF50] hover:bg-[#45a049] text-white"
                  onClick={handleMpesaDeposit}
                  disabled={!amount || !phone}
                >
                  <Smartphone className="h-4 w-4 mr-2" />
                  Pay KES {amount || "0"} via M-Pesa
                </Button>
              )}
            </>
          )}

          {method === "demo" && (
            <Button
              className="w-full h-12 text-base font-bold"
              onClick={handleDemoDeposit}
              disabled={depositMutation.isPending || !amount}
            >
              {depositMutation.isPending ? "Processing..." : "Add Demo Funds"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-secondary animate-pulse rounded-xl"></div>)}
            </div>
          ) : !transactions?.length ? (
            <div className="text-center py-10 text-muted-foreground">
              <Banknote className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50 border border-border">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${tx.type === "deposit" || tx.type === "win" ? "bg-primary/20 text-primary" : "bg-destructive/20 text-destructive"}`}>
                      {tx.type === "deposit" || tx.type === "win"
                        ? <ArrowDownCircle className="h-4 w-4" />
                        : <ArrowUpCircle className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm capitalize">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${tx.type === "deposit" || tx.type === "win" ? "text-primary" : ""}`}>
                      {tx.type === "deposit" || tx.type === "win" ? "+" : "-"}KES {tx.amount.toFixed(2)}
                    </p>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{tx.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
