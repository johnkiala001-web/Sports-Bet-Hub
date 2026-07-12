import { Link, useLocation } from "wouter";
import { Home, Activity, Receipt, ClipboardList, User as UserIcon, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useBetSlip } from "@/contexts/BetSlipContext";
import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

const CATEGORIES = [
  { label: "Soccer", icon: "⚽", href: "/" },
  { label: "Aviator", icon: "✈️", href: "/aviator" },
];

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

  const isAviator = location.startsWith("/aviator");

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 md:pb-0 font-sans">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full bg-[#1a1e24] border-b border-border/50">
        <div className="flex h-14 items-center justify-between px-3 max-w-screen-xl mx-auto">
          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-2">
            <button className="text-muted-foreground hover:text-foreground p-1">
              <Menu className="h-5 w-5" />
            </button>
            <Link href="/" className="font-black text-xl tracking-tight">
              <span className="text-primary">Kiala</span>
              <span className="text-white">Bet</span>
              <span className="text-primary">!</span>
            </Link>
          </div>

          {/* Right: auth buttons */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <Link
                href="/wallet"
                className="bg-primary hover:bg-primary/90 text-white font-bold text-sm px-4 py-1.5 rounded-full transition-colors"
              >
                Deposit
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-primary font-bold text-sm px-3 py-1.5 hover:underline"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="border border-primary text-primary hover:bg-primary hover:text-white font-bold text-sm px-4 py-1.5 rounded-full transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Category tabs — only on main pages (not Aviator's own layout) */}
        {!isAviator && (
          <div className="flex overflow-x-auto scrollbar-none border-t border-border/30 bg-[#141820]">
            {CATEGORIES.map(cat => (
              <Link
                key={cat.href}
                href={cat.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-5 py-2 text-[11px] font-bold shrink-0 border-b-2 transition-colors",
                  isActive(cat.href) && cat.href !== "/" ? "border-primary text-primary" :
                  cat.href === "/" && location === "/" ? "border-primary text-primary" :
                  "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-lg leading-none">{cat.icon}</span>
                <span>{cat.label}</span>
              </Link>
            ))}
          </div>
        )}
      </header>

      <main className={cn("max-w-screen-xl mx-auto", isAviator ? "" : "px-3 py-3 md:py-4")}>
        {children}
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-[60px] w-full border-t border-border bg-[#1a1e24] flex items-center justify-around px-2">
        <Link href="/" className={navItem("/")}>
          <Home className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">Home</span>
        </Link>

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

        <Link href="/bets" className={navItem("/bets")}>
          <ClipboardList className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">My Bets</span>
        </Link>

        <Link href={isAuthenticated ? "/profile" : "/login"} className={navItem("/profile")}>
          <UserIcon className="h-[22px] w-[22px]" />
          <span className="text-[10px] font-semibold">Profile</span>
        </Link>
      </nav>
    </div>
  );
}
