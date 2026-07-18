import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGetWallet } from "@workspace/api-client-react";
import { History, Wallet as WalletIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "../hooks/use-toast";

export default function Aviator() {
  const { isAuthenticated } = useAuth();
  const { data: wallet, refetch: refetchWallet } = useGetWallet();

  const [betAmount, setBetAmount] = useState<string>("100");
  const [isPlayerInGame, setIsPlayerInGame] = useState<boolean>(false);
  const [hasCashedOut, setHasCashedOut] = useState<boolean>(false);
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [gameState, setGameState] = useState<"idle" | "loading" | "flying" | "crashed">("idle");
  const [gameHistory, setGameHistory] = useState<number[]>([1.45, 2.10, 1.12, 5.40, 1.85]);

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const crashPointRef = useRef<number>(1.0);

  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, []);

  const startGame = () => {
    if (isPlayerInGame) return;
    const val = parseFloat(betAmount);
    if (isNaN(val) || val < 10) {
      toast({ title: "Minimum bet is KES 10", variant: "destructive" });
      return;
    }
    if (!wallet || (wallet.balance ?? 0) < val) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setIsPlayerInGame(true);
    setHasCashedOut(false);
    setMultiplier(1.0);
    setGameState("loading");

    setTimeout(() => {
      setGameState("flying");
      crashPointRef.current = Math.random() < 0.1 ? 1.0 : parseFloat((1.0 + Math.pow(Math.random(), 3) * 15).toFixed(2));
      
      gameLoopRef.current = setInterval(() => {
        setMultiplier(prev => {
          const next = parseFloat((prev + 0.01 * (1 + prev * 0.1)).toFixed(2));
          if (next >= crashPointRef.current) {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
            setGameState("crashed");
            setIsPlayerInGame(false);
            setGameHistory(h => [crashPointRef.current, ...h.slice(0, 4)]);
            return crashPointRef.current;
          }
          return next;
        });
      }, 100);
    }, 2000);
  };

  const cashOut = () => {
    if (!isPlayerInGame || hasCashedOut || gameState !== "flying") return;
    setHasCashedOut(true);
    setIsPlayerInGame(false);
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    setGameState("idle");
    toast({ title: "Win!", description: `Cashed out at ${multiplier}x` });
    refetchWallet();
  };

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="bg-card p-6 rounded-xl border flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden bg-zinc-950">
        {gameState === "idle" && <p className="text-zinc-400">Ready to fly. Place your bet!</p>}
        {gameState === "loading" && <p className="text-yellow-400 font-bold animate-pulse">PLACING BETS...</p>}
        {gameState === "flying" && (
          <div className="text-center space-y-2">
            <p className="text-6xl font-black text-red-500 animate-bounce">{multiplier.toFixed(2)}x</p>
            <p className="text-zinc-400 text-sm">Lucky Plane is Flying</p>
          </div>
        )}
        {gameState === "crashed" && (
          <div className="text-center space-y-2">
            <p className="text-4xl font-bold text-zinc-600">FLEW AWAY</p>
            <p className="text-red-500 font-black text-2xl">{multiplier.toFixed(2)}x</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card p-4 rounded-xl border space-y-4">
          <div className="flex gap-2">
            <Input type="number" value={betAmount} onChange={e => setBetAmount(e.target.value)} disabled={isPlayerInGame} />
            {isPlayerInGame && !hasCashedOut && gameState === "flying" ? (
              <Button onClick={cashOut} className="w-full bg-orange-500 hover:bg-orange-600 font-bold">CASH OUT (KES {(parseFloat(betAmount) * multiplier).toFixed(2)})</Button>
            ) : (
              <Button onClick={startGame} disabled={isPlayerInGame} className="w-full bg-red-600 hover:bg-red-700 font-bold">BET</Button>
            )}
          </div>
          {wallet && <p className="text-sm text-zinc-400">Balance: KES {(wallet.balance ?? 0).toFixed(2)}</p>}
        </div>
        <div className="bg-card p-4 rounded-xl border">
          <p className="font-bold mb-2 flex items-center gap-2"><History className="h-4 w-4"/> History</p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {gameHistory.map((h, i) => (
              <span key={i} className={`px-2 py-1 rounded text-xs font-bold ${h > 2 ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"}`}>{h.toFixed(2)}x</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
