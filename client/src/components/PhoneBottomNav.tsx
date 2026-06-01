import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  Gamepad2, Medal, ShoppingBag, MessagesSquare, SlidersHorizontal, Bell, Rss,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedBalance } from "@/components/AnimatedBalance";

const NAV_ITEMS = [
  { href: "/",           label: "Home",   icon: Gamepad2       },
  { href: "/social",     label: "Social", icon: Rss            },
  { href: "/rank-progression",label: "Ranks",  icon: Medal          },
  { href: "/shop",       label: "Shop",   icon: ShoppingBag, isShop: true },
  { href: "/settings",   label: "More",   icon: SlidersHorizontal },
];

export function PhoneBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();

  const { data: balance } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    refetchInterval: 30000,
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery<Array<{ type: string; read: boolean }>>({
    queryKey: ["/api/notifications"],
    refetchInterval: 15000,
    enabled: !!user,
  });

  const { data: unreadMsg } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 15000,
    enabled: !!user,
  });

  const unreadNotifications = notifications.filter(n => !n.read).length;
  const socialUnread = notifications.filter(
    n => !n.read && (n.type === "social_reply" || n.type === "social_reaction")
  ).length;
  const combinedSocialUnread = socialUnread + (unreadMsg?.count ?? 0);

  if (!user) return null;

  return (
    <div
      className="shrink-0 border-t border-white/10 bg-[#010208]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="phone-bottom-nav"
    >
      {/* Wallet bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Avatar className="w-6 h-6">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-[10px] font-bold">
              {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs text-white/60 truncate max-w-[90px]">
            {user?.firstName || user?.email?.split("@")[0] || "You"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {unreadNotifications > 0 && (
            <Link href="/dashboard">
              <div
                className="relative cursor-pointer"
                data-testid="phone-nav-notifications"
                role="button"
                tabIndex={0}
                aria-label={`Open notifications (${unreadNotifications} unread)`}
              >
                <Bell className="w-4 h-4 text-white/60" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-[8px] font-bold flex items-center justify-center text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              </div>
            </Link>
          )}
          <div className="text-xs font-semibold font-mono text-green-400">
            <AnimatedBalance value={parseFloat(balance?.balance || "0")} />
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-5 px-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon, isShop }) => {
          const isActive = href === "/"
            ? location === "/"
            : location.startsWith(href);
          const hasUnread = href === "/social" && combinedSocialUnread > 0;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center justify-center py-2 gap-0.5 transition-all no-underline ${
                isActive ? "text-primary" : isShop ? "text-violet-400" : "text-white/40"
              }`}
              data-testid={`phone-nav-${label.toLowerCase()}`}
            >
              <div className="relative">
                {isShop ? (
                  <div
                    className={`relative flex items-center justify-center w-8 h-8 rounded-xl transition-all ${
                      isActive
                        ? "bg-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.5)]"
                        : "bg-violet-500/15"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-violet-300 drop-shadow-[0_0_6px_rgba(139,92,246,0.9)]" : "text-violet-400"}`} />
                    {!isActive && (
                      <span
                        className="absolute -top-1 -right-1 w-2 h-2 rounded-full animate-pulse"
                        style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}
                      />
                    )}
                  </div>
                ) : (
                  <Icon className={`w-5 h-5 ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary))]" : ""}`} />
                )}
                {hasUnread && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[9px] font-medium ${isActive ? "text-primary" : isShop ? "text-violet-400" : ""}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
