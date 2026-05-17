import { useEffect } from "react";
import { useListNotifications, useMarkNotificationRead, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Notifications() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, authLoading, setLocation]);

  const { data: notifications, isLoading } = useListNotifications({
    query: { enabled: isAuthenticated, queryKey: getListNotificationsQueryKey() }
  });

  const markReadMutation = useMarkNotificationRead();

  const handleMarkRead = (id: number) => {
    markReadMutation.mutate({ notificationId: id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
      }
    });
  };

  if (authLoading || !isAuthenticated) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Bell className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl bg-card" />)}
        </div>
      ) : notifications?.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border text-muted-foreground">
          <Bell className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p className="font-bold text-lg">All caught up!</p>
          <p className="text-sm">You have no new notifications.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications?.map(notif => (
            <Card key={notif.id} className={`bg-card border-border transition-colors ${!notif.isRead ? 'border-primary/50 bg-primary/5' : ''}`}>
              <CardContent className="p-4 flex gap-4 items-start">
                <div className={`p-2 rounded-full mt-1 ${!notif.isRead ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>
                  <Bell className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <h3 className={`font-bold ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {notif.title}
                    </h3>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className={`text-sm mt-1 ${!notif.isRead ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {notif.message}
                  </p>
                  
                  {!notif.isRead && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="mt-3 text-xs text-primary hover:text-primary hover:bg-primary/10 h-8 px-3"
                      onClick={() => handleMarkRead(notif.id)}
                      disabled={markReadMutation.isPending}
                    >
                      <CheckCircle className="h-3 w-3 mr-2" /> Mark as read
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}