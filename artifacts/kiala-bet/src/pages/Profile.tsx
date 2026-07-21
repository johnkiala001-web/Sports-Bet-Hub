import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLoginUser, useGetWallet, getGetWalletQueryKey, getListTransactionsQueryKey, customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { User, Wallet, Gift, Trophy, LogOut, ChevronRight, Smartphone, Minus, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Login form (shown when NOT authenticated) ────────────────────────────────
const loginSchema = z.object({
  phone: z.string().min(9, "Enter a valid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  remember: z.boolean().optional(),
});

function LoginView() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const loginMutation = useLoginUser();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", password: "", remember: true },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate(
      { data: { phone: values.phone, password: values.password } },
      {
        onSuccess: (res) => {
          login(res.token);
          toast({ title: "Welcome back!" });
        },
        onError: () => {
          toast({ title: "Login failed", description: "Invalid phone number or password", variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col animate-in fade-in duration-300 pb-4">
      {/* Logo */}
      <div className="pt-6 pb-8 px-2">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-primary">Kiala</span>
          <span className="text-white">Bet</span>
          <span className="text-primary">!</span>
        </h1>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Enter your phone number and password below to Login to your existing account. Otherwise click on Register with the same details to create a new account.
      </p>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 flex-1">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-bold">Phone Number</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="e.g. 0712 234567"
                    className="h-12 bg-secondary/60 border-border text-base"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Enter your phone number</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="font-bold">Password</FormLabel>
                  <Link href="/forgot-password" className="text-sm text-primary font-medium">
                    Forgot Your Password?
                  </Link>
                </div>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    className="h-12 bg-secondary/60 border-border text-base"
                    {...field}
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">Enter your password</p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="remember"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => field.onChange(!field.value)}>
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center border-2 transition-colors",
                    field.value ? "bg-primary border-primary" : "border-muted-foreground bg-transparent"
                  )}>
                    {field.value && <span className="text-white text-xs font-black">✓</span>}
                  </div>
                  <span className="text-sm font-medium">Keep me logged in</span>
                </div>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90"
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Login"}
          </Button>
        </form>
      </Form>

      <div className="mt-6 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-foreground font-bold hover:underline">
            Register here
          </Link>
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span>You are using KialaBet</span>
          <span className="text-base">🇰🇪</span>
          <span className="bg-secondary/80 rounded-full px-3 py-0.5 text-xs font-medium">Kenya</span>
        </div>
      </div>
    </div>
  );
}

// ─── Quick deposit amount stepper ─────────────────────────────────────────────
const QUICK_AMOUNTS = [100, 200, 500, 1000];

function DepositSection() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<number>(0);
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"idle" | "sending" | "pin" | "done">("idle");

  const adjust = (delta: number) => setAmount(prev => Math.max(0, prev + delta));

  const handleMpesa = async () => {
    if (amount < 10) { toast({ title: "Minimum deposit is KES 10", variant: "destructive" }); return; }
    if (!user?.phone) { toast({ title: "No registered phone number found on your account", variant: "destructive" }); return; }
    setStep("sending");
    await new Promise(r => setTimeout(r, 1100));
    setStep("pin");
    await new Promise(r => setTimeout(r, 3000));
    customFetch("/api/wallet/deposit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, method: "mpesa", phone: user.phone }),
    })
      .then(() => {
        setStep("done");
        queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListTransactionsQueryKey({ limit: 20 }) });
        setTimeout(() => { setStep("idle"); setAmount(0); }, 3000);
      })
      .catch(() => { setStep("idle"); toast({ title: "Deposit failed", variant: "destructive" }); });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div>
        <h3 className="font-bold text-base mb-0.5">Deposit</h3>
        <p className="text-xs text-muted-foreground">Send money into your KialaBet account</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center bg-secondary/50 border border-border rounded-lg overflow-hidden">
        <button onClick={() => adjust(-50)} className="px-4 py-3 text-lg font-bold text-muted-foreground hover:text-foreground active:bg-secondary transition-colors">
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          value={amount || ""}
          onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
          placeholder="Enter amount to deposit"
          className="flex-1 bg-transparent text-center text-sm font-medium outline-none py-3 placeholder:text-muted-foreground/60"
        />
        <button onClick={() => adjust(50)} className="px-4 py-3 text-lg font-bold text-muted-foreground hover:text-foreground active:bg-secondary transition-colors">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground -mt-2">Minimum KES 10. All transactions are subject to 5% tax.</p>

      {/* Quick amounts */}
      <div className="flex gap-2 flex-wrap">
        {QUICK_AMOUNTS.map(a => (
          <button
            key={a}
            onClick={() => setAmount(a)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold border transition-all",
              amount === a
                ? "bg-primary/20 border-primary text-primary"
                : "bg-secondary/60 border-border text-foreground hover:border-primary/50"
            )}
          >
            +{a.toLocaleString()}
          </button>
        ))}
      </div>

      {/* Status messages */}
      {step === "sending" && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2.5">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Sending M-Pesa request to Safaricom...
        </div>
      )}
      {step === "pin" && (
        <div className="flex items-start gap-2 text-sm bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
          <Smartphone className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-yellow-300 text-xs">Check your phone!</p>
            <p className="text-muted-foreground text-xs mt-0.5">Enter your M-Pesa PIN to complete payment of <strong className="text-foreground">KES {amount}</strong></p>
            <div className="flex gap-1 mt-1.5">
              {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
            </div>
          </div>
        </div>
      )}
      {step === "done" && (
        <div className="flex items-center gap-2 text-sm text-primary bg-primary/10 rounded-lg px-3 py-2.5">
          <span className="text-base">✓</span>
          Deposit Initiated success. Please check your phone to complete the deposit!
        </div>
      )}

      {/* Deposit button */}
      {step === "idle" && (
        <button
          onClick={handleMpesa}
          className="w-full flex items-center justify-center gap-2 bg-[#4CAF50] hover:bg-[#45a049] text-white font-bold py-3 rounded-lg transition-colors"
        >
          <Smartphone className="h-4 w-4" />
          Deposit with M-Pesa
        </button>
      )}
    </div>
  );
}

