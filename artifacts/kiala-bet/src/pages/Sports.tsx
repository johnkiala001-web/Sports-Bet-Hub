import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { MatchCard } from "@/components/shared/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useParams, useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarOff } from "lucide-react";

const SPORTS = [
  { value: "football", label: "⚽ Football" },
  { value: "basketball", label: "🏀 Basketball" },
  { value: "tennis", label: "🎾 Tennis" },
  { value: "esports", label: "🎮 Esports" },
];

function SportTab({ sport }: { sport: string }) {
  const { data: matches, isLoading } = useListMatches(
    { sport },
    { query: { refetchInterval: 60_000, queryKey: getListMatchesQueryKey({ sport }) } }
  );

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl bg-card border border-border" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center text-muted-foreground bg-card rounded-xl border border-border">
        <CalendarOff className="h-12 w-12 mb-4 opacity-20" />
        <p className="text-xl font-bold text-foreground mb-2">No Available Matches</p>
        <p className="text-sm max-w-xs">
          No {sport} matches available currently. Check back soon — fixtures refresh automatically every 60 seconds.
        </p>
      </div>
    );
  }

  // Group by league
  const byLeague: Record<string, typeof matches> = {};
  for (const m of matches) {
    const key = m.league || "Other";
    if (!byLeague[key]) byLeague[key] = [];
    byLeague[key].push(m);
  }

  return (
    <div className="space-y-8">
      {Object.entries(byLeague).map(([league, leagueMatches]) => (
        <div key={league}>
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            {league}
            <span className="h-px flex-1 bg-border" />
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {leagueMatches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Sports() {
  const params = useParams<{ sport?: string }>();
  const [_, setLocation] = useLocation();
  const currentSport = params.sport || "football";

  const handleTabChange = (val: string) => {
    setLocation(`/sports/${val}`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Sportsbook</h1>
      </div>

      <Tabs value={currentSport} onValueChange={handleTabChange} className="w-full">
        <TabsList className="bg-secondary mb-6 w-full justify-start overflow-x-auto p-1 h-auto rounded-xl border border-border">
          {SPORTS.map((s) => (
            <TabsTrigger
              key={s.value}
              value={s.value}
              className="rounded-lg px-6 py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold"
            >
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {SPORTS.map((s) => (
          <TabsContent key={s.value} value={s.value} className="mt-0 outline-none">
            <SportTab sport={s.value} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}