import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { BetSlipProvider } from "@/contexts/BetSlipContext";

// Layouts
import { MainLayout } from "@/components/layout/MainLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { BetSlip } from "@/components/shared/BetSlip";

// Public / User Pages
import Home from "@/pages/Home";
import Sports from "@/pages/Sports";
import Live from "@/pages/Live";
import MatchDetail from "@/pages/MatchDetail";
import Jackpot from "@/pages/Jackpot";
import Casino from "@/pages/Casino";
import Aviator from "@/pages/Aviator";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import Dashboard from "@/pages/Dashboard";
import Wallet from "@/pages/Wallet";
import Bets from "@/pages/Bets";
import Profile from "@/pages/Profile";
import Notifications from "@/pages/Notifications";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminLogin from "@/pages/admin/AdminLogin";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminMatches from "@/pages/admin/AdminMatches";
import AdminJackpots from "@/pages/admin/AdminJackpots";

const queryClient = new QueryClient();

function PublicRoutes() {
  return (
    <MainLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/sports" component={Sports} />
        <Route path="/sports/:sport" component={Sports} />
        <Route path="/live" component={Live} />
        <Route path="/match/:matchId" component={MatchDetail} />
        <Route path="/jackpot" component={Jackpot} />
        <Route path="/casino" component={Casino} />
        <Route path="/aviator" component={Aviator} />
        <Route path="/login" component={Login} />
        <Route path="/register" component={Register} />
        <Route path="/forgot-password" component={ForgotPassword} />
        
        {/* Protected User Routes (Handled inside components) */}
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/wallet" component={Wallet} />
        <Route path="/bets" component={Bets} />
        <Route path="/profile" component={Profile} />
        <Route path="/notifications" component={Notifications} />
        
        <Route component={NotFound} />
      </Switch>
      <BetSlip />
    </MainLayout>
  );
}

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin/dashboard" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/matches" component={AdminMatches} />
        <Route path="/admin/jackpots" component={AdminJackpots} />
        <Route component={NotFound} />
      </Switch>
    </AdminLayout>
  );
}

function Router() {
  return (
    <Switch>
      {/* Admin Login has its own layout */}
      <Route path="/admin" component={AdminLogin} />
      
      {/* Admin Protected Routes */}
      <Route path="/admin/*" component={AdminRoutes} />
      
      {/* Public and User Routes */}
      <Route path="*" component={PublicRoutes} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BetSlipProvider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </BetSlipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;