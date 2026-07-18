import React, { useState } from "react";
import { useGetWallet, useListTransactions } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Smartphone, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../hooks/use-toast";

export default function Wallet() {
  const queryClient = useQueryClient();
  const { data: wallet, isLoading: walletLoading } = useGetWallet();
  const { data: transactions, isLoading: txLoading } = useListTransactions({ limit: 20 });

  const [amount, setAmount] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [mpesaStep, setMpesaStep] = useState<"idle" | "waiting_pin" | "success">("idle");

  const handleMpesaDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val < 10) {
      toast({ title: "Minimum deposit is KES 10", variant: "destructive" });
      return;
    }

    const normalizedPhone = phone.replace(/\s/g, "");
    if (!normalizedPhone) {
      toast({ title: "Phone number is required", variant: "destructive" });
      return;
    }

    setMpesaStep("waiting_pin");
    await new Promise(r => setTimeout(r, 3000));

    fetch("https://sports-bet-hub.onrender.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token") || ""}`
      },
      body: JSON.stringify({
        amount: val,
        method: "mpesa",
        phone: normalizedPhone
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Deposit failed");
      return res.json();
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
    .catch(err => {
      console.error(err);
      toast({ title: "Deposit initialization failed", variant: "destructive" });
      setMpesaStep("idle");
    });
  };

  if (walletLoading || txLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
              <Input type="tel" placeholder="e.g. 0748119367" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <Button type="submit" className="w-full font-bold">Deposit via M-Pesa</Button>
          </form>
        )}

        {mpesaStep === "waiting_pin" && (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex gap-3 items-start animate-pulse">
            <Smartphone className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-yellow-500">Check your phone!</p>
              <p className="text-xs text-zinc-400 mt-0.5">An M-Pesa STK push has been sent to {phone}. Enter your PIN to approve the payment of KES {amount}.</p>
            </div>
          </div>
        )}

        {mpesaStep === "success" && (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex gap-3 items-start">
            <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-green-500">Request Sent Successfully</p>
              <p className="text-xs text-zinc-400 mt-0.5">Your balance will automatically refresh once M-Pesa confirms the confirmation log webhook.</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card p-6 rounded-xl border space-y-4">
        <p className="font-bold text-lg flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-zinc-400"/> Transaction History</p>
        <div className="space-y-2">
          {transactions?.map((tx: any) => (
            <div key={tx.id} className="flex justify-between items-center p-3 rounded-lg bg-zinc-900 border text-sm">
              <div>
                <p className="font-medium capitalize">{tx.type} via M-Pesa</p>
                <p className="text-xs text-zinc-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
              </div>
              <p className={`font-bold ${tx.type === "deposit" ? "text-green-500" : "text-zinc-400"}`}>
                {tx.type === "deposit" ? "+" : "-"}KES {parseFloat(tx.amount).toFixed(2)}
              </p>
            </div>
          )) ?? <p className="text-xs text-zinc-500 text-center py-4">No recent transactions found.</p>}
        </div>
      </div>
    </div>
  );
}
