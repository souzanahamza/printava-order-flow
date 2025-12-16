import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { useOrderStatuses } from "@/hooks/useOrderStatuses";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import { Clock, User } from "lucide-react";

interface OrderTimelineProps {
  orderId: string;
}

interface StatusHistoryEntry {
  id: string;
  previous_status: string | null;
  new_status: string;
  created_at: string;
  changed_by: string | null;
  changer_name: string | null;
  changer_role: string | null;
  action_details: string | null;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} day${days > 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return "< 1m";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function OrderTimeline({ orderId }: OrderTimelineProps) {
  const { data: statuses } = useOrderStatuses();

  const { data: history, isLoading } = useQuery({
    queryKey: ["order-status-history", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_status_history")
        .select("id, previous_status, new_status, created_at, changed_by, action_details")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch changer profiles and roles
      const changerIds = [...new Set(data?.map((h) => h.changed_by).filter(Boolean))];
      let profileMap = new Map<string, string>();
      let roleMap = new Map<string, string>();
      
      if (changerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", changerIds);
        const { data: userRoles } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", changerIds);
        profileMap = new Map(profiles?.map((p) => [p.id, p.full_name || "Unknown"]) || []);
        roleMap = new Map(userRoles?.map((r) => [r.user_id, r.role]) || []);
      }

      return data.map((entry) => ({
        ...entry,
        changer_name: entry.changed_by ? profileMap.get(entry.changed_by) || null : null,
        changer_role: entry.changed_by ? roleMap.get(entry.changed_by) || null : null,
        action_details: entry.action_details || null,
      })) as StatusHistoryEntry[];
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!history || history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No status history available for this order.
      </div>
    );
  }

  // Calculate durations
  const entriesWithDuration = history.map((entry, index) => {
    const currentTime = new Date(entry.created_at).getTime();
    const nextTime =
      index < history.length - 1
        ? new Date(history[index + 1].created_at).getTime()
        : Date.now();
    const durationMs = nextTime - currentTime;
    return { ...entry, durationMs };
  });

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {entriesWithDuration.map((entry, index) => {
          const isLatest = index === entriesWithDuration.length - 1;
          const statusColor = statuses?.find((s) => s.name === entry.new_status)?.color;

          return (
            <div key={entry.id} className="relative flex gap-4 pl-2">
              {/* Timeline dot */}
              <div
                className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                  isLatest
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/30 bg-background"
                }`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    isLatest ? "bg-primary-foreground" : "bg-muted-foreground/50"
                  }`}
                />
              </div>

              {/* Content */}
              <div className="flex-1 pb-2">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <StatusBadge status={entry.new_status} color={statusColor} />
                  {isLatest && (
                    <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(entry.created_at), "PPp")}
                  </span>

                  {entry.changer_name && (
                    <span className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(entry.changer_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{entry.changer_name}</span>
                      {entry.changer_role && (
                        <span className="text-xs text-muted-foreground/70 capitalize">
                          ({entry.changer_role})
                        </span>
                      )}
                    </span>
                  )}
                </div>

                {/* Action Details */}
                {entry.action_details && (
                  <p className="text-xs text-muted-foreground italic mt-1.5">
                    {entry.action_details}
                  </p>
                )}

                {/* Duration badge */}
                <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                  <span>⏱️</span>
                  <span>
                    {isLatest ? "In this status for " : "Duration: "}
                    {formatDuration(entry.durationMs)}
                  </span>
                </div>

                {entry.previous_status && (
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    Changed from "{entry.previous_status}"
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
