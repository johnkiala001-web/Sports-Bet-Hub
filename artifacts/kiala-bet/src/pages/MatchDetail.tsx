import { useState, useMemo } from "react";
import { useParams } from "wouter";
import { useGetMatch } from "@workspace/api-client-react";
import { getGetMatchQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { OddsButton } from "@/components/shared/OddsButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Layers, X, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useBetSlip, type SGMLeg } from "@/contexts/BetSlipContext";

export default function MatchDetail() {
  const { matchId } = useParams<{ matchId: string }>();
  const id = Number(matchId);
  const { addSGMBet, setIsOpen } = useBetSlip();

  const [builderMode, setBuilderMode] = useState(false);
  const [builderLegs, setBuilderLegs] = useState<Map<string, SGMLeg>>(new Map());
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set());

  const { data: match, isLoading } = useGetMatch(id, {
    query: { enabled: !!id, queryKey: getGetMatchQueryKey(id) },
  });

  const combinedOdds = useMemo(() => {
    const legs = Array.from(builderLegs.values());
    return legs.reduce((acc, l) => acc * l.odds, 1);
  }, [builderLegs]);

  const toggleBuilderLeg = (market: string, label: string, odds: number) => {
    setBuilderLegs((prev) => {
      const next = new Map(prev);
      const existing = next.get(market);
      if (existing && existing.label === label) {
        next.delete(market);
      } else {
        next.set(market, { market, label, odds });
      }
      return next;
    });
  };

  const toggleMarketExpanded = (marketName: string) => {
    setExpandedMarkets(prev => {
      const next = new Set(prev);
      if (next.has(marketName)) next.delete(marketName);
      else next.add(marketName);
      return next;
    });
  };

  const commitSGM = () => {
    if (!match) return;
    const legs = Array.from(builderLegs.values());
    addSGMBet(match.id, match.homeTeam, match.awayTeam, legs);
    setBuilderMode(false);
    setBuilderLegs(new Map());
    setIsOpen(true);
  };

  const exitBuilder = () => {
    setBuilderMode(false);
    setBuilderLegs(new Map());
  };

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
  const builderLegCount = builderLegs.size;

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-300", builderMode && "pb-36")}>
      {/* Back link */}
      <Link href="/sports" className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to matches
      </Link>

      {/* Match Header */}
      <div className="bg-gradient-to-br from-card to-secondary rounded-3xl p-6 md:p-10 border border-border shadow-xl">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-3">
          <span className="px-3 py-1 bg-background/50 rounded-full text-xs font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
            {match.sport} • {match.league}
          </span>
          <div className="flex items-center gap-3">
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

            {/* Bet Builder toggle */}
            <button
              onClick={() => builderMode ? exitBuilder() : setBuilderMode(true)}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold transition-all duration-200 border",
                builderMode
                  ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                  : "bg-background/50 text-foreground border-border hover:border-primary hover:text-primary"
              )}
            >
              <Layers className="h-4 w-4" />
              {builderMode ? "Building..." : "Bet Builder"}
            </button>
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
              <div className="text-xl md:text-2xl font-bold text-muted-foreground">VS</div>
            )}
          </div>
          <div className="text-center w-1/3">
            <h2 className="text-xl md:text-3xl font-black">{match.awayTeam}</h2>
          </div>
        </div>
      </div>

      {/* Builder mode banner */}
      {builderMode && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 flex items-start gap-3">
          <Layers className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-sm text-primary">Bet Builder mode active</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select one outcome per market below. Selections combine into a single multi-leg bet.
              Only one selection per market is allowed — picking a new one replaces the previous.
            </p>
          </div>
        </div>
      )}

      {/* Markets */}
      <div className="grid gap-4">
        {match.markets?.map((market) => {
          const builderLeg = builderLegs.get(market.name);
          const isExpanded = expandedMarkets.has(market.name);
          const showAll = market.selections.length <= 6 || isExpanded;
          const visibleSelections = showAll ? market.selections : market.selections.slice(0, 6);

          return (
            <Card
              key={market.id}
              className={cn(
                "bg-card border-border overflow-hidden transition-colors",
                builderMode && builderLeg && "border-primary/60"
              )}
            >
              <CardHeader className={cn(
                "pb-3 border-b border-border",
                builderMode && builderLeg
                  ? "bg-primary/10"
                  : "bg-secondary/30"
              )}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold">{market.name}</CardTitle>
                  {builderMode && builderLeg && (
                    <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                      {builderLeg.label} · {builderLeg.odds.toFixed(2)}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {visibleSelections.map((selection) => {
                    const isSgmSelected = builderMode && builderLeg?.label === selection.label;
                    return (
                      <div key={selection.id} className="relative">
                        <OddsButton
                          matchId={match.id}
                          homeTeam={match.homeTeam}
                          awayTeam={match.awayTeam}
                          market={market.name}
                          label={selection.label}
                          odds={selection.odds}
                          className="w-full h-16"
                          sgmMode={builderMode}
                          sgmSelected={isSgmSelected}
                          onSGMToggle={() => toggleBuilderLeg(market.name, selection.label, selection.odds)}
                        />
                        {selection.hasBoost && (
                          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg transform rotate-12">
                            BOOST
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {market.selections.length > 6 && (
                  <button
                    onClick={() => toggleMarketExpanded(market.name)}
                    className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors py-1"
                  >
                    {isExpanded ? (
                      <><ChevronUp className="h-3 w-3" /> Show less</>
                    ) : (
                      <><ChevronDown className="h-3 w-3" /> Show {market.selections.length - 6} more</>
                    )}
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}

        {(!match.markets || match.markets.length === 0) && (
          <div className="text-center py-10 text-muted-foreground bg-card rounded-xl border border-border">
            No odds available for this match yet.
          </div>
        )}
      </div>

      {/* Sticky Bet Builder Footer */}
      {builderMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.6)] p-4">
          <div className="max-w-2xl mx-auto">
            {builderLegCount === 0 ? (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Select outcomes above to build your bet</p>
                <button onClick={exitBuilder} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <>
                {/* Selected legs summary */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {Array.from(builderLegs.values()).map((leg) => (
                    <div
                      key={leg.market}
                      className="flex items-center gap-1.5 bg-secondary rounded-full px-3 py-1 text-xs font-medium"
                    >
                      <span className="text-muted-foreground">{leg.market}:</span>
                      <span className="font-bold">{leg.label}</span>
                      <span className="text-primary font-black">{leg.odds.toFixed(2)}</span>
                      <button
                        onClick={() => toggleBuilderLeg(leg.market, leg.label, leg.odds)}
                        className="text-muted-foreground hover:text-destructive ml-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">
                      {builderLegCount} leg{builderLegCount > 1 ? "s" : ""} · Combined odds
                    </div>
                    <div className="text-2xl font-black text-primary">{combinedOdds.toFixed(2)}</div>
                  </div>
                  <button onClick={exitBuilder} className="text-muted-foreground hover:text-foreground p-2">
                    <X className="h-5 w-5" />
                  </button>
                  <Button
                    onClick={commitSGM}
                    disabled={builderLegCount < 1}
                    className="px-6 h-12 font-bold text-base"
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Add to Slip
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
