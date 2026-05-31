import { useEffect, useState } from "react";
import { useListBets, getListBetsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterType = "open" | "all" | "won" | "lost";

function betCode(id: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return "#" + Array.from({ length: 6 }, (_, i) => chars[(id * 31 + i * 17) % chars.length]).join("");
}

function formatBetDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}, ${h}:${m}`;
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
    query: { enabled: isAuthenticated, queryKey: getListBetsQueryKey({}) }
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

  const statusConfig = {
    pending: { label: "Open", color: "text-primary", icon: Clock },
    won: { label: "Won", color: "text-primary", icon: CheckCircle2 },
    lost: { label: "Lost", color: "text-destructive", icon: XCircle },
    cashed_out: { label: "Cashed Out", color: "text-yellow-400", icon: CheckCircle2 },
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300 max-w-2xl mx-auto">
      <p className="text-xs text-center text-muted-foreground">Last updated at {lastUpdated}</p>

      {/* Filter selector — Betika style */}
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

      {/* Bets list */}
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
            const cfg = statusConfig[bet.status as keyof typeof statusConfig] ?? statusConfig.pending;
            const StatusIcon = cfg.icon;
            const isExpanded = expandedBet === bet.id;

            return (
              <div key={bet.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Bet card header */}
                <button
                  className="w-full text-left p-4"
                  onClick={() => setExpandedBet(isExpanded ? null : bet.id)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-black text-sm tracking-wider">{betCode(bet.id)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatBetDate(bet.createdAt)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">KES {bet.stake.toFixed(2)}</p>
                      <p className={cn("text-sm font-bold", cfg.color)}>{cfg.label}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                    <div>
                      <span className="text-xs text-muted-foreground">
                        {bet.selections.length} selection{bet.selections.length > 1 ? "s" : ""} · Odds {bet.totalOdds.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {bet.status === "pending" && (
                        <span className="text-xs text-muted-foreground font-medium">
                          Potential: <span className="text-foreground font-bold">KES {bet.potentialWin.toFixed(2)}</span>
                        </span>
                      )}
                      {bet.status === "won" && bet.actualWin != null && (
                        <span className="text-xs font-bold text-primary">
                          Won: KES {Number(bet.actualWin).toFixed(2)}
                        </span>
                      )}
                      <StatusIcon className={cn("h-4 w-4", cfg.color)} />
                    </div>
                  </div>
                </button>

                {/* Expanded selections */}
                {isExpanded && (
                  <div className="border-t border-border bg-secondary/20 p-4 space-y-3">
                    {bet.selections.map(sel => {
                      const selStatus = sel.result === "won"
                        ? "won"
                        : sel.result === "lost"
                          ? "lost"
                          : "pending";
                      const selCfg = statusConfig[selStatus as keyof typeof statusConfig];
                      const SelIcon = selCfg.icon;

                      return (
                        <div key={sel.id} className="flex items-start justify-between text-sm">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="font-bold text-xs truncate">{sel.homeTeam} vs {sel.awayTeam}</p>
                            <p className="text-muted-foreground text-xs">{sel.market}</p>
                            <p className="font-semibold mt-0.5">{sel.label}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-black text-primary">{sel.odds.toFixed(2)}</span>
                            <SelIcon className={cn("h-4 w-4", selCfg.color)} />
                          </div>
                        </div>
                      );
                    })}

                    <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Stake</p>
                        <p className="font-bold text-sm">KES {bet.stake.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Odds</p>
                        <p className="font-bold text-sm">{bet.totalOdds.toFixed(2)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold">
                          {bet.status === "won" ? "Payout" : "Possible"}
                        </p>
                        <p className={cn("font-black text-sm", bet.status === "won" ? "text-primary" : "")}>
                          KES {bet.status === "won" && bet.actualWin != null
                            ? Number(bet.actualWin).toFixed(2)
                            : bet.potentialWin.toFixed(2)}
                        </p>
                      </div>
                    </div>
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
