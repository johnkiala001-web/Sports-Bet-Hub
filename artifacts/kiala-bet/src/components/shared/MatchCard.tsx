import { Link } from "wouter";
import type { Match } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { OddsButton } from "./OddsButton";

interface MatchCardProps {
  match: Match;
}

function formatKickoff(kickoff: string): string {
  const d = new Date(kickoff);
  const day   = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year  = String(d.getFullYear()).slice(-2);
  const hrs   = String(d.getHours()).padStart(2, "0");
  const mins  = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year}  ${hrs}:${mins}`;
}

export function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === "live";
  const marketsCount = (match as Match & { marketsCount?: number }).marketsCount ?? 0;

  return (
    <Card className="bg-card border-border overflow-hidden hover:border-primary/50 transition-colors">
      <CardContent className="p-0">
        <Link href={`/match/${match.id}`}>
          <div className="p-4 cursor-pointer">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {match.league}
              </span>
              <div className="flex items-center gap-2">
                {isLive ? (
                  <>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-destructive"></span>
                    </span>
                    <span className="text-xs font-bold text-destructive">
                      {match.minute}'
                    </span>
                  </>
                ) : (
                  <span className="text-xs font-medium text-primary">
                    {formatKickoff(match.kickoff)}
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm md:text-base truncate pr-4">{match.homeTeam}</span>
                {isLive && <span className="font-bold text-lg">{match.homeScore ?? 0}</span>}
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-sm md:text-base truncate pr-4">{match.awayTeam}</span>
                {isLive && <span className="font-bold text-lg">{match.awayScore ?? 0}</span>}
              </div>
            </div>
          </div>
        </Link>

        <div className="px-4 pb-4">
          <div className="grid grid-cols-3 gap-2 mt-2">
            <OddsButton
              matchId={match.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              market="1X2"
              label="1"
              odds={match.homeOdds}
            />
            <OddsButton
              matchId={match.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              market="1X2"
              label="X"
              odds={match.drawOdds}
            />
            <OddsButton
              matchId={match.id}
              homeTeam={match.homeTeam}
              awayTeam={match.awayTeam}
              market="1X2"
              label="2"
              odds={match.awayOdds}
            />
          </div>

          {marketsCount > 1 && (
            <Link href={`/match/${match.id}`}>
              <div className="mt-2 text-center py-1.5 rounded-md bg-secondary/60 hover:bg-secondary transition-colors cursor-pointer">
                <span className="text-xs font-semibold text-primary">
                  +{marketsCount - 1} more markets
                </span>
              </div>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
