import { useGetLiveMatches } from "@workspace/api-client-react";
import { MatchCard } from "@/components/shared/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

export default function Live() {
  const { data: matches, isLoading } = useGetLiveMatches();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-3 bg-destructive/10 text-destructive w-fit px-4 py-2 rounded-full border border-destructive/20">
        <span className="flex h-3 w-3 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
        </span>
        <h1 className="text-xl font-bold tracking-tight">Live In-Play</h1>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl bg-card border border-border" />
          ))}
        </div>
      ) : matches && matches.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {matches.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground bg-card rounded-xl border border-border">
          <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-xl font-bold text-foreground mb-2">No Live Matches</p>
          <p className="text-sm">There are currently no matches being played. Check back later!</p>
        </div>
      )}
    </div>
  );
}