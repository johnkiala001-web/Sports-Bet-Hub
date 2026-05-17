import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation, Link } from "wouter";
import { LayoutDashboard, Users, Trophy, DollarSign, LogOut } from "lucide-react";

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        setLocation("/admin");
      } else if (user?.role !== "admin") {
        setLocation("/");
      }
    }
  }, [isAuthenticated, isLoading, user, setLocation]);

  if (isLoading || !isAuthenticated || user?.role !== "admin") {
    return <div className="min-h-screen bg-background flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border md:min-h-screen flex flex-col">
        <div className="p-6 border-b border-border">
          <h1 className="text-2xl font-black text-primary tracking-tighter">KIALA ADMIN</h1>
          <p className="text-xs text-muted-foreground mt-1">Control Panel</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
            <LayoutDashboard className="h-5 w-5" /> Dashboard
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
            <Users className="h-5 w-5" /> Users
          </Link>
          <Link href="/admin/matches" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
            <Trophy className="h-5 w-5" /> Matches
          </Link>
          <Link href="/admin/jackpots" className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium hover:bg-secondary transition-colors">
            <DollarSign className="h-5 w-5" /> Jackpots
          </Link>
        </nav>

        <div className="p-4 border-t border-border mt-auto">
          <button 
            onClick={() => {
              logout();
              setLocation("/admin");
            }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-bold text-destructive w-full hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
