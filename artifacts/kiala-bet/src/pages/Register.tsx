import { useState } from "react";
import { Link } from "wouter";
import { useRegisterUser } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Register() {
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegisterUser();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(true);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast({ title: "Enter your phone number", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (!agreed) {
      toast({ title: "Please accept the Terms & Conditions to continue", variant: "destructive" });
      return;
    }

    registerMutation.mutate(
      { data: { phone: phone.trim(), password } },
      {
        onSuccess: (res) => {
          login(res.token);
          toast({ title: "Welcome to KialaBet! 🎉", description: "KES 500 demo balance added." });
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error || err?.message || "Registration failed";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="flex flex-col animate-in fade-in duration-300 pb-4">
      {/* Logo */}
      <div className="pt-6 pb-8">
        <h1 className="text-3xl font-black tracking-tight">
          <span className="text-primary">Kiala</span>
          <span className="text-white">Bet</span>
          <span className="text-primary">!</span>
        </h1>
      </div>

      <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
        Enter your phone number and password below to Login to your existing account. Otherwise click on Register with the same details to create a new account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Phone */}
        <div className="space-y-1">
          <label className="font-bold text-sm">Phone Number</label>
          <Input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. 0712 234567"
            className="h-12 bg-secondary/60 border-border text-base"
          />
          <p className="text-xs text-muted-foreground">Enter your phone number</p>
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="font-bold text-sm">Password</label>
          <div className="relative">
            <Input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-12 bg-secondary/60 border-border text-base pr-12"
            />
            <button type="button" onClick={() => setShowPass(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Enter your password</p>
        </div>

        {/* Confirm Password */}
        <div className="space-y-1">
          <label className="font-bold text-sm">Confirm Password</label>
          <div className="relative">
            <Input
              type={showConfirm ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••"
              className="h-12 bg-secondary/60 border-border text-base pr-12"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Confirm your password</p>
        </div>

        {/* T&C */}
        <div className="flex items-start gap-3 cursor-pointer" onClick={() => setAgreed(v => !v)}>
          <div className={cn(
            "w-5 h-5 rounded flex items-center justify-center border-2 shrink-0 mt-0.5 transition-colors",
            agreed ? "bg-primary border-primary" : "border-muted-foreground"
          )}>
            {agreed && <span className="text-white text-xs font-black">✓</span>}
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By clicking Register you confirm to have read in detail, understood and agreed to the{" "}
            <span className="text-primary">Terms and Conditions</span>, the{" "}
            <span className="text-primary">Privacy policy</span>{" "}
            and also that you are over 18 years of age.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full h-12 text-base font-bold bg-primary hover:bg-primary/90"
          disabled={registerMutation.isPending}
        >
          {registerMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Register"}
        </Button>
      </form>

      <div className="mt-6 text-center space-y-3">
        <p className="text-sm font-bold text-muted-foreground">Already have a registration code?</p>
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground font-bold hover:underline">
            Login here
          </Link>
        </p>
      </div>
    </div>
  );
}
