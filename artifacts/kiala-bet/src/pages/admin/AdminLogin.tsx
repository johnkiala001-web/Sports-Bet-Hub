import React, { useState } from "react";
import { useAdminLogin } from "@workspace/api-client-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { toast } from "../../hooks/use-toast";

export default function AdminLogin() {
  const adminLoginMutation = useAdminLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }

    adminLoginMutation.mutate({
      data: { phone: email, password }
    }, {
      onSuccess: (res: any) => {
        localStorage.setItem("token", res.token);
        window.location.href = "/admin/dashboard";
      },
      onError: () => {
        toast({ title: "Invalid administrator credentials", variant: "destructive" });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-card p-6 rounded-xl border w-full max-w-sm space-y-4">
        <h2 className="text-xl font-black text-center">Admin Access</h2>
        <Input type="text" placeholder="Admin Phone Number" value={email} onChange={e => setEmail(e.target.value)} />
        <Input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <Button type="submit" className="w-full">Sign In</Button>
      </form>
    </div>
  );
}