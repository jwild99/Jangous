import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useTheme } from "@/contexts/ThemeContext";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import {
  Trophy, Wallet, LogOut, BarChart3, Swords,
  Settings, Shield, UserPlus, TrendingUp, Plus, Menu,
  ChevronRight, ChevronDown, Home, ShoppingBag, Users, Rss, Flame, Eye, EyeOff,
  Sparkles, Crown, GraduationCap,
} from "lucide-react";
import { useStreamerMode } from "@/contexts/StreamerContext";
import { JangoLogo } from "@/components/JangoLogo";
import { AnimatedBalance } from "@/components/AnimatedBalance";
import { FriendsListModal } from "@/components/FriendsListModal";
import { ChallengeInviteModal } from "@/components/ChallengeInviteModal";
import TransactionHistoryModal from "@/components/TransactionHistoryModal";
import { DepositFlowContent } from "@/components/DepositFlowContent";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { PrivateMatchModal } from "@/components/PrivateMatchModal";
import type { User } from "@shared/schema";

const NAV_HEIGHT = 64; // px — single source of truth

export function AppNavbar() {
  const { user } = useAuth();
  const { phoneMode } = useTheme();
  const { streamerMode, toggleStreamerMode } = useStreamerMode();
  const [location, setLocation] = useLocation();

  const [depositSheetOpen, setDepositSheetOpen] = useState(false);
  const [transactionHistoryOpen, setTransactionHistoryOpen] = useState(false);
  const [friendsModalOpen, setFriendsModalOpen] = useState(false);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [friendToChallenge, setFriendToChallenge] = useState<User | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [privateMatchOpen, setPrivateMatchOpen] = useState(false);

  const { data: balanceData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
    enabled: !!user,
  });

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 10000,
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
  const combinedSocialUnread = socialUnread + (unreadData?.count ?? 0);

  if (phoneMode) return null;

  const mobileNavLinks = [
    { href: "/", label: "Home", icon: Home },
    { href: "/social", label: "Social", icon: Rss, badge: combinedSocialUnread },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/clans", label: "Clans", icon: Users },
    { href: "/battle-pass", label: "Battle Pass", icon: Flame },
    { href: "/tournaments", label: "Tournaments", icon: Swords },
    { href: "/shop", label: "Shop", icon: ShoppingBag },
    { href: "/wallet", label: "Wallet", icon: Wallet },
    { href: "/global-stats", label: "Stats", icon: TrendingUp },
    { href: "/rank-progression", label: "Rank Track", icon: Crown },
    { href: "/tutorial", label: "Training", icon: GraduationCap },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  ];

  return (
    <>
      {/*
        The header uses safe-area-inset-top for iOS notch support.
        Content height is always NAV_HEIGHT (64px); the safe-area adds
        extra space above that — this keeps items inside perfectly centred.
      */}
      <header
        className="sticky top-0 z-50 glass-nav"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          boxSizing: "border-box",
        }}
        data-testid="app-navbar"
      >
        {/*
          ── Three-section inner container ──────────────────────────────
          grid-cols-[auto_1fr_auto] keeps Left and Right at their natural
          width while the Center column takes remaining space and centres
          its content with justify-center.
        */}
        <div
          className="grid grid-cols-[auto_1fr_auto] items-center w-full max-w-7xl mx-auto px-4 md:px-6"
          style={{ height: NAV_HEIGHT }}
        >

          {/* ── LEFT: Logo ─────────────────────────────────────────── */}
          <div className="flex items-center">
            <Link href="/">
              <div
                className="flex items-center cursor-pointer hover-elevate active-elevate-2 rounded-md px-2 py-1 shrink-0"
                data-testid="link-home"
              >
                <JangoLogo size="md" />
              </div>
            </Link>
          </div>

          {/* ── CENTER: Desktop nav links ───────────────────────────── */}
          <nav className="hidden md:flex items-center justify-center gap-0.5">
            <Link href="/">
              <Button variant="ghost" size="sm" data-testid="button-play">Play</Button>
            </Link>

            {/* Compete dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" data-testid="button-compete" className="gap-1">
                  <Trophy className="w-4 h-4" />Compete<ChevronDown className="w-3 h-3 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center" className="w-44 glass-override" data-testid="dropdown-compete">
                <DropdownMenuItem onSelect={() => setLocation("/leaderboard")} className="cursor-pointer gap-2" data-testid="compete-leaderboard">
                  <Trophy className="w-4 h-4 text-yellow-400" />Leaderboard
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/tournaments")} className="cursor-pointer gap-2" data-testid="compete-tournaments">
                  <Swords className="w-4 h-4 text-red-400" />Tournaments
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/clans")} className="cursor-pointer gap-2" data-testid="compete-clans">
                  <Users className="w-4 h-4 text-blue-400" />Clans
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/battle-pass")} className="cursor-pointer gap-2" data-testid="compete-battle-pass">
                  <Flame className="w-4 h-4 text-orange-400" />Battle Pass
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/arena-origins")} className="cursor-pointer gap-2" data-testid="compete-arena-origins">
                  <Sparkles className="w-4 h-4 text-fuchsia-400" />Arena Origins
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/rank-progression")} className="cursor-pointer gap-2" data-testid="compete-rank-track">
                  <Crown className="w-4 h-4 text-amber-300" />Rank Track
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLocation("/tutorial")} className="cursor-pointer gap-2" data-testid="compete-training">
                  <GraduationCap className="w-4 h-4 text-emerald-400" />Training
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link href="/social">
              <Button variant="ghost" size="sm" data-testid="button-social" className="relative">
                <Rss className="w-4 h-4 mr-1.5" />Social
                {combinedSocialUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                    {combinedSocialUnread > 9 ? "9+" : combinedSocialUnread}
                  </span>
                )}
              </Button>
            </Link>
            <Link href="/shop">
              <Button variant="ghost" size="sm" data-testid="button-shop">
                <ShoppingBag className="w-4 h-4 mr-1.5" />Shop
              </Button>
            </Link>
            {user?.isAdmin && (
              <Link href="/admin">
                <Button variant="ghost" size="sm" data-testid="button-admin">
                  <Shield className="w-4 h-4 mr-1.5" />Admin
                </Button>
              </Link>
            )}
          </nav>

          {/* ── RIGHT: User controls ────────────────────────────────── */}
          {/*
            Every element here uses h-9 (36px) explicitly so they all
            share the same vertical baseline — notification bell, balance
            pill, avatar, and hamburger are all the same height.
          */}
          <div className="flex items-center justify-end gap-2">

            {/* Notifications bell */}
            {user && <NotificationDropdown />}

            {/* Balance pill */}
            {user && (
              <button
                onClick={() => setDepositSheetOpen(true)}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md bg-primary/10 border border-primary/20 hover-elevate active-elevate-2 cursor-pointer"
                style={{ boxSizing: "border-box" }}
                data-testid="button-balance"
              >
                <AnimatedBalance
                  value={parseFloat(balanceData?.balance || "0")}
                  className="text-sm font-semibold text-primary leading-none"
                  showGlow={false}
                  useScalps={true}
                />
                <Plus className="w-3.5 h-3.5 text-primary opacity-60 shrink-0" />
              </button>
            )}

            {/* Avatar dropdown — desktop only */}
            {user && (
              <div className="hidden md:flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center justify-center w-9 h-9 rounded-full hover-elevate active-elevate-2 focus:outline-none"
                      style={{ boxSizing: "border-box" }}
                      data-testid="button-profile-menu"
                    >
                      <Avatar className="w-8 h-8" data-testid="avatar-user">
                        <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                        <AvatarFallback className="text-xs font-bold">
                          {user.firstName?.[0] || user.email?.[0] || "U"}
                        </AvatarFallback>
                      </Avatar>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 glass-override" data-testid="dropdown-profile-menu">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.firstName || "User"}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setFriendsModalOpen(true)} className="cursor-pointer" data-testid="menu-item-friends">
                      <UserPlus className="w-4 h-4 mr-2" />Friends
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setPrivateMatchOpen(true)} className="cursor-pointer" data-testid="menu-item-private-match">
                      <Swords className="w-4 h-4 mr-2" />Private Match
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setLocation("/dashboard")} className="cursor-pointer" data-testid="menu-item-dashboard">
                      <BarChart3 className="w-4 h-4 mr-2" />Dashboard
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/global-stats")} className="cursor-pointer" data-testid="menu-item-global-stats">
                      <TrendingUp className="w-4 h-4 mr-2" />Global Stats
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/clans")} className="cursor-pointer" data-testid="menu-item-clans">
                      <Users className="w-4 h-4 mr-2" />Clans
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/wallet")} className="cursor-pointer" data-testid="menu-item-wallet">
                      <Wallet className="w-4 h-4 mr-2" />Wallet
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setTransactionHistoryOpen(true)} className="cursor-pointer" data-testid="menu-item-transactions">
                      <Wallet className="w-4 h-4 mr-2" />Transaction History
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/battle-pass")} className="cursor-pointer" data-testid="menu-item-battle-pass">
                      <Flame className="w-4 h-4 mr-2" />Battle Pass
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={toggleStreamerMode} className="cursor-pointer" data-testid="menu-item-streamer-mode">
                      {streamerMode ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {streamerMode ? "Disable Streamer Mode" : "Streamer Mode"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => user?.id && setLocation(`/profile/${user.id}`)}
                      className="cursor-pointer"
                      data-testid="menu-item-profile"
                    >
                      <Shield className="w-4 h-4 mr-2" />Profile
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => setLocation("/arena-origins")}
                      className="cursor-pointer group"
                      data-testid="menu-item-arena-origins"
                    >
                      <Crown className="w-4 h-4 mr-2 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)] transition-transform group-hover:scale-110" />
                      Arena Origins
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/rank-progression")} className="cursor-pointer" data-testid="menu-item-rank-track">
                      <Crown className="w-4 h-4 mr-2 text-amber-300" />Rank Track
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/tutorial")} className="cursor-pointer" data-testid="menu-item-tutorial">
                      <GraduationCap className="w-4 h-4 mr-2 text-emerald-400" />Training Arena
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setLocation("/settings")} className="cursor-pointer" data-testid="menu-item-settings">
                      <Settings className="w-4 h-4 mr-2" />Settings
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <a href="/api/logout" className="cursor-pointer text-destructive focus:text-destructive flex items-center" data-testid="menu-item-logout">
                        <LogOut className="w-4 h-4 mr-2" />Sign Out
                      </a>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Sign-in button — logged-out desktop */}
            {!user && (
              <a href="/api/login" className="hidden md:flex">
                <Button size="sm" data-testid="button-sign-in-nav">Sign In</Button>
              </a>
            )}

            {/* Hamburger — mobile only */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(true)}
              data-testid="button-hamburger"
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>

        </div>
      </header>

      {/* ── Mobile Slide-Out Drawer ─────────────────────────────────────── */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-[280px] p-0 border-white/10 overflow-y-auto"
          style={{ background: "linear-gradient(160deg, #080c1a 0%, #0d1225 60%, #0a0e1a 100%)" }}
          data-testid="sheet-mobile-menu"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>

          {/* User header */}
          {user && (
            <div className="p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                  <AvatarFallback className="text-lg font-bold">
                    {user.firstName?.[0] || user.email?.[0] || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {user.firstName && user.lastName
                      ? `${user.firstName} ${user.lastName}`
                      : user.firstName || "Player"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                </div>
              </div>
              <button
                onClick={() => { setDepositSheetOpen(true); setMobileMenuOpen(false); }}
                className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-md bg-primary/10 border border-primary/20"
                data-testid="button-mobile-balance"
              >
                <span className="text-sm text-muted-foreground">Scalps Balance</span>
                <div className="flex items-center gap-1">
                  <AnimatedBalance
                    value={parseFloat(balanceData?.balance || "0")}
                    className="text-sm font-bold text-primary"
                    showGlow={false}
                    useScalps={true}
                  />
                  <Plus className="w-3.5 h-3.5 text-primary" />
                </div>
              </button>
            </div>
          )}

          {/* Nav links */}
          <div className="py-3">
            {mobileNavLinks.map(({ href, label, icon: Icon, badge }) => {
              const isActive = href === "/" ? location === "/" : location.startsWith(href);
              return (
                <Link key={href} href={href}>
                  <div
                    className={`flex items-center justify-between px-5 py-3.5 cursor-pointer transition-all ${
                      isActive ? "text-primary bg-primary/10" : "text-foreground hover-elevate"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`mobile-nav-${label.toLowerCase().replace(" ", "-")}`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {badge && badge > 0 && (
                        <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-[10px]">
                          {badge > 9 ? "9+" : badge}
                        </Badge>
                      )}
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}

            <div className="border-t border-white/10 mt-2 pt-2">
              <button
                className="flex items-center gap-3 w-full px-5 py-3.5 text-foreground hover-elevate transition-all"
                onClick={() => { setFriendsModalOpen(true); setMobileMenuOpen(false); }}
                data-testid="mobile-nav-friends"
              >
                <UserPlus className="w-5 h-5" />
                <span className="font-medium">Friends</span>
              </button>
              <Link href="/arena-origins">
                <div
                  className="flex items-center gap-3 px-5 py-3.5 text-foreground hover-elevate transition-all cursor-pointer group"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-nav-arena-origins"
                >
                  <Crown className="w-5 h-5 text-amber-300 drop-shadow-[0_0_6px_rgba(251,191,36,0.5)] transition-transform group-hover:scale-110" />
                  <span className="font-medium">Arena Origins</span>
                </div>
              </Link>
              <Link href="/settings">
                <div
                  className="flex items-center gap-3 px-5 py-3.5 text-foreground hover-elevate transition-all cursor-pointer"
                  onClick={() => setMobileMenuOpen(false)}
                  data-testid="mobile-nav-settings"
                >
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Settings</span>
                </div>
              </Link>
              {user?.isAdmin && (
                <Link href="/admin">
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 text-foreground hover-elevate transition-all cursor-pointer"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Shield className="w-5 h-5" />
                    <span className="font-medium">Admin</span>
                  </div>
                </Link>
              )}
            </div>
          </div>

          {/* Logout pinned at bottom */}
          {user && (
            <div
              className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10"
              style={{ background: "rgba(8,12,26,0.95)" }}
            >
              <a
                href="/api/logout"
                className="flex items-center gap-3 w-full px-4 py-3 text-destructive hover-elevate rounded-md transition-all"
                data-testid="mobile-nav-logout"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </a>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Deposit Sheet ───────────────────────────────────────────────── */}
      <Sheet open={depositSheetOpen} onOpenChange={setDepositSheetOpen}>
        <SheetContent
          side="right"
          className="w-full sm:w-[420px] overflow-y-auto border-white/10"
          style={{ background: "linear-gradient(160deg, #080c1a 0%, #0d1225 60%, #0a0e1a 100%)" }}
          data-testid="sheet-deposit"
        >
          <SheetHeader className="mb-2">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Wallet className="w-5 h-5 text-primary" />
              Add Funds
            </SheetTitle>
          </SheetHeader>
          <DepositFlowContent
            onPlayNow={() => { setDepositSheetOpen(false); setLocation("/"); }}
            onClose={() => setDepositSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <TransactionHistoryModal open={transactionHistoryOpen} onOpenChange={setTransactionHistoryOpen} />
      <FriendsListModal
        open={friendsModalOpen}
        onClose={() => setFriendsModalOpen(false)}
        onChallenge={(friend) => {
          setFriendToChallenge(friend);
          setChallengeModalOpen(true);
          setFriendsModalOpen(false);
        }}
      />
      <ChallengeInviteModal
        open={challengeModalOpen}
        onClose={() => { setChallengeModalOpen(false); setFriendToChallenge(null); }}
        friend={friendToChallenge}
      />
      <PrivateMatchModal open={privateMatchOpen} onClose={() => setPrivateMatchOpen(false)} />
    </>
  );
}
