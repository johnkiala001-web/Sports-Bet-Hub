import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useEffect } from "react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function AdminLogin() {
  const [_, setLocation] = useLocation();
  const { login, isAuthenticated, user, isLoading } = useAuth();
  const { toast } = useToast();
  const loginMutation = useAdminLogin();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === 'admin') {
      setLocation("/admin/dashboard");
    } else if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      // If user is logged in but not admin, they shouldn't be here
      setLocation("/");
    }
  }, [isAuthenticated, isLoading, user, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({ data: values }, {
      onSuccess: (res) => {
        login(res.token);
        toast({ title: "Admin Login Successful" });
        setLocation("/admin/dashboard");
      },
      onError: (err: any) => {
        toast({
          title: "Admin Login failed",
          description: err.message || "Invalid admin credentials",
          variant: "destructive"
        });
      }
    });
  }

  if (isLoading || isAuthenticated) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md bg-card border border-destructive/30 rounded-2xl p-8 shadow-[0_0_40px_rgba(220,38,38,0.15)] animate-in fade-in duration-300">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-destructive/10 rounded-full mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <h1 className="text-2xl font-black text-foreground tracking-tight mb-2">RESTRICTED ACCESS</h1>
          <p className="text-muted-foreground text-sm uppercase tracking-widest font-bold">Admin Portal</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Admin Email</FormLabel>
                  <FormControl>
                    <Input placeholder="admin@kialabet.com" className="h-12 bg-secondary/50 border-border" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" className="h-12 bg-secondary/50 border-border" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" variant="destructive" className="w-full h-12 text-lg font-bold" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Authenticating..." : "Authorize Access"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}