// ─── Withdrawals section ──────────────────────────────────────────────────────
function WithdrawSection() {
  const [amount, setAmount] = useState<number>(0);
  const adjust = (delta: number) => setAmount(prev => Math.max(0, prev + delta));

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
      <div>
        <h3 className="font-bold text-base mb-0.5">Withdrawals</h3>
        <p className="text-xs text-muted-foreground">Withdraw money from your KialaBet wallet</p>
      </div>
      <div className="flex items-center bg-secondary/50 border border-border rounded-lg overflow-hidden">
        <button onClick={() => adjust(-50)} className="px-4 py-3 text-muted-foreground hover:text-foreground">
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          value={amount || ""}
          onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
          placeholder="Enter amount to withdraw"
          className="flex-1 bg-transparent text-center text-sm font-medium outline-none py-3 placeholder:text-muted-foreground/60"
        />
        <button onClick={() => adjust(50)} className="px-4 py-3 text-muted-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button className="w-full flex items-center justify-center gap-2 bg-secondary/60 hover:bg-secondary border border-border text-foreground font-bold py-3 rounded-lg transition-colors text-sm">
        Withdraw to M-Pesa
      </button>
    </div>
  );
}

// ─── Logged-in profile view ───────────────────────────────────────────────────
function ProfileView() {
  const { user, logout } = useAuth();
  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: { queryKey: getGetWalletQueryKey() }
  });

  const displayName = user?.username || "User";

  return (
    <div className="space-y-4 animate-in fade-in duration-300 pb-4">
      {/* Avatar + phone */}
      <div className="flex flex-col items-center pt-4 pb-2 gap-2">
        <div className="w-16 h-16 rounded-full bg-primary/80 flex items-center justify-center shadow-lg">
          <User className="h-8 w-8 text-white" />
        </div>
        <p className="text-base font-bold">{displayName}</p>
      </div>

      {/* Balance + Bonus */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Balance</span>
            </div>
            {walletLoading ? (
              <div className="h-6 w-24 bg-secondary animate-pulse rounded" />
            ) : (
              <p className="text-lg font-black">KES {wallet?.balance.toFixed(2) ?? "0.00"}</p>
            )}
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Bonus</span>
            </div>
            {walletLoading ? (
              <div className="h-6 w-20 bg-secondary animate-pulse rounded" />
            ) : (
              <p className="text-lg font-black">KES {wallet?.bonusBalance.toFixed(2) ?? "0.00"}</p>
            )}
          </div>
        </div>
      </div>

      {/* Freebets & Jackpot */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="p-4">
            <p className="font-bold text-sm mb-2">Freebets &amp; Promotions</p>
            <Link href="/jackpot">
              <button className="text-xs border border-border rounded-lg px-3 py-1.5 font-medium hover:border-primary/50 transition-colors">
                View all
              </button>
            </Link>
          </div>
          <div className="p-4">
            <p className="font-bold text-sm mb-2">Jackpot Streaks</p>
            <Link href="/jackpot">
              <button className="text-xs border border-border rounded-lg px-3 py-1.5 font-medium hover:border-primary/50 transition-colors">
                View all
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Deposit */}
      <DepositSection />

      {/* Withdrawals */}
      <WithdrawSection />

      {/* Menu items */}
      <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
        <Link href="/bets">
          <div className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">My Bets</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
        <Link href="/wallet">
          <div className="flex items-center justify-between px-4 py-3.5 hover:bg-secondary/30 transition-colors cursor-pointer">
            <div className="flex items-center gap-3">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Transaction History</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Link>
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-border bg-card hover:bg-destructive/10 hover:border-destructive/40 hover:text-destructive transition-colors text-sm font-bold text-muted-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log Out
      </button>
    </div>
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────
export default function Profile() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  return isAuthenticated ? <ProfileView /> : <LoginView />;
}
