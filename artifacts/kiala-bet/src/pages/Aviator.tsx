import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { ChevronLeft, MessageCircle, AlignJustify } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useGetWallet } from "@workspace/api-client-react";

type GameState = "waiting" | "flying" | "crashed";
type BetTab = "Bet" | "Auto";
type HistoryTab = "All Bets" | "Previous" | "Top";

function generateCrashPoint(): number {
  const r = Math.random();
  if (r < 0.01) return 1.00; // 1% instant crash
  const raw = 0.99 / r;
  return Math.min(Math.round(raw * 100) / 100, 100);
}

function multiplierColor(x: number): string {
  if (x < 2) return "text-sky-400";
  if (x < 5) return "text-violet-400";
  return "text-yellow-400";
}

const FAKE_PLAYERS = [
  "2***4","2***2","2***0","2***6","2***8","2***7","2***9","2***1","2***3","2***5",
  "1***8","3***2","4***6","5***1","6***9","7***3","8***7","9***0","0***4","1***2",
];

function randomBet() {
  const bets = [100, 250, 500, 1000, 1500, 2000, 2500, 3000, 5000];
  return bets[Math.floor(Math.random() * bets.length)];
}

interface BetRow {
  id: number;
  player: string;
  bet: number;
  multiplier: number | null;
  win: number | null;
}

let rowId = 0;
function makeRow(): BetRow {
  const bet = randomBet();
  const player = FAKE_PLAYERS[Math.floor(Math.random() * FAKE_PLAYERS.length)];
  return { id: rowId++, player, bet, multiplier: null, win: null };
}

function genInitialRows(): BetRow[] {
  return Array.from({ length: 18 }, () => {
    const row = makeRow();
    const m = Math.round((1 + Math.random() * 5) * 100) / 100;
    row.multiplier = m;
    row.win = Math.round(row.bet * m * 100) / 100;
    return row;
  });
}

