import { useState } from "react";
import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { MatchCard } from "@/components/shared/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { CalendarOff, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const TABS = ["Highlights", "Upcoming"] as const;
type Tab = typeof TABS[number];

export default function Home() {
  const [tab, setTab] = useState<Tab>("Highlights");

  const { data: allUpcoming, isLoading } = useListMatches(
    { status: "upcoming", limit: 200 },
    { query: { refetchInterval: 30_000, queryKey: getListMatchesQueryKey({ status: "upcoming", limit: 200 }) } }
  );

  const now = new Date();
  const upcomingMatches = (allUpcoming ?? []).filter(m => new Date(m.kickoff) > now);

  // "Highlights" = first 10 matches, "Upcoming" = all
  const displayed = tab === "Highlights" ? upcomingMatches.slice(0, 10) : upcomingMatches;

  return (
    <div className="animate-in fade-in duration-300 pb-4">
      {/* Sub-tabs */}
      <div className="flex border-b border-border mb-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-px",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Match list */}
      {isLoading ? (
        <div className="space-y-2 mt-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-[100px] bg-card rounded-xl" />
          ))}
        </div>
      ) : displayed.length > 0 ? (
        <div className="space-y-2 mt-1">
          {displayed.map(match => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card rounded-xl border border-border mt-2">
          <CalendarOff className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-lg font-bold text-foreground mb-1">No Matches Right Now</p>
          <p className="text-sm">Check the Live tab for games in progress.</p>
        </div>
      )}

      {/* Jackpot banner */}
      <div className="mt-4 bg-gradient-to-r from-primary/20 to-[#1a1e2c] border border-primary/30 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="font-black text-sm uppercase tracking-wide text-primary">Mega Jackpot</p>
            <p className="font-black text-xl text-white">KES 1,000,000</p>
          </div>
        </div>
        <Button size="sm" className="font-bold shrink-0" asChild>
          <Link href="/jackpot">Play</Link>
        </Button>
      </div>
    </div>
  );
}
