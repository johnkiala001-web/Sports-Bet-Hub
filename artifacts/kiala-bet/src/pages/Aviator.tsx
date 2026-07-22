import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useGetWallet } from "@workspace/api-client-react";
import { Rocket } from "lucide-react";
import { toast } from "../hooks/use-toast";
import { cn } from "@/lib/utils";

type GameState = "waiting" | "flying" | "crashed";

interface BetSlot {
  amount: string;
  mode: "bet" | "auto";
  isActive: boolean;
  hasCashedOut: boolean;
  joinedThisRound: boolean;
}

interface LiveBetRow {
  id: string;
  player: string;
  bet: number;
  multiplier: number | null;
  win: number | null;
}

const QUICK_AMOUNTS = [100, 250, 1000, 25000];
const ROUND_GAP_MS = 4000;
const CRASH_PAUSE_MS = 2200;

function randomPlayerTag(): string {
  const n = Math.floor(2000 + Math.random() * 8000);
  const digit = Math.floor(Math.random() * 10);
  return `${n.toString().slice(0, 1)}***${digit}`;
}

function generateCrashPoint(): number {
  if (Math.random() < 0.08) return 1.0;
  return parseFloat((1.0 + Math.pow(Math.random(), 3) * 20).toFixed(2));
}

function BetPanel({
  slot,
  onChange,
  onBet,
  onCashOut,
  multiplier,
  gameState,
  disabled,
}: {
  slot: BetSlot;
  onChange: (patch: Partial<BetSlot>) => void;
  onBet: () => void;
  onCashOut: () => void;
  multiplier: number;
  gameState: GameState;
  disabled: boolean;
}) {
  const adjust = (delta: number) => {
    const current = parseFloat(slot.amount) || 0;
    onChange({ amount: Math.max(10, current + delta).toString() });
  };

  const showCashOut = slot.isActive && !slot.hasCashedOut && gameState === "flying";
  const potentialWin = (parseFloat(slot.amount) || 0) * multiplier;
  const canBet = !slot.isActive && gameState !== "flying";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ mode: "bet" })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
            slot.mode === "bet" ? "bg-secondary text-foreground" : "text-muted-foreground"
          )}
        >
          Bet
        </button>
        <button
          onClick={() => onChange({ mode: "auto" })}
          className={cn(
            "flex-1 py-2 rounded-lg text-sm font-bold transition-colors",
            slot.mode === "auto" ? "bg-secondary text-foreground" : "text-muted-foreground"
          )}
        >
          Auto
        </button>
      </div>

      <div className="flex items-center bg-secondary/50 border border-border rounded-lg overflow-hidden">
        <button
          onClick={() => adjust(-10)}
          disabled={slot.isActive}
          className="px-4 py-3 text-lg font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          value={slot.amount}
          onChange={e => onChange({ amount: e.target.value })}
          disabled={slot.isActive}
          className="flex-1 bg-transparent text-center text-base font-bold outline-none py-3 disabled:opacity-60"
        />
        <button
          onClick={() => adjust(10)}
          disabled={slot.isActive}
          className="px-4 py-3 text-lg font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          +
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {QUICK_AMOUNTS.map(a => (
          <button
            key={a}
            onClick={() => onChange({ amount: a.toString() })}
            disabled={slot.isActive}
            className="py-1.5 rounded-lg text-xs font-bold bg-secondary/60 border border-border hover:border-primary/50 disabled:opacity-40 transition-colors"
          >
            {a.toLocaleString()}
          </button>
        ))}
      </div>

      {showCashOut ? (
        <button
          onClick={onCashOut}
          className="w-full py-3 rounded-lg font-black text-white bg-orange-500 hover:bg-orange-600 transition-colors"
        >
          CASH OUT KES {potentialWin.toFixed(2)}
        </button>
      ) : (
        <button
          onClick={onBet}
          disabled={disabled || !canBet}
          className="w-full py-3 rounded-lg font-black text-white bg-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {slot.isActive ? "Waiting for next round..." : `Bet ${slot.amount || 0} KES`}
        </button>
      )}
    </div>
  );
}

