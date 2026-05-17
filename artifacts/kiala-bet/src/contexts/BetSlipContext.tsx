import { createContext, useContext, useState } from "react";
import { usePlaceBet, useGetWallet, useListBets, getListBetsQueryKey, getGetWalletQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface BetSelection {
  matchId: number;
  market: string;
  label: string;
  odds: number;
  homeTeam: string;
  awayTeam: string;
}

interface BetSlipContextType {
  selections: BetSelection[];
  addSelection: (selection: BetSelection) => void;
  removeSelection: (matchId: number) => void;
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

export function BetSlipProvider({ children }: { children: React.ReactNode }) {
  const [selections, setSelections] = useState<BetSelection[]>([]);
  const [stake, setStake] = useState<number>(0);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const placeBetMutation = usePlaceBet();

  const addSelection = (selection: BetSelection) => {
    setSelections((prev) => {
      const filtered = prev.filter((s) => s.matchId !== selection.matchId);
      return [...filtered, selection];
    });
    setIsOpen(true);
  };

  const removeSelection = (matchId: number) => {
    setSelections((prev) => prev.filter((s) => s.matchId !== matchId));
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
          selections: selections.map(s => ({
            matchId: s.matchId,
            market: s.market,
            label: s.label,
            odds: s.odds
          }))
        }
      },
      {
        onSuccess: () => {
          toast({
            title: "Bet Placed Successfully",
            description: "Good luck!",
          });
          clearSlip();
          setIsOpen(false);
          queryClient.invalidateQueries({ queryKey: getListBetsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetWalletQueryKey() });
        },
        onError: () => {
          toast({
            title: "Error Placing Bet",
            description: "Please try again later.",
            variant: "destructive",
          });
        }
      }
    );
  };

  return (
    <BetSlipContext.Provider
      value={{
        selections,
        addSelection,
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
