import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Home, Trophy, LayoutDashboard, MessageCircle, Settings, Rss } from "lucide-react";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/social", label: "Social", icon: Rss },
  { href: "/rank-progression", label: "Ranks", icon: Trophy },
  { href: "/dashboard", label: "Stats", icon: LayoutDashboard },
  { href: "/settings", label: "More", icon: Settings },
];

export function MobileBottomNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { phoneMode } = useTheme();

  const { data: unreadMsg } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 15000,
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery<Array<{ type: string; read: boolean }>>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30000,
    enabled: !!user,
  });
  const socialUnread = notifications.filter(
    n => !n.read && (n.type === "social_reply" || n.type === "social_reaction")
  ).length;
  const combinedSocialUnread = socialUnread + (unreadMsg?.count ?? 0);

  if (phoneMode || !user) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#010208]/95 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      data-testid="mobile-bottom-nav"
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? location === "/" : location.startsWith(href);
          const hasUnread = href === "/social" && combinedSocialUnread > 0;

          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-col items-center justify-center py-2 gap-0.5 min-h-[56px] transition-colors no-underline ${
                isActive ? "text-primary" : "text-white/50"
              }`}
              data-testid={`mobile-tab-${label.toLowerCase()}`}
            >
              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] ${
                    isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary))]" : ""
                  }`}
                />
                {hasUnread && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? "text-primary" : ""}`}>
                {label}
              </span>
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
