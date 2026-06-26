import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  severity: string;
  is_read: boolean;
  created_at: string;
}

async function fetchNotifications(): Promise<Notification[]> {
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return (data as Notification[]) || [];
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.notifications.list(),
    queryFn: fetchNotifications,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(), (prev) =>
        prev?.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return ids;
      await supabase.from("notifications").update({ is_read: true }).in("id", ids);
      return ids;
    },
    onSuccess: () => {
      queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(), (prev) =>
        prev?.map((n) => ({ ...n, is_read: true }))
      );
    },
  });
}

export function useDeleteNotificationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("notifications").delete().eq("id", id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueryData<Notification[]>(queryKeys.notifications.list(), (prev) =>
        prev?.filter((n) => n.id !== id)
      );
    },
  });
}