export default function Aviator() {
  const { isAuthenticated } = useAuth();
  const { data: wallet } = useGetWallet({ query: { enabled: isAuthenticated } });

  const [gameState, setGameState] = useState<GameState>("waiting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashAt, setCrashAt] = useState(0);
  const [history, setHistory] = useState<number[]>([1.33, 2.54, 2.19, 1.61, 2.25, 3.80, 2.44, 17.5, 1.08, 4.32]);
  const [betAmount, setBetAmount] = useState("10.00");
  const [betTab, setBetTab] = useState<BetTab>("Bet");
  const [histTab, setHistTab] = useState<HistoryTab>("All Bets");
  const [betRows, setBetRows] = useState<BetRow[]>(genInitialRows);
  const [myBetActive, setMyBetActive] = useState(false);
  const [myBetAmount, setMyBetAmount] = useState(0);
  const [cashedOut, setCashedOut] = useState<number | null>(null);
  const [pendingBet, setPendingBet] = useState(false);

  const multiplierRef = useRef(multiplier);
  multiplierRef.current = multiplier;

  const startRound = useCallback(() => {
    const crash = generateCrashPoint();
    setCrashAt(crash);
    setMultiplier(1.0);
    setGameState("flying");

    // New bets for this round
    const newRows: BetRow[] = Array.from({ length: Math.floor(5 + Math.random() * 8) }, makeRow);
    setBetRows(prev => [...newRows, ...prev].slice(0, 50));
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState === "waiting") {
      const t = setTimeout(startRound, 4000);
      return () => clearTimeout(t);
    }

    if (gameState === "flying") {
      // If there was a pending bet, activate it
      if (pendingBet) {
        const amt = parseFloat(betAmount) || 10;
        setMyBetActive(true);
        setMyBetAmount(amt);
        setCashedOut(null);
        setPendingBet(false);
      }

      const interval = setInterval(() => {
        setMultiplier(prev => {
          const speed = prev < 2 ? 0.02 : prev < 5 ? 0.05 : 0.1;
          const next = Math.round((prev + speed) * 100) / 100;
          if (next >= crashAt) {
            clearInterval(interval);
            setGameState("crashed");
            setHistory(h => [crashAt, ...h].slice(0, 20));
            // Settle rows
            setBetRows(rows => rows.map(r =>
              r.multiplier === null
                ? { ...r, multiplier: null, win: null } // lost (no cashout)
                : r
            ));
            // User lost if still active
            setMyBetActive(false);
            return crashAt;
          }
          return next;
        });
      }, 80);
      return () => clearInterval(interval);
    }

    if (gameState === "crashed") {
      const t = setTimeout(() => {
        setGameState("waiting");
        setMultiplier(1.0);
        setCashedOut(null);
      }, 3500);
      return () => clearTimeout(t);
    }
  }, [gameState, crashAt, pendingBet, betAmount, startRound]);

  function placeBet() {
    const amt = parseFloat(betAmount);
    if (!amt || amt <= 0) return;
    if (gameState === "waiting") {
      setPendingBet(true);
    } else if (gameState === "flying" && !myBetActive) {
      setPendingBet(true);
    }
  }

  function cashOut() {
    if (!myBetActive || gameState !== "flying") return;
    const winAmt = Math.round(myBetAmount * multiplier * 100) / 100;
    setCashedOut(winAmt);
    setMyBetActive(false);
    // Update rows with my cashout
    setBetRows(rows => {
      const idx = rows.findIndex(r => r.multiplier === null);
      if (idx === -1) return rows;
      const updated = [...rows];
      updated[idx] = { ...updated[idx], multiplier, win: winAmt };
      return updated;
    });
  }

  // Plane position based on progress
  const progress = Math.min((multiplier - 1) / Math.max(crashAt - 1, 0.01), 1);
  const planeX = 8 + progress * 72; // %
  const planeY = 88 - progress * 76; // % (inverted for SVG)

  const isCrashed = gameState === "crashed";
  const isWaiting = gameState === "waiting";

  return (
    <div className="bg-[#0f1117] min-h-screen text-white">
      {/* Aviator header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#1a1e24] border-b border-white/10">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-white">
          <ChevronLeft className="h-4 w-4" />
          <span>Go Back</span>
        </Link>
        <div className="flex items-center gap-3">
          {isAuthenticated && wallet && (
            <span className="text-primary font-bold text-sm">
              {parseFloat(wallet.balance).toFixed(2)} KES
            </span>
          )}
          <AlignJustify className="h-4 w-4 text-muted-foreground" />
          <MessageCircle className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Aviator logo */}
      <div className="px-3 pt-2 pb-1 flex items-center gap-2">
        <span className="text-2xl font-black italic text-red-500 tracking-tight font-serif">Aviator</span>
      </div>

      {/* History row */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none px-3 pb-2">
        {history.map((x, i) => (
          <span
            key={i}
            className={cn(
              "shrink-0 text-xs font-bold px-2 py-0.5 rounded-full bg-white/10",
              multiplierColor(x)
            )}
          >
            {x.toFixed(2)}x
          </span>
        ))}
      </div>

      {/* Game canvas */}
      <div className="relative mx-3 rounded-xl overflow-hidden bg-[#151820] border border-white/10" style={{ height: 220 }}>
        {/* SVG curve + plane */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lineGrad" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ff2244" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ff4466" stopOpacity="1" />
            </linearGradient>
            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff2244" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ff2244" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Filled area */}
          <path
            d={`M 8 88 Q ${planeX * 0.6} ${(88 + planeY) / 2} ${planeX} ${planeY} L ${planeX} 100 L 8 100 Z`}
            fill="url(#fillGrad)"
          />
          {/* Curve line */}
          <path
            d={`M 8 88 Q ${planeX * 0.6} ${(88 + planeY) / 2} ${planeX} ${planeY}`}
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="0.8"
            vectorEffect="non-scaling-stroke"
          />
          {/* Plane dot */}
          {!isCrashed && (
            <circle cx={planeX} cy={planeY} r="1.5" fill="#ff2244" />
          )}
        </svg>

        {/* Plane emoji */}
        {!isCrashed && (
          <div
            className="absolute transition-none text-2xl"
            style={{
              left: `calc(${planeX}% - 16px)`,
              top: `calc(${planeY}% - 16px)`,
              transform: `rotate(-40deg)`,
              fontSize: 28,
            }}
          >
            ✈️
          </div>
        )}

        {/* Multiplier */}
        <div className="absolute inset-0 flex items-center justify-center">
          {isWaiting ? (
            <div className="text-center">
              <p className="text-muted-foreground text-sm font-bold mb-1">Starting in</p>
              <p className="text-white text-3xl font-black animate-pulse">●●●</p>
            </div>
          ) : (
            <div className="text-center">
              <div className={cn(
                "text-5xl font-black tracking-tight drop-shadow-lg",
                isCrashed ? "text-red-500" : "text-white"
              )}>
                {multiplier.toFixed(2)}x
              </div>
              {isCrashed && (
                <p className="text-red-400 font-bold text-sm mt-1">FLEW AWAY!</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bet panel */}
      <div className="mx-3 mt-3 bg-[#1a1e24] rounded-xl border border-white/10 overflow-hidden">
        {/* Bet / Auto tabs */}
        <div className="flex border-b border-white/10">
          {(["Bet", "Auto"] as BetTab[]).map(t => (
            <button
              key={t}
              onClick={() => setBetTab(t)}
              className={cn(
                "flex-1 py-2 text-sm font-bold transition-colors",
                betTab === t ? "text-white bg-white/10" : "text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
          <div className="flex items-center px-3 text-muted-foreground">
            <span className="text-xs border border-white/20 px-2 py-0.5 rounded">−</span>
          </div>
        </div>

        <div className="p-3 flex gap-3 items-center">
          {/* Amount input */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setBetAmount(a => String(Math.max(10, parseFloat(a) - 10)))}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-lg"
              >−</button>
              <input
                type="number"
                value={betAmount}
                onChange={e => setBetAmount(e.target.value)}
                className="flex-1 bg-transparent text-center font-black text-lg text-white outline-none w-20"
              />
              <button
                onClick={() => setBetAmount(a => String(parseFloat(a) + 10))}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold text-lg"
              >+</button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-center">
              {[100, 250, 1000, 25000].map(v => (
                <button
                  key={v}
                  onClick={() => setBetAmount(String(v))}
                  className="bg-white/10 hover:bg-white/20 rounded py-1 font-semibold text-muted-foreground"
                >
                  {v.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Bet / Cash Out button */}
          <div className="flex-1">
            {myBetActive && gameState === "flying" ? (
              <button
                onClick={cashOut}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black rounded-xl py-4 text-sm leading-tight transition-colors"
              >
                <span className="block">Cash Out</span>
                <span className="block text-lg">{(myBetAmount * multiplier).toFixed(2)} KES</span>
              </button>
            ) : cashedOut !== null ? (
              <div className="w-full bg-primary/20 border border-primary rounded-xl py-4 text-center">
                <span className="block text-xs text-primary font-bold">Cashed Out!</span>
                <span className="block text-lg font-black text-primary">{cashedOut.toFixed(2)} KES</span>
              </div>
            ) : (
              <button
                onClick={placeBet}
                disabled={isCrashed || pendingBet}
                className={cn(
                  "w-full font-black rounded-xl py-4 text-sm leading-tight transition-colors",
                  pendingBet
                    ? "bg-primary/60 text-white cursor-not-allowed"
                    : isWaiting
                    ? "bg-primary hover:bg-primary/90 text-white"
                    : isCrashed
                    ? "bg-white/10 text-muted-foreground cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90 text-white"
                )}
              >
                <span className="block">{pendingBet ? "Bet Placed" : "Bet"}</span>
                <span className="block text-lg">{parseFloat(betAmount || "0").toFixed(2)} KES</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bets list */}
      <div className="mx-3 mt-3 bg-[#1a1e24] rounded-xl border border-white/10 overflow-hidden mb-4">
        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {(["All Bets", "Previous", "Top"] as HistoryTab[]).map(t => (
            <button
              key={t}
              onClick={() => setHistTab(t)}
              className={cn(
                "flex-1 py-2 text-xs font-bold transition-colors",
                histTab === t ? "text-white border-b-2 border-primary -mb-px" : "text-muted-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="px-3 py-2 border-b border-white/5">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
            ALL BETS {betRows.length}
          </p>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-4 px-3 py-1.5 text-[10px] text-muted-foreground font-semibold border-b border-white/5">
          <span>Player</span>
          <span className="text-right">Bet KES</span>
          <span className="text-right">X</span>
          <span className="text-right">Win KES</span>
        </div>

        {/* Rows */}
        <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
          {betRows.map(row => (
            <div key={row.id} className="grid grid-cols-4 px-3 py-2 text-xs border-b border-white/5 items-center">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                  {row.player[0]}
                </div>
                <span className="text-muted-foreground font-medium">{row.player}</span>
              </div>
              <span className="text-right text-white font-medium">{row.bet.toLocaleString()}.00</span>
              <span className={cn(
                "text-right font-bold",
                row.multiplier ? multiplierColor(row.multiplier) : "text-muted-foreground"
              )}>
                {row.multiplier ? `${row.multiplier.toFixed(2)}x` : "—"}
              </span>
              <span className="text-right font-medium text-white">
                {row.win ? row.win.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
