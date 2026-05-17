import { Link } from "wouter";
import { Home, Trophy, Activity, Gift, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 md:pb-0 font-sans">
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <Link href="/" className="font-bold text-xl text-primary tracking-tight">KialaBet</Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium transition-colors hover:text-primary">Home</Link>
            <Link href="/sports" className="text-sm font-medium transition-colors hover:text-primary">Sports</Link>
            <Link href="/live" className="text-sm font-medium transition-colors hover:text-primary">Live</Link>
            <Link href="/jackpot" className="text-sm font-medium transition-colors hover:text-primary">Jackpot</Link>
          </nav>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard" className="text-sm font-medium transition-colors hover:text-primary">Dashboard</Link>
            ) : (
              <Link href="/login" className="text-sm font-medium transition-colors hover:text-primary">Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6">
        {children}
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-around border-t border-border bg-background px-4 pb-safe">
        <Link href="/" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
          <Home className="h-5 w-5" />
          <span className="text-[10px] font-medium">Home</span>
        </Link>
        <Link href="/sports" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
          <Trophy className="h-5 w-5" />
          <span className="text-[10px] font-medium">Sports</span>
        </Link>
        <Link href="/live" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
          <Activity className="h-5 w-5" />
          <span className="text-[10px] font-medium">Live</span>
        </Link>
        <Link href="/jackpot" className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
          <Gift className="h-5 w-5" />
          <span className="text-[10px] font-medium">Jackpot</span>
        </Link>
        <Link href={isAuthenticated ? "/dashboard" : "/login"} className="flex flex-col items-center gap-1 text-muted-foreground hover:text-primary">
          <UserIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">Account</span>
        </Link>
      </nav>
    </div>
  );
}
