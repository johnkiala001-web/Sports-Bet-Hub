import { createContext, useContext, useState } from "react";
import { usePlaceBet, useGetWallet, useListBets, getListBetsQueryKey, getGetWalletQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface SGMLeg {
  market: string;
  label: string;
  odds: number;
}

export interface BetSelection {
  id: string;
  matchId: number;
  market: string;
  label: string;
  odds: number;
  homeTeam: string;
  awayTeam: string;
  sgmLegs?: SGMLeg[];
}

interface BetSlipContextType {
  selections: BetSelection[];
  addSelection: (selection: Omit<BetSelection, "id">) => void;
  addSGMBet: (matchId: number, homeTeam: string, awayTeam: string, legs: SGMLeg[]) => void;
  removeSelection: (id: string) => void;
  clearSlip: () => void;
  stake: number;
  setStake: (stake: number) => void;
  totalOdds: number;
  potentialWin: number;
  placeBet: () => void;
  isPlacing: boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const BetSlipContext = createContext<BetSlipContextType | undefined>(undefined);

function sgmCombinedOdds(legs: SGMLeg[]): number {
  return legs.reduce((acc, l) => acc * l.odds, 1);
}

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [stake, setStake] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const placeBetMutation = usePlaceBet();

  const addSelection = (selection: Omit<BetSelection, "id">) => {
    setSelections((prev) => {
      const filtered = prev.filter((s) => !(s.matchId === selection.matchId && !s.sgmLegs));
      const id = `single-${selection.matchId}-${selection.market}`;
      return [...filtered, { ...selection, id }];
    });
    setIsOpen(true);
  };

  const addSGMBet = (matchId: number, homeTeam: string, awayTeam: string, legs: SGMLeg[]) => {
    if (legs.length === 0) return;
    const combined = sgmCombinedOdds(legs);
    const id = `sgm-${matchId}-${Date.now()}`;
    setSelections((prev) => {
      const filtered = prev.filter((s) => !(s.matchId === matchId && !!s.sgmLegs));
      return [
        ...filtered,
        {
          id,
          matchId,
          homeTeam,
          awayTeam,
          market: "Same Game Multi",
          label: `${legs.length} leg${legs.length > 1 ? "s" : ""}`,
          odds: combined,
          sgmLegs: legs,
        },
      ];
    });
    setIsOpen(true);
  };

  const removeSelection = (id: string) => {
    setSelections((prev) => prev.filter((s) => s.id !== id));
  };

  const clearSlip = () => {
    setSelections([]);
    setStake(0);
  };

  const totalOdds = selections.reduce((acc, curr) => acc * curr.odds, 1);
  const potentialWin = stake * totalOdds;

  const placeBet = () => {
    if (selections.length === 0 || stake <= 0) return;

    placeBetMutation.mutate(
      {
        data: {
          stake,
          selections: selections.flatMap((s) =>
            s.sgmLegs
              ? s.sgmLegs.map((leg) => ({
                  matchId: s.matchId,
                  market: leg.market,
                  label: leg.label,
                  odds: leg.odds,
                }))
              : [{ matchId: s.matchId, market: s.market, label: s.label, odds: s.odds }]
          ),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Bet Placed Successfully", description: "Good luck!" });
          clearSlip();
          setIsOpen(false);
          queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        },
        onError: () => {
          toast({ title: "Error Placing Bet", description: "Please try again later.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <BetSlipContext.Provider
      value={{
        selections,
        addSelection,
        addSGMBet,
        removeSelection,
        clearSlip,
        stake,
        setStake,
        totalOdds,
        potentialWin,
        placeBet,
        isPlacing: placeBetMutation.isPending,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </BetSlipContext.Provider>
  );
}

export function useBetSlip() {
  const context = useContext(BetSlipContext);
  if (context === undefined) {
    throw new Error("useBetSlip must be used within a BetSlipProvider");
  }
  return context;
}
