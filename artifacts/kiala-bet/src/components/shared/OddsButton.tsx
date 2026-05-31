import { cn } from "@/lib/utils";
import { useBetSlip } from "@/contexts/BetSlipContext";

interface OddsButtonProps {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  market: string;
  label: string;
  odds: number;
  className?: string;
  sgmMode?: boolean;
  sgmSelected?: boolean;
  onSGMToggle?: () => void;
}

export function OddsButton({
  matchId,
  homeTeam,
  awayTeam,
  market,
  label,
  odds,
  className,
  sgmMode = false,
  sgmSelected = false,
  onSGMToggle,
}: OddsButtonProps) {
  const { selections, addSelection, removeSelection } = useBetSlip();

  const normalSelection = selections.find(
    (s) => s.matchId === matchId && s.label === label && s.market === market && !s.sgmLegs
  );
  const isNormalSelected = !!normalSelection;

  const isSelected = sgmMode ? sgmSelected : isNormalSelected;

  const handleClick = () => {
    if (sgmMode) {
      onSGMToggle?.();
      return;
    }
    if (isNormalSelected && normalSelection) {
      removeSelection(normalSelection.id);
    } else {
      addSelection({ matchId, market, label, odds, homeTeam, awayTeam });
    }
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex flex-col items-center justify-center p-2 rounded-md transition-all duration-200 min-w-[60px]",
        isSelected
          ? "bg-primary text-primary-foreground font-bold shadow-md scale-[1.02]"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:text-primary",
        className
      )}
    >
      <span className="text-[10px] uppercase opacity-80">{label}</span>
      <span className={cn("text-sm", isSelected ? "font-bold" : "font-medium")}>
        {odds.toFixed(2)}
      </span>
    </button>
  );
}
