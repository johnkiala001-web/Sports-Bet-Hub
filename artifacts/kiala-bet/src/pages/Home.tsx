import { useListMatches, getListMatchesQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/shared/MatchCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Trophy, Gift, Activity, Gamepad2, CalendarOff } from "lucide-react";

export default function Home() {
  const { data: upcomingMatches, isLoading } = useListMatches(
    { sport: "football", status: "upcoming", limit: 12 },
    { query: { refetchInterval: 60_000, queryKey: getListMatchesQueryKey({ sport: "football", status: "upcoming", limit: 12 }) } }
  );

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-4">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/30 to-card border border-primary/20 p-6 md:p-14">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
        <div className="relative z-10 max-w-2xl">
          <h1 className="text-3xl md:text-6xl font-black tracking-tighter mb-3 text-white uppercase drop-shadow-lg">
            Bet Smarter, <br/><span className="text-primary">Win Bigger.</span>
          </h1>
          <p className="text-base md:text-xl text-white/80 mb-6 font-medium max-w-xl">
            The most electrifying sports betting experience in Africa. Best odds, instant payouts.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" className="font-bold text-base h-12 px-6 shadow-[0_0_20px_rgba(0,200,83,0.4)]" asChild>
              <Link href="/register">Join Now</Link>
            </Button>
            <Button size="lg" variant="secondary" className="font-bold text-base h-12 px-6 border border-border" asChild>
              <Link href="/sports">View Odds</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Today's Upcoming Matches */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
            <Activity className="text-primary h-5 w-5" /> Today's Games
          </h2>
          <Button variant="ghost" asChild className="font-bold text-sm">
            <Link href="/sports">See All</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-44 bg-card border-border rounded-xl" />
            ))}
          </div>
        ) : upcomingMatches && upcomingMatches.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcomingMatches.slice(0, 6).map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card rounded-xl border border-border">
            <CalendarOff className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-lg font-bold text-foreground mb-1">No Upcoming Matches</p>
            <p className="text-sm">Check the Live tab for games in progress.</p>
          </div>
        )}
      </section>

      {/* Special Offers */}
      <section>
        <h2 className="text-xl font-black tracking-tight mb-4 flex items-center gap-2 uppercase">
          <Gift className="text-primary h-5 w-5" /> Special Offers
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="bg-gradient-to-br from-purple-900/40 to-card border-purple-500/30 overflow-hidden relative group cursor-pointer">
            <div className="absolute inset-0 bg-purple-500/10 group-hover:bg-purple-500/20 transition-colors"></div>
            <CardContent className="p-5 relative z-10">
              <h3 className="text-lg font-black text-purple-400 uppercase tracking-wide mb-1">100% Welcome Bonus</h3>
              <p className="text-sm text-muted-foreground mb-3 font-medium">Double your first deposit up to KES 10,000.</p>
              <span className="text-xs font-bold bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">New Users</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/20 to-card border-primary/30 overflow-hidden relative group cursor-pointer">
            <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors"></div>
            <CardContent className="p-5 relative z-10">
              <h3 className="text-lg font-black text-primary uppercase tracking-wide mb-1">Acca Boost 500%</h3>
              <p className="text-sm text-muted-foreground mb-3 font-medium">Boost your accumulator winnings exponentially.</p>
              <span className="text-xs font-bold bg-primary/20 text-primary px-3 py-1 rounded-full">Sports</span>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-blue-900/40 to-card border-blue-500/30 overflow-hidden relative group cursor-pointer hidden md:block">
            <div className="absolute inset-0 bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors"></div>
            <CardContent className="p-5 relative z-10">
              <h3 className="text-lg font-black text-blue-400 uppercase tracking-wide mb-1">Cashback Weekly</h3>
              <p className="text-sm text-muted-foreground mb-3 font-medium">Get 10% back on your net losses every Monday.</p>
              <span className="text-xs font-bold bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">All Users</span>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Jackpot Teaser */}
      <section className="bg-gradient-to-br from-[#1a1a24] to-background border border-primary/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
        <div className="absolute -right-20 -top-20 opacity-10">
          <Trophy className="w-96 h-96" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-300 mb-1">Mega Jackpot</h2>
            <p className="text-base text-muted-foreground font-medium mb-3">Predict 15 matches. Change your life.</p>
            <div className="text-3xl md:text-5xl font-black tracking-tighter">KES 1,000,000</div>
          </div>
          <Button size="lg" className="h-14 px-8 text-lg font-black w-full md:w-auto shadow-[0_0_30px_rgba(0,200,83,0.3)]" asChild>
            <Link href="/jackpot">Play Jackpot</Link>
          </Button>
        </div>
      </section>

      {/* Casino */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
            <Gamepad2 className="text-primary h-5 w-5" /> Casino & Virtuals
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="bg-[#1a1a24] border-border overflow-hidden group cursor-pointer" onClick={() => window.location.href = '/casino'}>
            <div className="h-32 bg-[url('https://images.unsplash.com/photo-1518133835878-5a93cc3f89e5?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center relative">
              <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-3xl font-black uppercase tracking-widest text-white/90 drop-shadow-2xl italic">Crash</h3>
              </div>
            </div>
          </Card>
          <Card className="bg-[#1a1a24] border-border overflow-hidden group cursor-pointer" onClick={() => window.location.href = '/casino'}>
            <div className="h-32 bg-[url('https://images.unsplash.com/photo-1606167668584-78701c57f13d?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center relative">
              <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <h3 className="text-3xl font-black uppercase tracking-widest text-white/90 drop-shadow-2xl italic">Virtual Slots</h3>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
