import React, { useState } from "react";
import { useGetWallet, useListTransactions, useGetProfile, getGetWalletQueryKey, getListTransactionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Smartphone, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Loader2, ChevronDown, ChevronUp, Clock, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../hooks/use-toast";
import { customFetch } from "@workspace/api-client-react";

function StatusBadge({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-500 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-0.5">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/30 rounded-full px-2 py-0.5">
        <XCircle className="h-3 w-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-500 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-2 py-0.5">
      <Clock className="h-3 w-3" /> Pending
    </span>
  );
}

export default function Wallet() {
  const queryClient = useQueryClient();

  const { data: transactions, isLoading: txLoading } = useListTransactions(
    { limit: 20 },
    {
      query: {
        queryKey: getListTransactionsQueryKey({ limit: 20 }),
        refetchInterval: (query) => {
          const list = query.state.data as any[] | undefined;
          const hasPending = list?.some((tx) => tx.status === "pending");
          return hasPending ? 3000 : false;
        },
      },
    }
  );

  const hasPendingTx = (transactions ?? []).some((tx: any) => tx.status === "pending");

  const { data: wallet, isLoading: walletLoading } = useGetWallet({
    query: {
      queryKey: getGetWalletQueryKey(),
      refetchInterval: () => (hasPendingTx ? 3000 : false),
    },
  });

  const { data: profile, isLoading: profileLoading } = useGetProfile();

  const [amount, setAmount] = useState<string>("");
  const [mpesaStep, setMpesaStep] = useState<"idle" | "waiting_pin" | "success">("idle");
  const [showAllTx, setShowAllTx] = useState(false);

  const registeredPhone = profile?.phone ?? "";

  const maskedPhone = registeredPhone.length > 9
    ? `${registeredPhone.slice(0, 6)}${"•".repeat(registeredPhone.length - 9)}${registeredPhone.slice(-3)}`
    : registeredPhone;

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val < 10) {
      toast({ title: "Minimum deposit is KES 10", variant: "destructive" });
      return;
    }

    if (!registeredPhone) {
      toast({ title: "No registered phone number found on your account", variant: "destructive" });
      return;
    }

    setMpesaStep("waiting_pin");
    await new Promise(r => setTimeout(r, 3000));
    customFetch("/api/wallet/deposit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: val,
        method: "mpesa",
        phone: registeredPhone
      })
    })
    .then(() => {
      setMpesaStep("success");
      queryClient.invalidateQueries({ queryKey: ["getWallet"] });
      queryClient.invalidateQueries({ queryKey: ["listTransactions"] });
      setTimeout(() => {
        setMpesaStep("idle");
        setAmount("");
      }, 3000);
    })
    .catch((err: unknown) => {
      console.error(err);
      toast({ title: "Deposit initialization failed", variant: "destructive" });
      setMpesaStep("idle");
    });
  };

  if (walletLoading || txLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const walletTxTypes = ["deposit", "withdrawal", "refund"];
  const sortedTx = transactions
    ? [...transactions]
        .filter((t: any) => walletTxTypes.includes(t.type))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    : [];
  const visibleTx = showAllTx ? sortedTx : sortedTx.slice(0, 1);

  return (
    <div className="p-4 max-w-xl mx-auto space-y-6">
      <div className="bg-card p-6 rounded-xl border flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm text-zinc-400">Available Balance</p>
          <p className="text-3xl font-black">KES {(wallet?.balance ?? 0).toFixed(2)}</p>
        </div>
        <WalletIcon className="h-10 w-10 text-primary opacity-40" />
      </div>

      <div className="bg-card p-6 rounded-xl border space-y-4">
        <p className="font-bold text-lg flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-primary"/> Deposit Funds</p>

        {mpesaStep === "idle" && (
          <form onSubmit={handleMpesaDeposit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400">AMOUNT (KES)</label>
              <Input type="number" placeholder="Enter amount" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-zinc-400">MPESA PHONE NUMBER</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900 border text-sm text-zinc-300">
                <Smartphone className="h-4 w-4 text-zinc-500" />
                {maskedPhone || "No phone on file"}
              </div>
            </div>
            <Button type="submit" className="w-full font-bold" disabled={!registeredPhone}>Deposit via M-Pesa</Button>
          </form>
        )}

        {mpesaStep === "waiting_pin" && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3 items-start animate-pulse">
            <Smartphone className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-yellow-500">Check your phone!</p>
              <p className="text-xs text-zinc-400 mt-0.5">An M-Pesa STK push has been sent to {registeredPhone}. Enter your PIN to approve the payment of KES {amount}.</p>
            </div>
          </div>
        )}

        {mpesaStep === "success" && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex gap-3 items-start">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-green-500">Deposit Initiated</p>
              <p className="text-xs text-zinc-400 mt-0.5">success. Please check your phone to complete the deposit!</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card p-6 rounded-xl border space-y-4">
        <div className="flex items-center justify-between">
          <p className="font-bold text-lg flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-zinc-400"/> Transaction History</p>
          {sortedTx.length > 1 && (
            <button
              type="button"
              onClick={() => setShowAllTx(v => !v)}
              className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
            >
              {showAllTx ? "Show latest only" : "View all"}
              {showAllTx ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>
        <div className="space-y-2">
          {visibleTx.length > 0 ? visibleTx.map((tx: any) => (
            <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border text-sm">
              <div className="space-y-1">
                <p className="font-medium capitalize">{tx.type} via M-Pesa</p>
                <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                <StatusBadge status={tx.status} />
              </div>
              <p className={`font-bold ${tx.status === "completed" ? "text-green-500" : tx.status === "failed" ? "text-red-500" : "text-yellow-500"}`}>
                {tx.type === "withdrawal" ? "-" : "+"}KES {Math.abs(parseFloat(tx.amount)).toFixed(2)}
              </p>
            </div>
          )) : <p className="text-xs text-zinc-500 text-center py-4">No recent transactions found.</p>}
        </div>
      </div>
    </div>
  );
}
