import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { queryKeys } from "@/lib/queryKeys";
import {
  Notification,
  useDeleteNotificationMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "@/hooks/queries/useNotifications";

const SEVERITY_COLOR: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-amber-500",
  critical: "bg-destructive",
  success: "bg-emerald-500",
};

const NotificationsBell = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useNotificationsQuery();
  const items = data ?? [];

  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();
  const deleteMutation = useDeleteNotificationMutation();

  const unread = items.filter(i => !i.is_read).length;

  useEffect(() => {
    const ch = supabase
      .channel("notifications-bell")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload: any) => {
        queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(), (prev) =>
          [payload.new, ...(prev ?? [])].slice(0, 30)
        );
        toast.info(payload.new.title, { description: payload.new.body });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const markRead = (id: string) => {
    markReadMutation.mutate(id);
  };

  const markAllRead = () => {
    const ids = items.filter(i => !i.is_read).map(i => i.id);
    if (!ids.length) return;
    markAllReadMutation.mutate(ids, {
      onSuccess: () => {
        toast.success(lang === "ar" ? "تم تعليم الكل كمقروء" : "All marked as read");
      },
    });
  };

  const remove = (id: string) => {
    deleteMutation.mutate(id);
  };

  const onClickItem = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.link) { navigate(n.link); setOpen(false); }
  };

  const locale = lang === "ar" ? arLocale : enUS;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-primary-foreground hover:bg-white/10">
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 text-[10px] bg-destructive text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">
            {lang === "ar" ? "الإشعارات" : "Notifications"}
            {unread > 0 && <span className="text-muted-foreground font-normal text-xs ms-2">({unread})</span>}
          </div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 text-xs gap-1">
              <CheckCheck className="w-3.5 h-3.5" />
              {lang === "ar" ? "تعليم الكل" : "Mark all"}
            </Button>
          )}
        </div>
        <ScrollArea className="h-[420px]">
          {items.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              {lang === "ar" ? "لا توجد إشعارات" : "No notifications"}
            </div>
          ) : (
            <ul className="divide-y">
              {items.map(n => (
                <li key={n.id} className={cn("p-3 hover:bg-muted/50 cursor-pointer group", !n.is_read && "bg-primary/5")}>
                  <div className="flex gap-2" onClick={() => onClickItem(n)}>
                    <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", SEVERITY_COLOR[n.severity] || "bg-muted")} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale })}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
                      {!n.is_read && (
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                          <Check className="w-3 h-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={(e) => { e.stopPropagation(); remove(n.id); }}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsBell;
