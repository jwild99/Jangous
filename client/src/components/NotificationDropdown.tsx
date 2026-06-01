import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Trophy, MessageCircle, TrendingUp, DollarSign, Sword, User, Info, Check, ExternalLink, Users, ShoppingBag, AlertTriangle, Shield, VolumeX, LogOut, Wifi, RefreshCw, Star } from "lucide-react";
import { useLocation } from "wouter";

type NotificationType =
  | "challenge" | "message" | "rank_up" | "deposit" | "achievement" | "friend_online" | "system"
  | "clan_invite" | "clan_join_accepted" | "clan_join_denied"
  | "clan_challenge_received" | "clan_challenge_accepted" | "clan_challenge_declined"
  | "clan_challenge_won" | "clan_challenge_lost"
  | "reconnect_reminder" | "opponent_forfeited" | "you_forfeited"
  | "item_purchased" | "cosmetic_equipped" | "weekly_shop_refresh"
  | "moderation_warning" | "moderation_ban" | "moderation_mute" | "moderation_restrict"
  | "social_reply" | "social_reaction";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  linkTo?: string;
}

const TYPE_ICONS: Record<NotificationType, typeof Bell> = {
  challenge: Sword,
  message: MessageCircle,
  rank_up: TrendingUp,
  deposit: DollarSign,
  achievement: Trophy,
  friend_online: User,
  system: Info,
  clan_invite: Users,
  clan_join_accepted: Users,
  clan_join_denied: Users,
  clan_challenge_received: Sword,
  clan_challenge_accepted: Sword,
  clan_challenge_declined: Sword,
  clan_challenge_won: Trophy,
  clan_challenge_lost: Sword,
  reconnect_reminder: Wifi,
  opponent_forfeited: LogOut,
  you_forfeited: LogOut,
  item_purchased: ShoppingBag,
  cosmetic_equipped: Star,
  weekly_shop_refresh: RefreshCw,
  moderation_warning: AlertTriangle,
  moderation_ban: Shield,
  moderation_mute: VolumeX,
  moderation_restrict: Shield,
  social_reply: MessageCircle,
  social_reaction: Star,
};

const TYPE_COLORS: Record<NotificationType, string> = {
  challenge: "text-orange-400",
  message: "text-blue-400",
  rank_up: "text-purple-400",
  deposit: "text-green-400",
  achievement: "text-yellow-400",
  friend_online: "text-cyan-400",
  system: "text-white/50",
  clan_invite: "text-indigo-400",
  clan_join_accepted: "text-green-400",
  clan_join_denied: "text-red-400",
  clan_challenge_received: "text-orange-400",
  clan_challenge_accepted: "text-green-400",
  clan_challenge_declined: "text-red-400",
  clan_challenge_won: "text-yellow-400",
  clan_challenge_lost: "text-red-400",
  reconnect_reminder: "text-cyan-400",
  opponent_forfeited: "text-green-400",
  you_forfeited: "text-red-400",
  item_purchased: "text-pink-400",
  cosmetic_equipped: "text-purple-400",
  weekly_shop_refresh: "text-blue-400",
  moderation_warning: "text-yellow-400",
  moderation_ban: "text-red-400",
  moderation_mute: "text-orange-400",
  moderation_restrict: "text-red-400",
  social_reply: "text-blue-400",
  social_reaction: "text-pink-400",
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationDropdown() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();

  // Seed welcome notifications on first mount
  useEffect(() => {
    if (user) {
      apiRequest("POST", "/api/notifications/welcome", {}).catch(() => {});
    }
  }, [user?.id]);

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
    enabled: !!user,
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/notifications/read-all", {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const readOneMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/notifications/read/${id}`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/notifications"] }),
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!user) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-white/10 bg-white/5 hover-elevate active-elevate-2 transition-all"
          data-testid="button-notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4 text-white/60" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key="badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[9px] font-bold text-white flex items-center justify-center"
                data-testid="badge-notification-count"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0 border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(160deg,#0d1225 0%,#080c1a 100%)" }}
        data-testid="dropdown-notifications"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/50" />
            <span className="text-sm font-semibold text-white">Notifications</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[11px] text-white/40 h-auto px-2 py-1"
              onClick={() => readAllMutation.mutate()}
              data-testid="button-mark-all-read"
            >
              <Check className="w-3 h-3 mr-1" />Mark all read
            </Button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="w-8 h-8 text-white/15 mx-auto mb-2" />
              <p className="text-sm text-white/30">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n, i) => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              const color = TYPE_COLORS[n.type] ?? "text-white/50";
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => {
                    if (!n.read) readOneMutation.mutate(n.id);
                    if (n.linkTo) { setLocation(n.linkTo); setOpen(false); }
                  }}
                  className={`flex gap-3 px-4 py-3 border-b border-white/5 last:border-0 cursor-pointer transition-colors ${
                    n.read ? "opacity-50" : "hover:bg-white/5"
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className={`mt-0.5 shrink-0 ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-white leading-tight">{n.title}</p>
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{n.body}</p>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-white/25">{timeAgo(n.createdAt)}</p>
                      {n.linkTo && <ExternalLink className="w-3 h-3 text-white/25" />}
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
