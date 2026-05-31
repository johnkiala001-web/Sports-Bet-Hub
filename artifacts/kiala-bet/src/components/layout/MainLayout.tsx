import { Link, useLocation } from "wouter";
import { Home, Activity, Receipt, ClipboardList, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { selections, isOpen, setIsOpen } = useBetSlip();
  const [location] = useLocation();

  const { data: liveMatches } = useListMatches(
    { status: "live", limit: 200 },
    { query: { refetchInterval: 30_000, queryKey: getListMatchesQueryKey({ status: "live", limit: 200 }) } }
  );
  const { data: upcomingForCount } = useListMatches(
    { status: "upcoming", limit: 200 },
    { query: { refetchInterval: 30_000, queryKey: getListMatchesQueryKey({ status: "upcoming", limit: 200 }) } }
  );
  // Count DB-live + upcoming that have already passed kickoff (sync lag)
  const now = new Date();
  const liveIds = new Set((liveMatches ?? []).map(m => m.id));
  const justStartedCount = (upcomingForCount ?? []).filter(
    m => new Date(m.kickoff) <= now && !liveIds.has(m.id)
  ).length;
  const liveCount = (liveMatches?.length ?? 0) + justStartedCount;

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const navItem = (path: string) =>
    cn("flex flex-col items-center gap-0.5 transition-colors",
      isActive(path) ? "text-primary" : "text-muted-foreground hover:text-primary");

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0 font-sans">
      {/* Desktop top header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="font-bold text-xl text-primary tracking-tight">KialaBet</Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">Home</Link>
            <Link href="/live" className="text-sm font-medium transition-colors hover:text-primary flex items-center gap-1">
              Live
              {liveCount > 0 && (
                <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {liveCount}
                </span>
              )}
            </Link>
            <Link href="/sports" className="text-sm font-medium transition-colors hover:text-primary">Sports</Link>
            <Link href="/jackpot" className="text-sm font-medium transition-colors hover:text-primary">Jackpot</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/profile" className="text-sm font-medium transition-colors hover:text-primary">Profile</Link>
            ) : (
              <Link href="/login" className="text-sm font-medium transition-colors hover:text-primary">Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="container py-4 md:py-6">
        {children}
      </main>

      {/* Mobile bottom navigation — 5 tabs */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[60px] w-full border-t border-border bg-background flex items-center justify-around px-2">
        {/* Home */}
        <Link href="/" className={navItem("/")}>
          <Home className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

        {/* Live */}
        <Link href="/live" className={navItem("/live")}>
          <div className="relative">
            <Activity className="h-[22px] w-[22px]" />
            {liveCount > 0 && (
              <span className="absolute -top-1.5 -right-2.5 bg-destructive text-destructive-foreground text-[9px] font-black px-1 rounded-full leading-tight">
                {liveCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Live</span>
        </Link>

        {/* Center Bet Slip button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative flex flex-col items-center -mt-5"
          aria-label="Bet Slip"
        >
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
            "bg-primary hover:bg-primary/90 shadow-primary/40",
            isOpen && "scale-95"
          )}>
            <Receipt className="h-7 w-7 text-primary-foreground" />
            {selections.length > 0 && (
              <span className="absolute top-0 right-0 bg-background text-foreground text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-primary">
                {selections.length}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold mt-0.5 text-muted-foreground">Slip</span>
        </button>

        {/* My Bets */}
        <Link href="/bets" className={navItem("/bets")}>
          <ClipboardList className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">My Bets</span>
        </Link>

        {/* Profile */}
        <Link href={isAuthenticated ? "/profile" : "/login"} className={navItem("/profile")}>
          <UserIcon className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
