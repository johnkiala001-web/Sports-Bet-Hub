import { useBetSlip } from "@/contexts/BetSlipContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Trash2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";

export function BetSlip() {
  const {
    selections,
    removeSelection,
    clearSlip,
    stake,
    setStake,
    totalOdds,
    potentialWin,
    placeBet,
    isPlacing,
    isOpen,
    setIsOpen,
  } = useBetSlip();
  const { isAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();

  if (!isOpen && selections.length === 0) return null;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 md:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={cn(
          "fixed z-50 bg-card border-border flex flex-col shadow-2xl transition-transform duration-300 ease-in-out",
          "bottom-[60px] left-0 right-0 h-[78vh] md:h-screen rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l",
          "md:top-0 md:bottom-0 md:right-0 md:left-auto md:w-96",
          isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg">Bet Slip</h2>
            <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
              {selections.length}
            </span>
          </div>
          <div className="flex gap-2">
            {selections.length > 0 && (
              <Button variant="ghost" size="icon" onClick={clearSlip} className="text-muted-foreground hover:text-foreground">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          {selections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <p className="text-sm">Your bet slip is empty.</p>
              <p className="text-xs mt-1">Make a selection to start playing.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {selections.map((s) =>
                s.sgmLegs ? (
                  <div key={s.id} className="bg-secondary/50 rounded-lg p-3 relative border border-primary/40">
                    <button
                      onClick={() => removeSelection(s.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex items-center gap-1 bg-primary/20 text-primary text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                        <Layers className="h-3 w-3" /> Builder
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{s.homeTeam} vs {s.awayTeam}</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      {s.sgmLegs.map((leg, i) => (
                        <div key={i} className="flex justify-between items-center text-xs">
                          <div className="flex flex-col min-w-0">
                            <span className="text-muted-foreground truncate">{leg.market}</span>
                            <span className="font-semibold">{leg.label}</span>
                          </div>
                          <span className="text-primary font-bold ml-2 shrink-0">{leg.odds.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground">{s.sgmLegs.length} legs combined</span>
                      <span className="font-black text-primary text-base">{s.odds.toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div key={s.id} className="bg-secondary/50 rounded-lg p-3 relative border border-border">
                    <button
                      onClick={() => removeSelection(s.id)}
                      className="absolute top-2 right-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="text-xs text-muted-foreground mb-1">
                      {s.homeTeam} vs {s.awayTeam}
                    </div>
                    <div className="flex justify-between items-center font-bold pr-4">
                      <span>{s.label} <span className="font-normal text-muted-foreground">({s.market})</span></span>
                      <span className="text-primary">{s.odds.toFixed(2)}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </ScrollArea>

        {selections.length > 0 && (
          <div className="p-4 border-t border-border bg-card space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Odds:</span>
              <span className="font-bold">{totalOdds.toFixed(2)}</span>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Stake (KES)</label>
              <Input
                type="number"
                min="0"
                value={stake || ""}
                onChange={(e) => setStake(Number(e.target.value))}
                placeholder="Enter stake"
                className="bg-secondary/50 font-bold text-lg text-right"
              />
            </div>
            <div className="flex justify-between items-center py-2 border-y border-border/50">
              <span className="font-bold">Potential Win:</span>
              <span className="text-xl font-black text-primary">KES {potentialWin.toFixed(2)}</span>
            </div>
            {isAuthenticated ? (
              <Button className="w-full h-12 text-lg font-bold" onClick={placeBet} disabled={isPlacing || stake <= 0}>
                {isPlacing ? "Placing Bet..." : "Place Bet"}
              </Button>
            ) : (
              <Button
                className="w-full h-12 text-lg font-bold"
                variant="secondary"
                onClick={() => { setIsOpen(false); setLocation("/login"); }}
              >
                Login to Place Bet
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Desktop floating trigger when closed */}
      {!isOpen && selections.length > 0 && (
        <button
          onClick={() => setIsOpen(true)}
          className="hidden md:flex fixed bottom-8 right-8 bg-primary text-primary-foreground p-4 rounded-full shadow-2xl items-center gap-2 hover:scale-105 transition-transform z-40"
        >
          <span className="font-bold">Bet Slip</span>
          <span className="bg-background text-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">
            {selections.length}
          </span>
        </button>
      )}
    </>
  );
}
