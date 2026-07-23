import { useEffect, useState } from "react";
import { useListBets, getListBetsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "open" | "all" | "won" | "lost";

function betCode(id: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "#" + Array.from({ length: 6 }, (_, i) => chars[(id * 31 + i * 17) % chars.length]).join("");
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function formatPlacedAt(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, "0");
  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  return `${h}:${m}${ampm} on ${ordinal(d.getDate())} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `Starts at ${day}/${month}, ${h}:${m}`;
}

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "Open", value: "open" },
  { label: "All", value: "all" },
  { label: "Won", value: "won" },
  { label: "Lost", value: "lost" },
];

export default function Bets() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [filter, setFilter] = useState<FilterType>("open");
  const [filterOpen, setFilterOpen] = useState(false);
  const [expandedBet, setExpandedBet] = useState<number | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: bets, isLoading } = useListBets({}, {
    query: {
      enabled: isAuthenticated,
      queryKey: getListBetsQueryKey({}),
      refetchInterval: (query) => {
        const list = query.state.data as any[] | undefined;
        const hasPending = list?.some((b) => b.status === "pending");
        return hasPending ? 5000 : false;
      },
    }
  });

  if (authLoading || !isAuthenticated) return null;

  const lastUpdated = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const filtered = (() => {
    if (!bets) return [];
    if (filter === "open") return bets.filter(b => b.status === "pending");
    if (filter === "won") return bets.filter(b => b.status === "won");
    if (filter === "lost") return bets.filter(b => b.status === "lost");
    return bets;
  })();

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl mx-auto">
      <p className="text-xs text-center text-muted-foreground">Last updated at {lastUpdated}</p>

      <div className="relative">
        <button
          onClick={() => setFilterOpen(!filterOpen)}
          className="flex items-center gap-2 bg-secondary/80 border border-border rounded-full px-4 py-2 text-sm font-bold"
        >
          {FILTERS.find(f => f.value === filter)?.label}
          <ChevronDown className={cn("h-4 w-4 transition-transform", filterOpen && "rotate-180")} />
        </button>

        {filterOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
            <div className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[180px]">
              <p className="text-xs font-bold text-muted-foreground px-4 pt-3 pb-2 uppercase tracking-wider">Filter</p>
              {FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFilter(f.value); setFilterOpen(false); }}
                  className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium hover:bg-secondary/60 transition-colors"
                >
                  {f.label}
                  {f.value === filter && <span className="text-primary font-black">✓</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl bg-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border text-muted-foreground">
          <p className="font-bold text-lg mb-1">No bets found</p>
          <p className="text-sm">
            {filter === "open" ? "You have no open bets." : `No ${filter} bets to show.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...filtered].reverse().map(bet => {
            const isExpanded = expandedBet === bet.id;
            const resolvedCount = bet.selections.filter((s: any) => s.result !== "pending").length;
            const totalCount = bet.selections.length;

            const statusLabel =
              bet.status === "won" ? "Won" :
              bet.status === "lost" ? "Lost" :
              bet.status === "cashed_out" ? "Cashed Out" :
              `Open (${resolvedCount}/${totalCount})`;

            const statusColor =
              bet.status === "won" ? "text-green-500" :
              bet.status === "lost" ? "text-red-500" :
              bet.status === "cashed_out" ? "text-yellow-400" :
              "text-primary";

            const wonCount = bet.selections.filter((s: any) => s.result === "won").length;
            const lostCount = bet.selections.filter((s: any) => s.result === "lost").length;
            const pendingCount = bet.selections.filter((s: any) => s.result === "pending").length;

            return (
              <div key={bet.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedBet(isExpanded ? null : bet.id)}
                >
                  <p className="font-black text-sm tracking-wider">{betCode(bet.id)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Prematch Bet placed at {formatPlacedAt(bet.createdAt)}
                  </p>
                  <p className={cn("text-sm font-bold mt-1", statusColor)}>{statusLabel}</p>

                  <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Amount</p>
                      <p className="font-bold text-sm">KES {bet.stake.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">
                        {bet.status === "won" ? "Payout" : "Possible Payout"}
                      </p>
                      <p className="font-bold text-sm">
                        KES {bet.status === "won" && bet.actualWin != null
                          ? Number(bet.actualWin).toFixed(2)
                          : bet.potentialWin.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">W/L/T</p>
                      <p className="font-bold text-sm">{wonCount}/{lostCount}/{pendingCount}</p>
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 p-4 space-y-3">
                    {bet.selections.map((sel: any) => {
                      const hasScore = sel.homeScore != null && sel.awayScore != null;
                      const isLive = sel.matchStatus === "live";
                      const isFinished = sel.matchStatus === "finished";

                      const middleLabel = hasScore
                        ? `${sel.homeScore}:${sel.awayScore}`
                        : "vs";

                      const timeLabel = isFinished
                        ? "FT Results"
                        : isLive
                          ? "Started"
                          : sel.kickoff
                            ? formatKickoff(sel.kickoff)
                            : "";

                      const resultIcon = sel.result === "won"
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : sel.result === "lost"
                          ? <XCircle className="h-4 w-4 text-red-500" />
                          : null;

                      return (
                        <div key={sel.id} className="text-sm bg-card/50 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-bold text-xs truncate">{sel.homeTeam}</p>
                            <span className="text-xs font-black bg-secondary rounded-full px-2 py-0.5 mx-2 shrink-0">
                              {middleLabel}
                            </span>
                            <p className="font-bold text-xs truncate text-right">{sel.awayTeam}</p>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{sel.market}</span>
                            <span className="text-muted-foreground">{timeLabel}</span>
                          </div>

                          <div className="flex items-center justify-between text-xs">
                            <div>
                              <span className="text-muted-foreground">Pick: </span>
                              <span className="font-semibold">{sel.label}</span>
                              <span className="font-black text-primary ml-1">({sel.odds.toFixed(2)})</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs pt-1 border-t border-border/30">
                            <div>
                              <span className="text-muted-foreground">Outcome: </span>
                              <span className="font-semibold">{isFinished && sel.outcome ? sel.outcome : ""}</span>
                            </div>
                            {resultIcon}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
