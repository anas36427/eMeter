import { Bell, Check, Info, AlertTriangle, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface Notification {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
}

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await api.get("/api/notifications/");
        if (res.data && res.data.success) {
          setNotifications(res.data.notifications);
        }
      } catch (err) {
        console.error("Failed to fetch notifications:", err);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000); // Poll every 15 seconds
    return () => clearInterval(interval);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (id: string) => {
    try {
      await api.post("/api/notifications/mark-read/", { notification_id: id });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, read: true } : n)
      );
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post("/api/notifications/mark-read/", {});
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return <Check className="w-4 h-4 text-green-500" />;
      case "warning": return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case "error": return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative group">
          <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary text-[10px] font-bold text-white flex items-center justify-center rounded-full border-2 border-background animate-pulse">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl border-border/50">
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/20">
          <DropdownMenuLabel className="p-0 font-bold text-base">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-[10px] uppercase tracking-wider font-bold hover:text-primary"
              onClick={markAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[350px]">
          <div className="flex flex-col">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <Bell className="w-8 h-8 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
                <p className="text-xs text-muted-foreground/60 mt-1">No new notifications to show.</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div 
                  key={n.id}
                  className={`relative flex items-start gap-3 p-4 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors group ${!n.read ? 'bg-primary/5' : ''}`}
                >
                  <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    n.type === 'success' ? 'bg-green-500/10' : 
                    n.type === 'warning' ? 'bg-amber-500/10' : 
                    n.type === 'error' ? 'bg-red-500/10' : 'bg-blue-500/10'
                  }`}>
                    {getTypeIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0 pr-6" onClick={() => markAsRead(n.id)}>
                    <p className={`text-sm leading-none mb-1 ${!n.read ? 'font-bold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.description}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-2 font-medium uppercase tracking-tight">
                      {n.time}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
        
        <div className="p-2 border-t border-border/50 bg-muted/10">
          <Button variant="ghost" className="w-full text-xs font-semibold h-8 text-muted-foreground hover:text-primary">
            View all activity
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