export default function Aviator() {
  const { isAuthenticated } = useAuth();
  const { data: wallet, refetch: refetchWallet } = useGetWallet();

  const [gameState, setGameState] = useState<GameState>("waiting");
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [curvePoints, setCurvePoints] = useState<{ x: number; y: number }[]>([]);
  const [history, setHistory] = useState<number[]>([1.30, 4.57, 7.37, 1.00, 1.18, 1.17, 2.52, 1.05]);
  const [liveBets, setLiveBets] = useState<LiveBetRow[]>([]);
  const [countdown, setCountdown] = useState<number>(4);

  const [slot1, setSlot1] = useState<BetSlot>({ amount: "10", mode: "bet", isActive: false, hasCashedOut: false, joinedThisRound: false });
  const [slot2, setSlot2] = useState<BetSlot>({ amount: "10", mode: "bet", isActive: false, hasCashedOut: false, joinedThisRound: false });

  const gameLoopRef = useRef<NodeJS.Timeout | null>(null);
  const roundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const crashPointRef = useRef<number>(1.0);
  const startTimeRef = useRef<number>(0);

  // Continuous round loop — runs forever regardless of whether anyone bets
  useEffect(() => {
    let cancelled = false;

    const runRound = () => {
      if (cancelled) return;
      setGameState("waiting");
      setMultiplier(1.0);
      setCurvePoints([{ x: 0, y: 0 }]);

      let remaining = ROUND_GAP_MS / 1000;
      setCountdown(Math.ceil(remaining));
      const countdownInterval = setInterval(() => {
        remaining -= 1;
        setCountdown(Math.max(0, Math.ceil(remaining)));
      }, 1000);

      roundTimerRef.current = setTimeout(() => {
        clearInterval(countdownInterval);
        if (cancelled) return;

        setGameState("flying");
        setSlot1(s => ({ ...s, joinedThisRound: s.isActive }));
        setSlot2(s => ({ ...s, joinedThisRound: s.isActive }));
        crashPointRef.current = generateCrashPoint();
        startTimeRef.current = Date.now();

        gameLoopRef.current = setInterval(() => {
          const elapsed = (Date.now() - startTimeRef.current) / 1000;
          const next = parseFloat((1 + Math.pow(elapsed, 1.55) * 0.18).toFixed(2));

          if (next >= crashPointRef.current) {
            if (gameLoopRef.current) clearInterval(gameLoopRef.current);
            setMultiplier(crashPointRef.current);
            setGameState("crashed");
            setHistory(h => [crashPointRef.current, ...h.slice(0, 11)]);
            setSlot1(s => ({ ...s, isActive: false, hasCashedOut: false, joinedThisRound: false }));
            setSlot2(s => ({ ...s, isActive: false, hasCashedOut: false, joinedThisRound: false }));

            roundTimerRef.current = setTimeout(() => {
              if (!cancelled) runRound();
            }, CRASH_PAUSE_MS);
            return;
          }

          setMultiplier(next);
          setCurvePoints(pts => [...pts.slice(-80), { x: elapsed, y: next }]);
        }, 60);
      }, ROUND_GAP_MS);
    };

    runRound();

    return () => {
      cancelled = true;
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (roundTimerRef.current) clearTimeout(roundTimerRef.current);
    };
  }, []);

  // Simulated live bets feed, purely cosmetic
  useEffect(() => {
    const seed: LiveBetRow[] = Array.from({ length: 8 }, () => ({
      id: Math.random().toString(36).slice(2),
      player: randomPlayerTag(),
      bet: [25000, 10000, 2000, 1500, 1500, 750, 500, 200][Math.floor(Math.random() * 8)],
      multiplier: parseFloat((1 + Math.random() * 40).toFixed(2)),
      win: null,
    })).map(r => ({ ...r, win: parseFloat((r.bet * (r.multiplier ?? 1)).toFixed(2)) }));
    setLiveBets(seed);

    const interval = setInterval(() => {
      setLiveBets(prev => {
        const row: LiveBetRow = {
          id: Math.random().toString(36).slice(2),
          player: randomPlayerTag(),
          bet: QUICK_AMOUNTS[Math.floor(Math.random() * QUICK_AMOUNTS.length)],
          multiplier: parseFloat((1 + Math.random() * 40).toFixed(2)),
          win: null,
        };
        row.win = parseFloat((row.bet * (row.multiplier ?? 1)).toFixed(2));
        return [row, ...prev.slice(0, 19)];
      });
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  const placeBet = (slot: BetSlot, setSlot: React.Dispatch<React.SetStateAction<BetSlot>>) => {
    if (gameState === "flying") {
      toast({ title: "Round in progress", description: "Wait for the next round to bet", variant: "destructive" });
      return;
    }
    const val = parseFloat(slot.amount);
    if (isNaN(val) || val < 10) {
      toast({ title: "Minimum bet is KES 10", variant: "destructive" });
      return;
    }
    if (!wallet || (wallet.balance ?? 0) < val) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }
    setSlot(s => ({ ...s, isActive: true, hasCashedOut: false }));
  };

  const cashOut = (slot: BetSlot, setSlot: React.Dispatch<React.SetStateAction<BetSlot>>) => {
    if (!slot.isActive || slot.hasCashedOut || gameState !== "flying" || !slot.joinedThisRound) return;
    setSlot(s => ({ ...s, hasCashedOut: true, isActive: false }));
    const win = (parseFloat(slot.amount) || 0) * multiplier;
    toast({ title: "Cashed out!", description: `KES ${win.toFixed(2)} at ${multiplier.toFixed(2)}x` });
    refetchWallet();
  };

  const maxY = Math.max(2, multiplier * 1.15);
  const pathD = curvePoints.length > 1
    ? "M " + curvePoints.map(p => {
        const x = (p.x / Math.max(1, curvePoints[curvePoints.length - 1].x)) * 100;
        const y = 100 - (p.y / maxY) * 100;
        return `${x},${y}`;
      }).join(" L ")
    : "";

  const planeYPercent = Math.max(6, 92 - (multiplier / maxY) * 82);

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      {/* Title + balance */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black tracking-tight">
          <span className="text-primary">Kiala</span>Aviator
        </h1>
        {wallet && (
          <span className="text-sm font-bold bg-secondary/60 border border-border rounded-full px-3 py-1.5">
            KES {(wallet.balance ?? 0).toFixed(2)}
          </span>
        )}
      </div>

      {/* Multiplier history strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {history.map((h, i) => (
          <span
            key={i}
            className={cn(
              "shrink-0 px-2.5 py-1 rounded-full text-xs font-bold",
              h >= 10 ? "bg-fuchsia-500/20 text-fuchsia-400" :
              h >= 2 ? "bg-violet-500/20 text-violet-400" :
              "bg-sky-500/20 text-sky-400"
            )}
          >
            {h.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Main game panel */}
      <div className="relative bg-zinc-950 border border-border rounded-xl min-h-[280px] overflow-hidden flex items-center justify-center">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          {pathD && (
            <path
              d={`${pathD} L 100,100 L 0,100 Z`}
              fill="url(#fadeGrad)"
              opacity={gameState === "flying" || gameState === "crashed" ? 1 : 0}
            />
          )}
          {pathD && (
            <path
              d={pathD}
              fill="none"
              stroke={gameState === "crashed" ? "#71717a" : "#ef4444"}
              strokeWidth="1.2"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <defs>
            <linearGradient id="fadeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        {gameState === "flying" && (
          <Rocket
            className="absolute h-6 w-6 text-red-500 -rotate-45 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)] transition-[top,right] duration-75 ease-linear"
            style={{ right: "6%", top: `${planeYPercent}%` }}
          />
        )}

        <div className="relative text-center space-y-1 z-10">
          {gameState === "waiting" && (
            <div className="space-y-1">
              <p className="text-zinc-400 font-medium">Next round starting in</p>
              <p className="text-3xl font-black text-white">{countdown}s</p>
            </div>
          )}
          {(gameState === "flying" || gameState === "crashed") && (
            <p className={cn("text-6xl font-black", gameState === "crashed" ? "text-zinc-500" : "text-white")}>
              {multiplier.toFixed(2)}x
            </p>
          )}
          {gameState === "crashed" && <p className="text-red-500 font-bold text-sm">FLEW AWAY</p>}
        </div>
      </div>

      {/* Dual bet panels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BetPanel
          slot={slot1}
          onChange={patch => setSlot1(s => ({ ...s, ...patch }))}
          onBet={() => placeBet(slot1, setSlot1)}
          onCashOut={() => cashOut(slot1, setSlot1)}
          multiplier={multiplier}
          gameState={gameState}
          disabled={!isAuthenticated}
        />
        <BetPanel
          slot={slot2}
          onChange={patch => setSlot2(s => ({ ...s, ...patch }))}
          onBet={() => placeBet(slot2, setSlot2)}
          onCashOut={() => cashOut(slot2, setSlot2)}
          multiplier={multiplier}
          gameState={gameState}
          disabled={!isAuthenticated}
        />
      </div>

      {/* Live bets table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex border-b border-border">
          <div className="flex-1 text-center py-3 text-sm font-bold border-b-2 border-primary text-foreground">All Bets</div>
          <div className="flex-1 text-center py-3 text-sm font-medium text-muted-foreground">Previous</div>
          <div className="flex-1 text-center py-3 text-sm font-medium text-muted-foreground">Top</div>
        </div>
        <div className="grid grid-cols-4 px-4 py-2 text-xs text-muted-foreground font-medium">
          <span>Player</span>
          <span className="text-right">Bet KES</span>
          <span className="text-right">X</span>
          <span className="text-right">Win KES</span>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
          {liveBets.map(row => (
            <div key={row.id} className="grid grid-cols-4 px-4 py-2 text-sm">
              <span className="text-muted-foreground">{row.player}</span>
              <span className="text-right font-medium">{row.bet.toLocaleString()}</span>
              <span className={cn("text-right font-bold", (row.multiplier ?? 0) >= 10 ? "text-fuchsia-400" : (row.multiplier ?? 0) >= 2 ? "text-violet-400" : "text-sky-400")}>
                {row.multiplier?.toFixed(2)}x
              </span>
              <span className="text-right font-bold text-primary">{row.win?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
