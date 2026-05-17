import { useParams } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { getGetMatchQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OddsButton } from "@/components/shared/OddsButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = Number(matchId);

  const { data: match, isLoading } = useGetMatch(id, {
    query: {
      enabled: !!id,
      queryKey: getGetMatchQueryKey(id)
    }
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid gap-6">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-bold">Match not found</h2>
        <Link href="/sports" className="text-primary mt-4 inline-block hover:underline">
          Return to Sportsbook
        </Link>
      </div>
    );
  }

  const isLive = match.status === "live";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Link href="/sports" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to matches
      </Link>

      {/* Match Header */}
      <div className="bg-gradient-to-br from-card to-secondary rounded-3xl p-6 md:p-10 border border-border shadow-xl">
        <div className="flex justify-between items-center mb-8">
          <span className="px-3 py-1 bg-background/50 rounded-full text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
            {match.sport} • {match.league}
          </span>
          <div className="flex items-center gap-2">
            {isLive ? (
              <span className="flex items-center gap-2 bg-destructive/20 text-destructive px-3 py-1 rounded-full font-bold text-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                </span>
                {match.minute}'
              </span>
            ) : (
              <span className="text-sm font-medium bg-background/50 px-3 py-1 rounded-full">
                {new Date(match.kickoff).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center max-w-3xl mx-auto">
          <div className="text-center w-1/3">
            <h2 className="text-xl md:text-3xl font-black">{match.homeTeam}</h2>
          </div>
          
          <div className="text-center w-1/3 flex flex-col items-center justify-center">
            {isLive ? (
              <div className="text-4xl md:text-6xl font-black tabular-nums tracking-tighter text-primary">
                {match.homeScore} - {match.awayScore}
              </div>
            ) : (
              <div className="text-xl md:text-2xl font-bold text-muted-foreground">
                VS
              </div>
            )}
          </div>

          <div className="text-center w-1/3">
            <h2 className="text-xl md:text-3xl font-black">{match.awayTeam}</h2>
          </div>
        </div>
      </div>

      {/* Markets */}
      <div className="grid gap-6">
        {match.markets?.map((market) => (
          <Card key={market.id} className="bg-card border-border overflow-hidden">
            <CardHeader className="bg-secondary/30 pb-3 border-b border-border">
              <CardTitle className="text-lg font-bold">{market.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {market.selections.map((selection) => (
                  <div key={selection.id} className="relative">
                    <OddsButton
                      matchId={match.id}
                      homeTeam={match.homeTeam}
                      awayTeam={match.awayTeam}
                      market={market.name}
                      label={selection.label}
                      odds={selection.odds}
                      className="w-full h-16"
                    />
                    {selection.hasBoost && (
                      <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg transform rotate-12">
                        BOOST
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!match.markets || match.markets.length === 0) && (
          <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border">
            No odds available for this match yet.
          </div>
        )}
      </div>
    </div>
  );
}