import { Link } from "wouter";
import type { Match } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { OddsButton } from "./OddsButton";

interface MatchCardProps {
  match: Match;
}

export function MatchCard({ match }: MatchCardProps) {
  const isLive = match.status === "live";

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
                    {new Date(match.kickoff).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
        </div>
      </CardContent>
    </Card>
  );
}