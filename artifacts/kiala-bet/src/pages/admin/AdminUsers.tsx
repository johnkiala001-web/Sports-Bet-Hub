import { useState } from "react";
import { useListAdminUsers, useSuspendUser, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Ban, CheckCircle } from "lucide-react";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Simple debounce
  useState(() => {
    const handler = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(handler);
  });

  const { data: users, isLoading } = useListAdminUsers({ search: debouncedSearch, limit: 50 });
  const suspendMutation = useSuspendUser();

  const handleToggleSuspend = (id: number, currentSuspended: boolean) => {
    suspendMutation.mutate(
      { userId: id, data: { suspended: !currentSuspended } },
      {
        onSuccess: () => {
          toast({ title: `User ${!currentSuspended ? 'suspended' : 'activated'} successfully` });
          queryClient.invalidateQueries({ queryKey: getListAdminUsersQueryKey() });
        },
        onError: () => {
          toast({ title: "Action failed", variant: "destructive" });
        }
      }
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search username or email..." 
            className="pl-9 bg-card border-border"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-card border-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : !users || users.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              No users found matching your criteria.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead>ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-border hover:bg-secondary/50">
                    <TableCell className="font-mono text-xs">{user.id}</TableCell>
                    <TableCell className="font-bold">{user.username}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${user.role === 'admin' ? 'bg-primary/20 text-primary' : 'bg-secondary text-secondary-foreground'}`}>
                        {user.role}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${user.isSuspended ? 'bg-destructive/20 text-destructive' : 'bg-primary/20 text-primary'}`}>
                        {user.isSuspended ? 'Suspended' : 'Active'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {user.role !== 'admin' && (
                        <Button 
                          variant={user.isSuspended ? "outline" : "destructive"} 
                          size="sm"
                          onClick={() => handleToggleSuspend(user.id, user.isSuspended)}
                          disabled={suspendMutation.isPending}
                          className="h-8"
                        >
                          {user.isSuspended ? <><CheckCircle className="h-4 w-4 mr-2" /> Activate</> : <><Ban className="h-4 w-4 mr-2" /> Suspend</>}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}