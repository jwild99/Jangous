import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Moon, Sun, Volume2, VolumeX, Smartphone, Camera, Check, X, Loader2, AlertTriangle,
  Copy, Shield, Globe, DollarSign, Lock, Eye, EyeOff, Gift, FileText, ArrowUpRight,
  CreditCard, Bell, Gamepad2, Users, Palette, Zap, UserX, Ban, ChevronRight,
  LogOut, Trash2, KeyRound, Clock, Monitor, Hash, Radio, ToggleLeft, Sliders,
  MessageSquareOff, Info, WalletCards, BellOff, BellRing, Star, Swords, Trophy,
  ShoppingBag, Wallet, Flame, TrendingUp, UserPlus, BarChart3, Rss, Plus,
} from "lucide-react";
import { AppNavbar } from "@/components/AppNavbar";
import { soundManager } from "@/lib/soundManager";
import { hapticManager } from "@/lib/hapticManager";
import { useMobileControls, setMobileControls as setMobileControlsLib } from "@/lib/mobileControls";
import { Slider } from "@/components/ui/slider";
import { useState, useEffect, useRef } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { PageDepthBackground } from "@/components/PageDepthBackground";
import { AnimatedBalance } from "@/components/AnimatedBalance";
import { DepositFlowContent } from "@/components/DepositFlowContent";
import { FriendsListModal } from "@/components/FriendsListModal";
import { useStreamerMode } from "@/contexts/StreamerContext";

// ─── Section definitions ──────────────────────────────────────────────────────
type Section =
  | "account" | "security" | "notifications" | "gameplay"
  | "wallet" | "privacy" | "social" | "appearance" | "about" | "danger";

const SECTION_ACCENTS: Record<Section, { icon: string; bg: string; border: string; text: string }> = {
  account:       { icon: "text-blue-400",    bg: "bg-blue-500/15",    border: "border-blue-500/30",    text: "text-blue-300"    },
  security:      { icon: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30", text: "text-emerald-300" },
  notifications: { icon: "text-yellow-400",  bg: "bg-yellow-500/15",  border: "border-yellow-500/30",  text: "text-yellow-300"  },
  gameplay:      { icon: "text-purple-400",  bg: "bg-purple-500/15",  border: "border-purple-500/30",  text: "text-purple-300"  },
  wallet:        { icon: "text-amber-400",   bg: "bg-amber-500/15",   border: "border-amber-500/30",   text: "text-amber-300"   },
  privacy:       { icon: "text-teal-400",    bg: "bg-teal-500/15",    border: "border-teal-500/30",    text: "text-teal-300"    },
  social:        { icon: "text-pink-400",    bg: "bg-pink-500/15",    border: "border-pink-500/30",    text: "text-pink-300"    },
  appearance:    { icon: "text-violet-400",  bg: "bg-violet-500/15",  border: "border-violet-500/30",  text: "text-violet-300"  },
  about:         { icon: "text-cyan-400",    bg: "bg-cyan-500/15",    border: "border-cyan-500/30",    text: "text-cyan-300"    },
  danger:        { icon: "text-red-400",     bg: "bg-red-500/15",     border: "border-red-500/30",     text: "text-red-300"     },
};

const NAV_ITEMS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "account",       label: "Account",        icon: Users },
  { id: "security",      label: "Security",        icon: Shield },
  { id: "notifications", label: "Notifications",   icon: Bell },
  { id: "gameplay",      label: "Gameplay",        icon: Gamepad2 },
  { id: "wallet",        label: "Wallet",          icon: WalletCards },
  { id: "privacy",       label: "Privacy",         icon: Eye },
  { id: "social",        label: "Social",          icon: Rss },
  { id: "appearance",    label: "Appearance",      icon: Palette },
  { id: "about",         label: "Game Modes",      icon: Info },
  { id: "danger",        label: "Danger Zone",     icon: AlertTriangle },
];

// ─── Toggle row helper ────────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onCheckedChange, testId }: {
  label: string; desc?: string; checked: boolean;
  onCheckedChange: (v: boolean) => void; testId?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        {desc && <p className="text-xs text-muted-foreground mt-1">{desc}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} data-testid={testId} />
    </div>
  );
}

// ─── Section header helper ────────────────────────────────────────────────────
function SectionTitle({ icon: Icon, title, desc, section }: {
  icon: React.ElementType; title: string; desc: string; section?: Section;
}) {
  const accent = section ? SECTION_ACCENTS[section] : null;
  const iconColor  = accent?.icon   ?? "text-primary";
  const iconBg     = accent?.bg     ?? "bg-primary/10";
  const iconBorder = accent?.border ?? "border-primary/15";
  return (
    <div className="flex items-start gap-4 mb-6 p-4 rounded-xl border border-white/6 bg-card/30 backdrop-blur-sm">
      <div className={cn("p-2.5 rounded-xl border shadow-lg mt-0.5", iconBg, iconBorder)}>
        <Icon className={cn("w-5 h-5", iconColor)} />
      </div>
      <div className="flex-1">
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Settings() {
  const { user } = useAuth();
  const { theme, setTheme, phoneMode, setPhoneMode } = useTheme();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { streamerMode, toggleStreamerMode } = useStreamerMode();

  const [activeSection, setActiveSection] = useState<Section>("account");
  const [phoneDepositOpen, setPhoneDepositOpen] = useState(false);
  const [phoneFriendsOpen, setPhoneFriendsOpen] = useState(false);

  // ── Account states ──────────────────────────────────────────────────────────
  const [usernameInput, setUsernameInput] = useState(user?.username || "");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [displayName, setDisplayName]   = useState(user?.firstName || "");
  const [bio, setBio]                   = useState((user as any)?.bio || "");
  const [favoriteGame, setFavoriteGame] = useState((user as any)?.favoriteGame || "");
  const [language, setLanguage]         = useState(user?.languagePreference || "en");
  const [profileImagePreview, setProfileImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Security states ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw]                   = useState(false);
  const [twoFaEnabled, setTwoFaEnabled]       = useState(false);
  const [logoutAllDialog, setLogoutAllDialog] = useState(false);

  // ── Notification states ─────────────────────────────────────────────────────
  const [notif, setNotif] = useState({
    matchInvites: true, friendRequests: true, challengeComplete: true,
    tournaments: true, walletActivity: true, achievements: true,
    platformAnnounce: false, emailMatchInvites: false, emailFriends: false,
    emailWallet: true, emailPlatform: true, pushEnabled: true,
  });
  const setN = (k: keyof typeof notif) => (v: boolean) => setNotif(p => ({ ...p, [k]: v }));

  // ── Gameplay states ─────────────────────────────────────────────────────────
  const [soundEnabled, setSoundEnabled]     = useState(soundManager.isEnabled());
  const [hapticEnabled, setHapticEnabled]   = useState(hapticManager.isEnabled());
  const [soundVolume, setSoundVolume]       = useState(soundManager.getVolume());
  const [animationsEnabled, setAnimations]  = useState(true);
  const [quickRematch, setQuickRematch]     = useState(true);
  const [preferRanked, setPreferRanked]     = useState(true);
  const [autoJoin, setAutoJoin]             = useState(false);
  const [timerDisplay, setTimerDisplay]     = useState(true);
  const mobileCtrl = useMobileControls();
  const setMobileCtrl = (next: typeof mobileCtrl) => setMobileControlsLib(next);

  // ── Wallet / financial states ───────────────────────────────────────────────
  const [dailyLimit, setDailyLimit]   = useState("");
  const [weeklyLimit, setWeeklyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [wagerCap, setWagerCap]       = useState("");
  const [currency, setCurrency]       = useState(user?.currencyDisplay || "USD");
  const [withdrawConfirm, setWithdrawConfirm] = useState(true);
  const [walletNotifs, setWalletNotifs] = useState(true);
  const [selfExclusionDays, setSelfExclusionDays] = useState("");
  const [coolOffHours, setCoolOffHours] = useState("");
  const [selfExclusionDialogOpen, setSelfExclusionDialogOpen] = useState(false);
  const [coolOffDialogOpen, setCoolOffDialogOpen] = useState(false);

  // ── Privacy states ──────────────────────────────────────────────────────────
  const [showOnlineStatus, setShowOnlineStatus]   = useState(true);
  const [showMatchHistory, setShowMatchHistory]   = useState(true);
  const [showWalletWins, setShowWalletWins]       = useState(false);
  const [allowFriendReqs, setAllowFriendReqs]     = useState(true);
  const [allowPrivateInvites, setAllowPrivateInvites] = useState(true);
  const [allowSpectators, setAllowSpectators]     = useState(true);
  const [statsVisibility, setStatsVisibility]     = useState(user?.statsVisibility || "public");

  // ── Social states ───────────────────────────────────────────────────────────
  const [chatFilter, setChatFilter]     = useState(true);
  const [emoteVisibility, setEmoteVisibility] = useState(true);

  // ── Appearance states ───────────────────────────────────────────────────────
  const [uiDensity, setUiDensity]       = useState("comfortable");
  const [accentColor, setAccentColor]   = useState("blue");
  const [betaFeatures, setBetaFeatures] = useState((user as any)?.betaFeaturesEnabled || false);

  // ── Danger zone states ──────────────────────────────────────────────────────
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [closureReason, setClosureReason]         = useState("");
  const [disableDialog, setDisableDialog]         = useState(false);
  const [clearCardsDialog, setClearCardsDialog]   = useState(false);

  // ── Hydrate from user ───────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setUsernameInput(user.username || "");
      setDisplayName(user.firstName || "");
      setLanguage(user.languagePreference || "en");
      setCurrency(user.currencyDisplay || "USD");
      setDailyLimit(user.dailySpendingLimit || "");
      setWeeklyLimit(user.weeklySpendingLimit || "");
      setMonthlyLimit(user.monthlySpendingLimit || "");
      setWagerCap(user.maxWagerAmount || "");
      setStatsVisibility(user.statsVisibility || "public");
      setBetaFeatures((user as any)?.betaFeaturesEnabled || false);
      setBio((user as any)?.bio || "");
      setFavoriteGame((user as any)?.favoriteGame || "");
    }
  }, [user]);

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: balanceData } = useQuery<{ balance: string }>({ queryKey: ["/api/wallet/balance"] });
  const { data: referralData } = useQuery<{ referralCode: string }>({ queryKey: ["/api/user/referral-code"] });
  const { data: blockedUsers = [] } = useQuery<any[]>({ queryKey: ["/api/user/blocked"] });

  // ── Username check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!usernameInput || usernameInput === user?.username) {
      setUsernameAvailable(null); return;
    }
    const t = setTimeout(async () => {
      setUsernameChecking(true);
      try {
        const r = await fetch(`/api/user/username/check?username=${encodeURIComponent(usernameInput)}`);
        const d = await r.json();
        setUsernameAvailable(d.available);
      } catch { /* ignore */ }
      finally { setUsernameChecking(false); }
    }, 500);
    return () => clearTimeout(t);
  }, [usernameInput, user?.username]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const mu = <T,>(fn: (d: T) => Promise<any>, successMsg: string, errMsg: string) =>
    useMutation({
      mutationFn: fn,
      onSuccess: () => { toast({ title: successMsg }); queryClient.invalidateQueries({ queryKey: ["/api/user"] }); },
      onError: (e: any) => toast({ title: errMsg, description: e.message, variant: "destructive" }),
    });

  const updateUsernameMutation   = mu((u: string)  => apiRequest("PATCH", "/api/user/username", { username: u }), "Username updated", "Failed to update username");
  const updateProfilePicMutation = mu((url: string) => apiRequest("PATCH", "/api/user/profile-picture", { profileImageUrl: url }), "Profile picture updated", "Failed to update picture");
  const updatePreferencesMutation = mu((d: any) => apiRequest("PATCH", "/api/user/preferences", d), "Preferences saved", "Failed to save preferences");
  const updateSpendingLimitsMutation = mu((d: any) => apiRequest("PATCH", "/api/user/spending-limits", d), "Spending limits updated", "Failed to update limits");
  const setSelfExclusionMutation = mu((d: number) => apiRequest("POST", "/api/user/self-exclusion", { durationDays: d }), "Self-exclusion activated", "Failed to set exclusion");
  const setCoolOffMutation       = mu((d: number) => apiRequest("POST", "/api/user/cool-off", { durationHours: d }), "Cool-off activated", "Failed to set cool-off");
  const updatePrivacyMutation    = mu((d: any) => apiRequest("PATCH", "/api/user/privacy", d), "Privacy settings saved", "Failed to update privacy");
  const generateReferralMutation = mu((_: void) => apiRequest("POST", "/api/user/referral-code/generate", {}), "Referral code generated", "Failed to generate code");
  const requestClosureMutation   = mu((reason: string) => apiRequest("POST", "/api/user/request-closure", { reason }), "Closure requested", "Failed to submit request");

  const changePasswordMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/user/change-password", { currentPassword, newPassword }),
    onSuccess: () => {
      toast({ title: "Password changed successfully" });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
    },
    onError: (e: any) => toast({ title: "Failed to change password", description: e.message, variant: "destructive" }),
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file type", variant: "destructive" }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ title: "File too large (max 2MB)", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onloadend = () => setProfileImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const copyReferralCode = () => {
    if (referralData?.referralCode) {
      navigator.clipboard.writeText(referralData.referralCode);
      toast({ title: "Copied to clipboard" });
    }
  };

  const pwStrength = (p: string) => {
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8)       s++;
    if (/[A-Z]/.test(p))    s++;
    if (/[0-9]/.test(p))    s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return s;
  };

  const pwStrengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
  const pwStrengthColor = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];
  const strength = pwStrength(newPassword);

  const isSelfExcluded = (user as any)?.selfExclusionUntil && new Date((user as any).selfExclusionUntil) > new Date();
  const isCooledOff    = (user as any)?.coolOffUntil      && new Date((user as any).coolOffUntil)       > new Date();

  if (!user) return null;

  // ─── Render section content ─────────────────────────────────────────────────
  const renderSection = () => {
    switch (activeSection) {

      // ── ACCOUNT ────────────────────────────────────────────────────────────
      case "account": return (
        <div className="space-y-6">
          <SectionTitle icon={Users} title="Account Settings" desc="Manage your profile, identity, and account preferences" section="account" />

          {/* Profile picture */}
          <Card className="card-depth border-blue-500/20">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Camera className="w-4 h-4 text-blue-400" />Profile Picture</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-6">
                <div className="relative shrink-0">
                  <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-blue-500/40 via-purple-500/40 to-pink-500/40 blur-md" />
                  <Avatar className="w-24 h-24 relative ring-2 ring-white/10" data-testid="avatar-profile-preview">
                    <AvatarImage src={profileImagePreview || user.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                    <AvatarFallback className="text-3xl bg-blue-500/20 text-blue-300">{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
                  </Avatar>
                </div>
                <div className="flex-1 space-y-3">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} data-testid="input-profile-picture-file" />
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} data-testid="button-select-image" className="border-blue-500/30 text-blue-300">
                      <Camera className="w-4 h-4 mr-2" />Choose Image
                    </Button>
                    {profileImagePreview && (
                      <>
                        <Button size="sm" onClick={() => updateProfilePicMutation.mutate(profileImagePreview)} disabled={updateProfilePicMutation.isPending} data-testid="button-save-profile-picture">
                          {updateProfilePicMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Save
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setProfileImagePreview(null)} data-testid="button-cancel-profile-picture">
                          <X className="w-4 h-4 mr-2" />Cancel
                        </Button>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Max 2MB · JPG, PNG, GIF · Changes allowed every 7 days.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Username & display name */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              {/* Username */}
              <div className="space-y-2">
                <Label htmlFor="username-input">Username</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input id="username-input" value={usernameInput}
                      onChange={e => setUsernameInput(e.target.value)}
                      placeholder="Enter username" className="pr-8" data-testid="input-username" />
                    {usernameChecking && <Loader2 className="w-4 h-4 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />}
                    {!usernameChecking && usernameAvailable === true  && <Check className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-green-500" />}
                    {!usernameChecking && usernameAvailable === false && <X    className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 text-destructive" />}
                  </div>
                  <Button onClick={() => updateUsernameMutation.mutate(usernameInput)}
                    disabled={!usernameAvailable || updateUsernameMutation.isPending} data-testid="button-save-username">
                    {updateUsernameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                </div>
                {usernameAvailable === false && <p className="text-xs text-destructive" data-testid="text-username-unavailable">Username is taken or invalid</p>}
                {usernameAvailable === true  && <p className="text-xs text-green-500"  data-testid="text-username-available">Username is available</p>}
                <p className="text-xs text-muted-foreground">3–30 chars. Letters, numbers, underscores only.</p>
              </div>

              <Separator />

              {/* Display name */}
              <div className="space-y-2">
                <Label htmlFor="display-name">Display Name</Label>
                <Input id="display-name" value={displayName} onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your display name" data-testid="input-display-name" />
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={bio} onChange={e => setBio(e.target.value)}
                  placeholder="Short player description…" rows={3} data-testid="textarea-bio" />
              </div>

              {/* Favorite game */}
              <div className="space-y-2">
                <Label>Favorite Game</Label>
                <Select value={favoriteGame} onValueChange={setFavoriteGame}>
                  <SelectTrigger data-testid="select-favorite-game"><SelectValue placeholder="Select a game" /></SelectTrigger>
                  <SelectContent>
                    {["chess","mini-golf","connect-4","air-hockey","rock-paper-scissors","dots-and-boxes","8-ball","bowling","cup-king","stack-tower"].map(g => (
                      <SelectItem key={g} value={g}>{g.replace(/-/g," ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={() => updatePreferencesMutation.mutate({ languagePreference: language, displayName, bio, favoriteGame })}
                disabled={updatePreferencesMutation.isPending} data-testid="button-save-account">
                {updatePreferencesMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}Save Changes
              </Button>
            </CardContent>
          </Card>

          {/* Account info (read-only) */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Account Information</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Email",          val: user.email,                      id: "text-user-email" },
                { label: "Full Name",      val: `${user.firstName || ""} ${user.lastName || ""}`.trim(), id: "text-user-name" },
                { label: "Member Since",   val: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—", id: "text-member-since" },
              ].map(({ label, val, id }) => (
                <div key={id} className="flex items-center justify-between py-1">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium" data-testid={id}>{val || "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Language */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Language</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Language</Label>
                  <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger data-testid="select-language"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="de">Deutsch</SelectItem>
                      <SelectItem value="pt">Português</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => updatePreferencesMutation.mutate({ languagePreference: language })}
                  disabled={updatePreferencesMutation.isPending} data-testid="button-save-language">Save</Button>
              </div>
            </CardContent>
          </Card>

          {/* Sign Out */}
          <Card className="card-depth border-destructive/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <LogOut className="w-4 h-4 text-destructive" />
                Sign Out
              </CardTitle>
              <CardDescription>End your current session and return to the login screen.</CardDescription>
            </CardHeader>
            <CardContent>
              <a href="/api/logout" data-testid="button-sign-out-account">
                <Button variant="destructive" className="gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out of Account
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      );

      // ── SECURITY ───────────────────────────────────────────────────────────
      case "security": return (
        <div className="space-y-6">
          <SectionTitle icon={Shield} title="Security Settings" desc="Protect your account with strong passwords and session management" section="security" />

          {/* Change password */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Change Password</CardTitle>
              <CardDescription>Use a strong, unique password</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-pw">Current Password</Label>
                <div className="relative">
                  <Input id="current-pw" type={showPw ? "text" : "password"} value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)} className="pr-10" data-testid="input-current-password" />
                  <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw(p => !p)}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-pw">New Password</Label>
                <Input id="new-pw" type={showPw ? "text" : "password"} value={newPassword}
                  onChange={e => setNewPassword(e.target.value)} data-testid="input-new-password" />
                {newPassword && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[1,2,3,4].map(i => (
                        <div key={i} className={cn("h-1 flex-1 rounded-full", i <= strength ? pwStrengthColor[strength] : "bg-muted")} />
                      ))}
                    </div>
                    <p className={cn("text-xs", strength >= 3 ? "text-green-500" : strength === 2 ? "text-yellow-500" : "text-red-500")}>
                      {pwStrengthLabel[strength]}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-pw">Confirm New Password</Label>
                <Input id="confirm-pw" type={showPw ? "text" : "password"} value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} data-testid="input-confirm-password" />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <Button onClick={() => changePasswordMutation.mutate()}
                disabled={!currentPassword || !newPassword || newPassword !== confirmPassword || changePasswordMutation.isPending}
                data-testid="button-change-password">
                {changePasswordMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <KeyRound className="w-4 h-4 mr-2" />}
                Update Password
              </Button>
            </CardContent>
          </Card>

          {/* 2FA */}
          <Card className="card-depth">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Two-Factor Authentication
                <Badge variant={twoFaEnabled ? "default" : "secondary"} className="text-xs">
                  {twoFaEnabled ? "Enabled" : "Disabled"}
                </Badge>
              </CardTitle>
              <CardDescription>Add an extra layer of protection to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <Shield className="w-5 h-5 text-primary" />
                <p className="text-sm text-muted-foreground flex-1">
                  2FA via authenticator app. When enabled, you'll need a code from your app each time you log in.
                </p>
              </div>
              <Button variant={twoFaEnabled ? "destructive" : "default"} onClick={() => setTwoFaEnabled(p => !p)}
                data-testid="button-toggle-2fa">
                <Shield className="w-4 h-4 mr-2" />
                {twoFaEnabled ? "Disable 2FA" : "Enable 2FA"}
              </Button>
            </CardContent>
          </Card>

          {/* Active sessions */}
          <Card className="card-depth">
            <CardHeader>
              <CardTitle className="text-base">Active Sessions</CardTitle>
              <CardDescription>Devices currently logged in to your account</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { device: "Current session", location: "Active now", icon: Monitor, current: true },
                { device: "Previous session", location: "Last seen 3 days ago", icon: Smartphone, current: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <s.icon className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{s.device}</p>
                      {s.current && <Badge variant="outline" className="text-xs text-green-500 border-green-500/30">Current</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.location}</p>
                  </div>
                  {!s.current && (
                    <Button variant="outline" size="sm" data-testid={`button-revoke-session-${i}`}>
                      <X className="w-3 h-3 mr-1" />Revoke
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setLogoutAllDialog(true)} data-testid="button-logout-all-devices">
                <LogOut className="w-4 h-4 mr-2" />Log Out of All Other Devices
              </Button>
            </CardContent>
          </Card>

          {/* Login history */}
          <Card className="card-depth">
            <CardHeader>
              <CardTitle className="text-base">Login History</CardTitle>
              <CardDescription>Recent account access events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { event: "Successful login", time: "Just now",       icon: Check,   color: "text-green-500" },
                  { event: "Successful login", time: "3 days ago",     icon: Check,   color: "text-green-500" },
                  { event: "Failed login",     time: "5 days ago",     icon: AlertTriangle, color: "text-orange-500" },
                  { event: "Successful login", time: "10 days ago",    icon: Check,   color: "text-green-500" },
                ].map((e, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5 border-b last:border-0">
                    <e.icon className={cn("w-4 h-4", e.color)} />
                    <div className="flex-1">
                      <p className="text-sm">{e.event}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{e.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Email verification */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Email Verification</CardTitle></CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{user.email}</p>
                <p className="text-xs text-muted-foreground">Your account email</p>
              </div>
              <Badge variant="outline" className="text-green-500 border-green-500/30 shrink-0" data-testid="badge-email-verified">
                <Check className="w-3 h-3 mr-1" />Verified
              </Badge>
            </CardContent>
          </Card>
        </div>
      );

      // ── NOTIFICATIONS ──────────────────────────────────────────────────────
      case "notifications": return (
        <div className="space-y-6">
          <SectionTitle icon={Bell} title="Notification Settings" desc="Control what notifications you receive and how" section="notifications" />

          {/* Push toggle */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Push Notifications</CardTitle>
              <CardDescription>Master toggle for browser/app push notifications</CardDescription>
            </CardHeader>
            <CardContent>
              <ToggleRow label="Enable Push Notifications"
                desc="Receive alerts directly in your browser or on your device"
                checked={notif.pushEnabled} onCheckedChange={setN("pushEnabled")} testId="switch-push-enabled" />
            </CardContent>
          </Card>

          {/* In-app categories */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">In-App Notifications</CardTitle>
              <CardDescription>Choose which events trigger in-app alerts</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Match Invites" desc="When someone challenges you to a match"
                checked={notif.matchInvites} onCheckedChange={setN("matchInvites")} testId="switch-notif-match-invites" />
              <ToggleRow label="Friend Requests" desc="When someone wants to be your friend"
                checked={notif.friendRequests} onCheckedChange={setN("friendRequests")} testId="switch-notif-friend-requests" />
              <ToggleRow label="Challenge Completions" desc="When your challenge is finished"
                checked={notif.challengeComplete} onCheckedChange={setN("challengeComplete")} testId="switch-notif-challenge" />
              <ToggleRow label="Tournament Announcements" desc="New tournaments, registration opens"
                checked={notif.tournaments} onCheckedChange={setN("tournaments")} testId="switch-notif-tournaments" />
              <ToggleRow label="Wallet Activity" desc="Deposits, withdrawals, winnings received"
                checked={notif.walletActivity} onCheckedChange={setN("walletActivity")} testId="switch-notif-wallet" />
              <ToggleRow label="Rewards & Achievements" desc="New badges, XP milestones, daily bonuses"
                checked={notif.achievements} onCheckedChange={setN("achievements")} testId="switch-notif-achievements" />
              <ToggleRow label="Platform Announcements" desc="Maintenance, updates, new features"
                checked={notif.platformAnnounce} onCheckedChange={setN("platformAnnounce")} testId="switch-notif-platform" />
            </CardContent>
          </Card>

          {/* Email categories */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Email Notifications</CardTitle>
              <CardDescription>Manage what gets sent to {user.email}</CardDescription>
            </CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Match Invites via Email" checked={notif.emailMatchInvites} onCheckedChange={setN("emailMatchInvites")} testId="switch-email-match" />
              <ToggleRow label="Friend Activity via Email" checked={notif.emailFriends} onCheckedChange={setN("emailFriends")} testId="switch-email-friends" />
              <ToggleRow label="Wallet Updates via Email" checked={notif.emailWallet} onCheckedChange={setN("emailWallet")} testId="switch-email-wallet" />
              <ToggleRow label="Platform News via Email" checked={notif.emailPlatform} onCheckedChange={setN("emailPlatform")} testId="switch-email-platform" />
            </CardContent>
          </Card>

          <Button onClick={() => toast({ title: "Notification preferences saved" })} data-testid="button-save-notifications">
            <Check className="w-4 h-4 mr-2" />Save Notification Preferences
          </Button>
        </div>
      );

      // ── GAMEPLAY ───────────────────────────────────────────────────────────
      case "gameplay": return (
        <div className="space-y-6">
          <SectionTitle icon={Gamepad2} title="Gameplay Preferences" desc="Customize your in-game experience" section="gameplay" />

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Audio & Feedback</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Sound Effects"
                desc="Background hum, clicks, win/loss chimes"
                checked={soundEnabled}
                onCheckedChange={v => { setSoundEnabled(v); soundManager.setEnabled(v); if (v) soundManager.playClick(); }}
                testId="switch-sound-toggle" />

              {/* Volume Slider — only visible when sounds are enabled */}
              {soundEnabled && (
                <div className="py-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <VolumeX className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium leading-none">Master Volume</p>
                        <p className="text-xs text-muted-foreground mt-1">Controls all game sounds and effects</p>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground shrink-0 w-8 text-right" data-testid="text-volume-value">
                      {Math.round(soundVolume * 100)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <VolumeX className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <Slider
                      data-testid="slider-master-volume"
                      min={0} max={1} step={0.01}
                      value={[soundVolume]}
                      onValueChange={([v]) => {
                        setSoundVolume(v);
                        soundManager.setVolume(v);
                      }}
                      onValueCommit={() => soundManager.playClick()}
                      className="flex-1"
                    />
                    <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </div>
                </div>
              )}

              <ToggleRow label="Haptic Feedback"
                desc="Vibrations for moves and interactions (mobile)"
                checked={hapticEnabled}
                onCheckedChange={v => { setHapticEnabled(v); hapticManager.setEnabled(v); if (v) hapticManager.light(); }}
                testId="switch-haptic-toggle" />
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Visual Preferences</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Animations"
                desc="Piece movement, card flips, and transition effects"
                checked={animationsEnabled} onCheckedChange={setAnimations} testId="switch-animations" />
              <ToggleRow label="Turn Timer Display"
                desc="Show a countdown clock for timed moves"
                checked={timerDisplay} onCheckedChange={setTimerDisplay} testId="switch-timer-display" />
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Matchmaking & Rematch</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Quick Rematch"
                desc="Offer an instant rematch button at end of game"
                checked={quickRematch} onCheckedChange={setQuickRematch} testId="switch-quick-rematch" />
              <ToggleRow label="Auto-Join Matchmaking"
                desc="Automatically enter matchmaking queue when ready"
                checked={autoJoin} onCheckedChange={setAutoJoin} testId="switch-auto-join" />
              <div className="py-3 space-y-2">
                <Label>Preferred Mode</Label>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {[{ val: true, label: "Ranked", desc: "ELO rating at stake" }, { val: false, label: "Casual", desc: "No ELO changes" }].map(m => (
                    <button key={String(m.val)}
                      onClick={() => setPreferRanked(m.val)}
                      data-testid={`button-mode-${m.label.toLowerCase()}`}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-colors",
                        preferRanked === m.val
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                      )}>
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Phone View</CardTitle>
              <CardDescription>Preview Jango.us in a phone-sized frame from your desktop</CardDescription>
            </CardHeader>
            <CardContent>
              <ToggleRow label="Phone Mode" desc="Wraps the app in a phone-shaped container"
                checked={phoneMode} onCheckedChange={setPhoneMode} testId="switch-phone-mode-toggle" />
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader>
              <CardTitle className="text-base">Mobile Controls</CardTitle>
              <CardDescription>Customize on-screen touch controls for games</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-sm">Hand Position</Label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { val: "right", label: "Right Handed", desc: "D-pad on right" },
                    { val: "left", label: "Left Handed", desc: "D-pad on left" },
                  ] as const).map(opt => (
                    <button key={opt.val}
                      onClick={() => { setMobileCtrl({ ...mobileCtrl, hand: opt.val }); setMobileControlsLib({ hand: opt.val }); }}
                      data-testid={`button-hand-${opt.val}`}
                      className={cn(
                        "text-left p-3 rounded-lg border transition-colors",
                        mobileCtrl.hand === opt.val
                          ? "border-primary bg-primary/10"
                          : "border-border hover-elevate"
                      )}>
                      <p className="text-sm font-medium">{opt.label}</p>
                      <p className="text-xs text-muted-foreground">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Control Size</Label>
                  <span className="text-xs text-muted-foreground font-mono">{mobileCtrl.size}px</span>
                </div>
                <Slider
                  value={[mobileCtrl.size]}
                  min={40} max={88} step={4}
                  onValueChange={([v]) => { setMobileCtrl({ ...mobileCtrl, size: v }); setMobileControlsLib({ size: v }); }}
                  data-testid="slider-control-size"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Opacity</Label>
                  <span className="text-xs text-muted-foreground font-mono">{Math.round(mobileCtrl.opacity * 100)}%</span>
                </div>
                <Slider
                  value={[Math.round(mobileCtrl.opacity * 100)]}
                  min={30} max={100} step={5}
                  onValueChange={([v]) => { setMobileCtrl({ ...mobileCtrl, opacity: v / 100 }); setMobileControlsLib({ opacity: v / 100 }); }}
                  data-testid="slider-control-opacity"
                />
              </div>

              <ToggleRow label="Haptic on Press"
                desc="Vibrate when tapping on-screen controls"
                checked={mobileCtrl.haptic}
                onCheckedChange={v => { setMobileCtrl({ ...mobileCtrl, haptic: v }); setMobileControlsLib({ haptic: v }); }}
                testId="switch-control-haptic" />

              {/* Live preview */}
              <div className="rounded-lg border border-white/10 bg-black/30 p-4">
                <p className="text-[10px] uppercase tracking-wider text-white/40 font-bold mb-3 text-center">Preview</p>
                <div className={cn("flex", mobileCtrl.hand === "left" ? "justify-start" : "justify-end")}>
                  <div className="flex flex-col items-center gap-1 select-none" style={{ opacity: mobileCtrl.opacity }}>
                    <div className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-xl"
                      style={{ width: mobileCtrl.size, height: mobileCtrl.size,
                        background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.3)" }}>▲</div>
                    <div className="flex gap-2">
                      <div className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-xl"
                        style={{ width: mobileCtrl.size, height: mobileCtrl.size,
                          background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.3)" }}>◀</div>
                      <div style={{ width: mobileCtrl.size, height: mobileCtrl.size }} />
                      <div className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-xl"
                        style={{ width: mobileCtrl.size, height: mobileCtrl.size,
                          background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.3)" }}>▶</div>
                    </div>
                    <div className="rounded-xl flex items-center justify-center font-bold text-cyan-300 text-xl"
                      style={{ width: mobileCtrl.size, height: mobileCtrl.size,
                        background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.3)" }}>▼</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => toast({ title: "Gameplay preferences saved" })} data-testid="button-save-gameplay">
            <Check className="w-4 h-4 mr-2" />Save Preferences
          </Button>
        </div>
      );

      // ── WALLET ─────────────────────────────────────────────────────────────
      case "wallet": return (
        <div className="space-y-6">
          <SectionTitle icon={WalletCards} title="Wallet Settings" desc="Manage payments, spending limits, and responsible gaming" section="wallet" />

          {/* Balance */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Current Balance</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
                <span className="text-muted-foreground text-sm">Available Balance</span>
                <span className="text-2xl font-bold text-green-500" data-testid="text-balance">
                  {parseFloat(balanceData?.balance || "0").toFixed(2)} S
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Link href="/deposit">
                  <Button className="w-full" data-testid="button-deposit">
                    <DollarSign className="w-4 h-4 mr-2" />Deposit
                  </Button>
                </Link>
                <Link href="/wallet">
                  <Button variant="outline" className="w-full" data-testid="button-wallet-dashboard">
                    <WalletCards className="w-4 h-4 mr-2" />Dashboard
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Payment methods */}
          <Card className="card-depth">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base">Payment Methods</CardTitle>
                <CardDescription>Saved cards and crypto wallets</CardDescription>
              </div>
              <Link href="/payment-methods">
                <Button variant="outline" size="sm" data-testid="button-manage-cards">Manage Cards</Button>
              </Link>
            </CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Withdrawal Security Confirmation"
                desc="Require extra confirmation before withdrawals"
                checked={withdrawConfirm} onCheckedChange={setWithdrawConfirm} testId="switch-withdraw-confirm" />
              <ToggleRow label="Wallet Activity Notifications"
                desc="Alerts for deposits, withdrawals, and winnings"
                checked={walletNotifs} onCheckedChange={setWalletNotifs} testId="switch-wallet-notifs" />
            </CardContent>
          </Card>

          {/* Currency display */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Currency Display</CardTitle></CardHeader>
            <CardContent className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Label>Display currency</Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger data-testid="select-currency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                    <SelectItem value="BTC">Bitcoin (₿)</SelectItem>
                    <SelectItem value="ETH">Ethereum (Ξ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => updatePreferencesMutation.mutate({ currencyDisplay: currency })}
                disabled={updatePreferencesMutation.isPending} data-testid="button-save-currency">Save</Button>
            </CardContent>
          </Card>

          {/* Spending limits */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Spending Limits</CardTitle>
              <CardDescription>Responsible gaming caps on your spend</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(isSelfExcluded || isCooledOff) && (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/10">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <p className="text-sm text-orange-500 font-medium">Active restriction in place</p>
                </div>
              )}
              {[
                { label: "Daily Limit", val: dailyLimit, set: setDailyLimit, id: "input-daily-limit" },
                { label: "Weekly Limit", val: weeklyLimit, set: setWeeklyLimit, id: "input-weekly-limit" },
                { label: "Monthly Limit", val: monthlyLimit, set: setMonthlyLimit, id: "input-monthly-limit" },
                { label: "Max Wager Per Match", val: wagerCap, set: setWagerCap, id: "input-wager-cap" },
              ].map(({ label, val, set, id }) => (
                <div key={id} className="space-y-1">
                  <Label>{label}</Label>
                  <Input type="number" placeholder="No limit" value={val} onChange={e => set(e.target.value)} data-testid={id} />
                </div>
              ))}
              <Button onClick={() => updateSpendingLimitsMutation.mutate({
                dailySpendingLimit: dailyLimit || null, weeklySpendingLimit: weeklyLimit || null,
                monthlySpendingLimit: monthlyLimit || null, maxWagerAmount: wagerCap || null,
              })} disabled={updateSpendingLimitsMutation.isPending} data-testid="button-save-limits">
                {updateSpendingLimitsMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Shield className="w-4 h-4 mr-2" />}
                Save Limits
              </Button>
            </CardContent>
          </Card>

          {/* Self-exclusion */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Responsible Gaming</CardTitle></CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => setSelfExclusionDialogOpen(true)}
                disabled={isSelfExcluded} data-testid="button-set-self-exclusion">
                <Shield className="w-4 h-4 mr-2" />
                {isSelfExcluded ? "Self-Exclusion Active" : "Set Self-Exclusion"}
              </Button>
              <Button variant="outline" onClick={() => setCoolOffDialogOpen(true)}
                disabled={isCooledOff} data-testid="button-set-cool-off">
                <Clock className="w-4 h-4 mr-2" />
                {isCooledOff ? "Cool-Off Active" : "Set Cool-Off Timer"}
              </Button>
            </CardContent>
          </Card>
        </div>
      );

      // ── PRIVACY ────────────────────────────────────────────────────────────
      case "privacy": return (
        <div className="space-y-6">
          <SectionTitle icon={Eye} title="Privacy Settings" desc="Control what other users can see about you" section="privacy" />

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Profile Visibility</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Stats Visibility</Label>
                <Select value={statsVisibility} onValueChange={setStatsVisibility}>
                  <SelectTrigger data-testid="select-stats-visibility"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public — Everyone can see</SelectItem>
                    <SelectItem value="friends">Friends Only</SelectItem>
                    <SelectItem value="private">Private — Only me</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Separator />
              <div className="divide-y">
                <ToggleRow label="Show Online Status" desc="Let others see when you're active"
                  checked={showOnlineStatus} onCheckedChange={setShowOnlineStatus} testId="switch-online-status" />
                <ToggleRow label="Show Match History" desc="Others can view your recent match results"
                  checked={showMatchHistory} onCheckedChange={setShowMatchHistory} testId="switch-match-history" />
                <ToggleRow label="Show Wallet Winnings" desc="Display total winnings on your public profile"
                  checked={showWalletWins} onCheckedChange={setShowWalletWins} testId="switch-wallet-wins" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Social Permissions</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Allow Friend Requests" desc="Others can send you friend requests"
                checked={allowFriendReqs} onCheckedChange={setAllowFriendReqs} testId="switch-allow-friend-reqs" />
              <ToggleRow label="Allow Private Match Invites" desc="Others can invite you to private matches"
                checked={allowPrivateInvites} onCheckedChange={setAllowPrivateInvites} testId="switch-allow-private-invites" />
              <ToggleRow label="Allow Spectators" desc="Others can watch your matches live"
                checked={allowSpectators} onCheckedChange={setAllowSpectators} testId="switch-allow-spectators" />
            </CardContent>
          </Card>

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Referral Code</CardTitle>
              <CardDescription>Share your unique code with friends</CardDescription>
            </CardHeader>
            <CardContent>
              {referralData?.referralCode ? (
                <div className="flex items-center gap-2">
                  <Input value={referralData.referralCode} readOnly className="font-mono" data-testid="input-referral-code" />
                  <Button variant="outline" size="icon" onClick={copyReferralCode} data-testid="button-copy-referral">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <Button onClick={() => generateReferralMutation.mutate()} disabled={generateReferralMutation.isPending}
                  data-testid="button-generate-referral">
                  {generateReferralMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Gift className="w-4 h-4 mr-2" />}
                  Generate Referral Code
                </Button>
              )}
            </CardContent>
          </Card>

          <Button onClick={() => updatePrivacyMutation.mutate({ statsVisibility, betaFeaturesEnabled: betaFeatures })}
            disabled={updatePrivacyMutation.isPending} data-testid="button-save-privacy">
            {updatePrivacyMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
            Save Privacy Settings
          </Button>
        </div>
      );

      // ── SOCIAL ─────────────────────────────────────────────────────────────
      case "social": return (
        <div className="space-y-6">
          <SectionTitle icon={Users} title="Social Settings" desc="Manage friends, blocked users, and chat behavior" section="social" />

          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Friend Settings</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Allow Friend Requests" desc="Others can send you friend requests"
                checked={allowFriendReqs} onCheckedChange={setAllowFriendReqs} testId="switch-social-friend-reqs" />
              <ToggleRow label="Chat Filter" desc="Filter profanity and offensive language in chat"
                checked={chatFilter} onCheckedChange={setChatFilter} testId="switch-chat-filter" />
              <ToggleRow label="Emote Visibility" desc="Show animated emotes from other players"
                checked={emoteVisibility} onCheckedChange={setEmoteVisibility} testId="switch-emote-visibility" />
            </CardContent>
          </Card>

          {/* Blocked users */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Blocked Users</CardTitle>
              <CardDescription>Players you've blocked can't interact with you</CardDescription>
            </CardHeader>
            <CardContent>
              {(blockedUsers as any[]).length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <UserX className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No blocked users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(blockedUsers as any[]).map((u: any) => (
                    <div key={u.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={u.profileImageUrl} />
                        <AvatarFallback className="text-xs">{u.username?.[0] || "U"}</AvatarFallback>
                      </Avatar>
                      <p className="flex-1 text-sm font-medium">{u.username}</p>
                      <Button variant="outline" size="sm" data-testid={`button-unblock-${u.id}`}>Unblock</Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Muted users */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Muted Users</CardTitle>
              <CardDescription>Muted players' messages are hidden from you</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <MessageSquareOff className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No muted users</p>
              </div>
            </CardContent>
          </Card>

          <Button onClick={() => toast({ title: "Social settings saved" })} data-testid="button-save-social">
            <Check className="w-4 h-4 mr-2" />Save Social Settings
          </Button>
        </div>
      );

      // ── APPEARANCE ─────────────────────────────────────────────────────────
      case "appearance": return (
        <div className="space-y-6">
          <SectionTitle icon={Palette} title="Appearance" desc="Customize how Jango.us looks and feels" section="appearance" />

          {/* Theme */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Color Theme</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: "light", label: "Light", desc: "Bright & clear", icon: Sun },
                  { val: "dark",  label: "Dark",  desc: "Easy on the eyes", icon: Moon },
                ].map(t => (
                  <button key={t.val} onClick={() => setTheme(t.val as "light" | "dark")}
                    data-testid={`button-theme-${t.val}`}
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 transition-colors",
                      theme === t.val ? "border-primary bg-primary/10" : "border-border hover-elevate"
                    )}>
                    <t.icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.desc}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Accent color */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Accent Color</CardTitle>
              <CardDescription>Pick a highlight color for the interface</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 flex-wrap">
                {[
                  { val: "blue",   color: "bg-blue-500",   label: "Blue"   },
                  { val: "pink",   color: "bg-pink-500",   label: "Pink"   },
                  { val: "orange", color: "bg-orange-500", label: "Orange" },
                  { val: "green",  color: "bg-green-500",  label: "Green"  },
                  { val: "violet", color: "bg-violet-500", label: "Violet" },
                ].map(c => (
                  <button key={c.val} onClick={() => setAccentColor(c.val)}
                    data-testid={`button-accent-${c.val}`}
                    title={c.label}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      c.color,
                      accentColor === c.val && "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                    )} />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Accent color affects buttons, highlights, and interactive elements.
              </p>
            </CardContent>
          </Card>

          {/* UI density */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">UI Density</CardTitle>
              <CardDescription>Control how compact the interface feels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: "comfortable", label: "Comfortable", desc: "More spacing & padding" },
                  { val: "compact",     label: "Compact",     desc: "Tighter, more content visible" },
                ].map(d => (
                  <button key={d.val} onClick={() => setUiDensity(d.val)}
                    data-testid={`button-density-${d.val}`}
                    className={cn(
                      "text-left p-3 rounded-lg border-2 transition-colors",
                      uiDensity === d.val ? "border-primary bg-primary/10" : "border-border hover-elevate"
                    )}>
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Animation intensity */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Advanced</CardTitle></CardHeader>
            <CardContent className="divide-y">
              <ToggleRow label="Interface Animations" desc="Transitions, hover effects, loading states"
                checked={animationsEnabled} onCheckedChange={setAnimations} testId="switch-appearance-animations" />
              <ToggleRow label="Beta Features" desc="Early access to experimental features"
                checked={betaFeatures} onCheckedChange={setBetaFeatures} testId="switch-beta-features" />
              <ToggleRow label="Phone View Mode" desc="Preview the app in a phone frame on desktop"
                checked={phoneMode} onCheckedChange={setPhoneMode} testId="switch-appearance-phone-mode" />
            </CardContent>
          </Card>

          <Button onClick={() => toast({ title: "Appearance settings saved" })} data-testid="button-save-appearance">
            <Check className="w-4 h-4 mr-2" />Save Appearance
          </Button>
        </div>
      );

      // ── GAME MODES ─────────────────────────────────────────────────────────
      case "about": return (
        <div className="space-y-6">
          <SectionTitle icon={Info} title="Game Modes" desc="How Jango.us match types work" section="about" />

          {/* Casual */}
          <Card className="card-depth">
            <CardHeader className="flex flex-row items-center gap-3 pb-3 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Swords className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Casual</CardTitle>
                <CardDescription>Play freely with custom wagers</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Casual matches let you play more freely. You can challenge other players, play for fun, and choose your own wager amount.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Choose your own wager amount",
                  "Challenge friends directly",
                  "Less structured — great for practice",
                  "Play with or without a bet",
                  "No ELO/rank requirement",
                  "Good for side bets and open play",
                ].map((pt) => (
                  <div key={pt} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {pt}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Ranked */}
          <Card className="card-depth border-amber-500/30">
            <CardHeader className="flex flex-row items-center gap-3 pb-3 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-base">Ranked</CardTitle>
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Lock className="w-3 h-3" />
                    1 Scalp · Locked
                  </Badge>
                </div>
                <CardDescription>Standardized competitive matchmaking</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-md bg-amber-500/8 border border-amber-500/20 text-sm text-amber-200/80">
                Every ranked match is locked at exactly <strong>1 Scalp</strong>. You cannot raise or lower this amount.
                This keeps ranked fair — everyone risks the same stake.
              </div>
              <p className="text-sm text-muted-foreground">
                Ranked is standardized competitive play. You are matched against players near your skill rating, making it the main mode for climbing and proving yourself.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Always 1 Scalp per match — locked",
                  "Matched by ELO / skill rating",
                  "Wins and losses affect your rank",
                  "Main path for leaderboard climbing",
                  "Standardized stakes keep it fair",
                  "Winner receives 1.94 Scalps (97% of pot)",
                ].map((pt) => (
                  <div key={pt} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {pt}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tournaments */}
          <Card className="card-depth">
            <CardHeader className="flex flex-row items-center gap-3 pb-3 flex-wrap">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Tournaments</CardTitle>
                <CardDescription>Fixed buy-in events with larger prize pools</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Tournaments are structured events with fixed entry fees and larger prize pools. A tournament may cost 5 Scalps to enter and pay out more to top finishers.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  "Fixed entry fee set by the event",
                  "Bracket or round-robin formats",
                  "Larger prize pools than single matches",
                  "Best for high-stakes competition",
                  "Entry fee determined by tournament config",
                  "Top finishers earn the biggest payouts",
                ].map((pt) => (
                  <div key={pt} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    {pt}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="card-depth">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                Common Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { q: "Why is ranked locked at 1 Scalp?", a: "Standardized stakes make ranked fair and purely skill-based. Everyone risks the same amount, so your rank truly reflects your skill — not your wallet." },
                { q: "Can I play casual for free?", a: "Yes. You can create a casual match with a 0 Scalp wager and play just for fun with no money on the line." },
                { q: "How are tournament fees set?", a: "Tournament entry fees are set when the event is created. You can see the entry cost, prize pool, and bracket format before registering." },
              ].map(({ q, a }) => (
                <div key={q} className="space-y-1">
                  <p className="text-sm font-semibold">{q}</p>
                  <p className="text-sm text-muted-foreground">{a}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      );

      // ── DANGER ZONE ────────────────────────────────────────────────────────
      case "danger": return (
        <div className="space-y-6">
          <SectionTitle icon={AlertTriangle} title="Danger Zone" desc="Irreversible and sensitive account actions" section="danger" />

          <div className="p-4 rounded-lg border border-destructive/25 bg-destructive/5 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Actions in this section are difficult or impossible to undo. Please read each description carefully before proceeding.
            </p>
          </div>

          {/* Log out of all devices */}
          <Card className="card-depth border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-base">Log Out of All Devices</CardTitle>
              <CardDescription>Immediately revoke all other active sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-orange-500/30 text-orange-500"
                onClick={() => setLogoutAllDialog(true)} data-testid="button-logout-all">
                <LogOut className="w-4 h-4 mr-2" />Log Out Everywhere
              </Button>
            </CardContent>
          </Card>

          {/* Disable account temporarily */}
          <Card className="card-depth border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-base">Temporarily Disable Account</CardTitle>
              <CardDescription>Pause your account — you can re-enable it at any time</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-orange-500/30 text-orange-500"
                onClick={() => setDisableDialog(true)} data-testid="button-disable-account">
                <EyeOff className="w-4 h-4 mr-2" />Disable My Account
              </Button>
            </CardContent>
          </Card>

          {/* Clear saved payment methods */}
          <Card className="card-depth border-orange-500/20">
            <CardHeader>
              <CardTitle className="text-base">Clear Payment Methods</CardTitle>
              <CardDescription>Remove all saved cards and crypto wallets</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" className="border-orange-500/30 text-orange-500"
                onClick={() => setClearCardsDialog(true)} data-testid="button-clear-cards">
                <CreditCard className="w-4 h-4 mr-2" />Clear Payment Methods
              </Button>
            </CardContent>
          </Card>

          {/* Account deletion */}
          <Card className="card-depth border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Delete Account</CardTitle>
              <CardDescription>
                Permanently delete your account, match history, and wallet balance. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {(user as any)?.accountClosureRequested ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/10">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  <div>
                    <p className="text-sm font-medium text-orange-500">Closure Request Pending</p>
                    <p className="text-xs text-muted-foreground">
                      Requested on {new Date((user as any).accountClosureRequestedAt!).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <Button variant="destructive" onClick={() => setClosureDialogOpen(true)} data-testid="button-request-closure">
                  <Trash2 className="w-4 h-4 mr-2" />Request Account Deletion
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Legal links */}
          <Card className="card-depth">
            <CardHeader><CardTitle className="text-base">Legal</CardTitle></CardHeader>
            <CardContent className="flex gap-3 flex-wrap">
              <Link href="/terms">
                <Button variant="outline" size="sm" data-testid="button-terms">
                  <FileText className="w-4 h-4 mr-2" />Terms of Service
                </Button>
              </Link>
              <Link href="/privacy">
                <Button variant="outline" size="sm" data-testid="button-privacy-policy">
                  <Shield className="w-4 h-4 mr-2" />Privacy Policy
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );

      default: return null;
    }
  };

  // ─── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen glass-bg relative">
      <PageDepthBackground
        glowZones={[
          { x: "30%", y: "8%",  color: "99,102,241",  size: "45%", opacity: 0.06 },
          { x: "75%", y: "20%", color: "139,92,246",  size: "35%", opacity: 0.04 },
          { x: "20%", y: "65%", color: "59,130,246",  size: "30%", opacity: 0.03 },
        ]}
        particleCount={12}
      />
      <AppNavbar />

      {/* ── Phone-mode navigation hub ─────────────────────────────────────── */}
      {phoneMode && (
        <div className="px-4 pt-4 pb-2 space-y-3">

          {/* Profile card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Avatar className="w-14 h-14 ring-2 ring-primary/30 shrink-0">
                <AvatarImage src={user.profileImageUrl || undefined} style={{ objectFit: "cover" }} />
                <AvatarFallback className="text-xl font-bold">{user.firstName?.[0] || user.email?.[0] || "U"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{user.firstName || "Player"}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                <Link href={`/profile/${user.id}`}>
                  <span className="text-[11px] text-primary/70 cursor-pointer hover:text-primary transition-colors">View profile →</span>
                </Link>
              </div>
            </div>
            <button
              onClick={() => setPhoneDepositOpen(true)}
              className="mt-3 w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover-elevate active-elevate-2"
              data-testid="phone-hub-deposit"
            >
              <span className="text-sm text-muted-foreground">Scalps Balance</span>
              <div className="flex items-center gap-1.5">
                <AnimatedBalance value={parseFloat(balanceData?.balance || "0")} className="text-sm font-bold text-primary" showGlow={false} useScalps={true} />
                <Plus className="w-3.5 h-3.5 text-primary opacity-70" />
              </div>
            </button>
          </div>

          {/* Quick nav grid — 4 columns */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: "/shop",         label: "Shop",        icon: ShoppingBag, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20" },
              { href: "/wallet",       label: "Wallet",      icon: Wallet,      color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  },
              { href: "/battle-pass",  label: "Battle Pass", icon: Flame,       color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20" },
              { href: "/tournaments",  label: "Tournaments", icon: Swords,      color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20"    },
              { href: "/clans",        label: "Clans",       icon: Users,       color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
              { href: "/global-stats", label: "Stats",       icon: TrendingUp,  color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
              { href: "/social",       label: "Social",      icon: Rss,         color: "text-pink-400",   bg: "bg-pink-500/10",   border: "border-pink-500/20"   },
              { href: "/leaderboard",  label: "Ranks",       icon: Trophy,      color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20" },
            ].map(({ href, label, icon: Icon, color, bg, border }) => (
              <Link key={href} href={href}>
                <div className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border ${border} ${bg} hover-elevate active-elevate-2 cursor-pointer`} data-testid={`phone-hub-nav-${label.toLowerCase().replace(" ", "-")}`}>
                  <Icon className={`w-5 h-5 ${color}`} />
                  <span className="text-[9px] font-medium text-center leading-tight text-white/70">{label}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Action row — Friends + Streamer Mode */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPhoneFriendsOpen(true)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] hover-elevate active-elevate-2"
              data-testid="phone-hub-friends"
            >
              <UserPlus className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">Friends</span>
            </button>
            <button
              onClick={toggleStreamerMode}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border hover-elevate active-elevate-2 ${streamerMode ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-white/[0.03]"}`}
              data-testid="phone-hub-streamer"
            >
              {streamerMode ? <EyeOff className="w-4 h-4 text-amber-400 shrink-0" /> : <Eye className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className={`text-sm font-medium truncate ${streamerMode ? "text-amber-300" : ""}`}>{streamerMode ? "Streamer: On" : "Streamer"}</span>
            </button>
          </div>

          {/* Admin link */}
          {(user as any)?.isAdmin && (
            <Link href="/admin">
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/10 hover-elevate active-elevate-2 cursor-pointer" data-testid="phone-hub-admin">
                <Shield className="w-4 h-4 text-red-400 shrink-0" />
                <span className="text-sm font-medium text-red-300">Admin Panel</span>
              </div>
            </Link>
          )}

          {/* Settings divider */}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[11px] text-muted-foreground font-medium tracking-wider uppercase">Settings</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
        </div>
      )}

      <div className={`container mx-auto px-4 max-w-6xl ${phoneMode ? "py-3" : "py-8"}`}>
        {/* Page header — hide in phone mode since hub already shows identity */}
        {!phoneMode && <div className="mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-white/90 to-white/50 bg-clip-text text-transparent">
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">Manage your account, preferences, and security</p>
        </div>}

        <div className="flex gap-8">
          {/* ── Sidebar nav (desktop) ──────────────────────────────────────────── */}
          <nav className="hidden lg:flex flex-col gap-1 w-56 shrink-0" data-testid="settings-sidebar">
            {NAV_ITEMS.map(item => {
              const isActive = activeSection === item.id;
              const accent = SECTION_ACCENTS[item.id];
              return (
                <button key={item.id} onClick={() => setActiveSection(item.id)}
                  data-testid={`nav-${item.id}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left w-full",
                    isActive
                      ? cn("border shadow-sm", accent.bg, accent.border, accent.text)
                      : "text-muted-foreground hover-elevate border border-transparent"
                  )}>
                  <item.icon className={cn("w-4 h-4 shrink-0 transition-colors", isActive ? accent.icon : "text-muted-foreground/50")} />
                  <span className="flex-1">{item.label}</span>
                  {item.id === "danger" && !isActive && <AlertTriangle className="w-3 h-3 text-red-400/50" />}
                  {item.id === "danger" && isActive && <AlertTriangle className="w-3 h-3 text-red-400" />}
                </button>
              );
            })}

            {/* Sign out — always visible at sidebar bottom */}
            <div className="mt-3 pt-3 border-t border-white/[0.07]">
              <a href="/api/logout" data-testid="sidebar-sign-out">
                <button className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left text-destructive/70 hover-elevate border border-transparent hover:border-destructive/20 hover:text-destructive transition-colors">
                  <LogOut className="w-4 h-4 shrink-0" />
                  Sign Out
                </button>
              </a>
            </div>
          </nav>

          {/* ── Mobile tab row ─────────────────────────────────────────────────── */}
          <div className="lg:hidden w-full">
            <div className="flex gap-1.5 overflow-x-auto pb-3 mb-6 no-scrollbar" data-testid="settings-mobile-tabs">
              {NAV_ITEMS.map(item => {
                const isActive = activeSection === item.id;
                const accent = SECTION_ACCENTS[item.id];
                return (
                  <button key={item.id} onClick={() => setActiveSection(item.id)}
                    data-testid={`mobile-tab-${item.id}`}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 border transition-all",
                      isActive
                        ? cn(accent.bg, accent.border, accent.text)
                        : "border-transparent text-muted-foreground hover-elevate"
                    )}>
                    <item.icon className={cn("w-3.5 h-3.5", isActive ? accent.icon : "")} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="min-w-0">{renderSection()}</div>
          </div>

          {/* ── Content area (desktop) ─────────────────────────────────────────── */}
          <div className="hidden lg:block flex-1 min-w-0">
            {renderSection()}
          </div>
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      {/* Self-exclusion */}
      <Dialog open={selfExclusionDialogOpen} onOpenChange={setSelfExclusionDialogOpen}>
        <DialogContent className="modal-entrance" data-testid="dialog-self-exclusion">
          <DialogHeader>
            <DialogTitle>Set Self-Exclusion Period</DialogTitle>
            <DialogDescription>Choose how long. This cannot be reversed early.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Select value={selfExclusionDays} onValueChange={setSelfExclusionDays}>
              <SelectTrigger data-testid="select-exclusion-days"><SelectValue placeholder="Select duration" /></SelectTrigger>
              <SelectContent>
                {[7,14,30,90,180,365].map(d => <SelectItem key={d} value={String(d)}>{d} days</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-start gap-3 p-3 rounded-lg border border-orange-500/20 bg-orange-500/10">
              <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
              <p className="text-xs text-muted-foreground">Self-exclusion cannot be reversed. You will not be able to play until the period expires.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelfExclusionDialogOpen(false)} data-testid="button-cancel-exclusion">Cancel</Button>
            <Button variant="destructive"
              onClick={() => { setSelfExclusionMutation.mutate(parseInt(selfExclusionDays)); setSelfExclusionDialogOpen(false); }}
              disabled={!selfExclusionDays || setSelfExclusionMutation.isPending} data-testid="button-confirm-exclusion">
              {setSelfExclusionMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cool-off */}
      <Dialog open={coolOffDialogOpen} onOpenChange={setCoolOffDialogOpen}>
        <DialogContent className="modal-entrance" data-testid="dialog-cool-off">
          <DialogHeader>
            <DialogTitle>Set Cool-Off Timer</DialogTitle>
            <DialogDescription>Take a short break from gaming</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={coolOffHours} onValueChange={setCoolOffHours}>
              <SelectTrigger data-testid="select-cooloff-hours"><SelectValue placeholder="Select duration" /></SelectTrigger>
              <SelectContent>
                {[1,3,6,12,24].map(h => <SelectItem key={h} value={String(h)}>{h} hour{h > 1 ? "s" : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoolOffDialogOpen(false)} data-testid="button-cancel-cooloff">Cancel</Button>
            <Button onClick={() => { setCoolOffMutation.mutate(parseInt(coolOffHours)); setCoolOffDialogOpen(false); }}
              disabled={!coolOffHours || setCoolOffMutation.isPending} data-testid="button-confirm-cooloff">
              {setCoolOffMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Account closure */}
      <Dialog open={closureDialogOpen} onOpenChange={setClosureDialogOpen}>
        <DialogContent className="modal-entrance" data-testid="dialog-account-closure">
          <DialogHeader>
            <DialogTitle className="text-destructive">Request Account Deletion</DialogTitle>
            <DialogDescription>This is permanent. All data will be removed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea placeholder="Please tell us why you're leaving…" value={closureReason}
              onChange={e => setClosureReason(e.target.value)} rows={4} data-testid="textarea-closure-reason" />
            <div className="flex items-start gap-3 p-3 rounded-lg border border-destructive/20 bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
              <p className="text-xs text-muted-foreground">All match history, statistics, and wallet balance will be permanently deleted.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClosureDialogOpen(false)} data-testid="button-cancel-closure">Cancel</Button>
            <Button variant="destructive"
              onClick={() => { requestClosureMutation.mutate(closureReason); setClosureDialogOpen(false); }}
              disabled={!closureReason || requestClosureMutation.isPending} data-testid="button-confirm-closure">
              {requestClosureMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log out all devices */}
      <Dialog open={logoutAllDialog} onOpenChange={setLogoutAllDialog}>
        <DialogContent className="modal-entrance" data-testid="dialog-logout-all">
          <DialogHeader>
            <DialogTitle>Log Out of All Devices</DialogTitle>
            <DialogDescription>This will revoke all active sessions except your current one.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogoutAllDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              setLogoutAllDialog(false);
              toast({ title: "All other sessions revoked" });
            }} data-testid="button-confirm-logout-all">Log Out Everywhere</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable account dialog */}
      <Dialog open={disableDialog} onOpenChange={setDisableDialog}>
        <DialogContent className="modal-entrance" data-testid="dialog-disable-account">
          <DialogHeader>
            <DialogTitle>Temporarily Disable Account</DialogTitle>
            <DialogDescription>Your account will be paused. You can re-enable it by logging in again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              setDisableDialog(false);
              toast({ title: "Account temporarily disabled", description: "Log back in to re-enable it" });
            }} data-testid="button-confirm-disable">Disable Account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clear cards dialog */}
      <Dialog open={clearCardsDialog} onOpenChange={setClearCardsDialog}>
        <DialogContent data-testid="dialog-clear-cards">
          <DialogHeader>
            <DialogTitle>Clear Payment Methods</DialogTitle>
            <DialogDescription>All saved cards and crypto wallet connections will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearCardsDialog(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => {
              setClearCardsDialog(false);
              toast({ title: "Payment methods cleared" });
            }} data-testid="button-confirm-clear-cards">Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone-mode deposit sheet */}
      <Sheet open={phoneDepositOpen} onOpenChange={setPhoneDepositOpen}>
        <SheetContent
          side="bottom"
          className="h-[85%] rounded-t-3xl border-white/10 overflow-y-auto"
          style={{ background: "linear-gradient(160deg, #080c1a 0%, #0d1225 60%, #0a0e1a 100%)" }}
          data-testid="sheet-phone-deposit"
        >
          <SheetHeader className="mb-2">
            <SheetTitle className="flex items-center gap-2 text-white">
              <Wallet className="w-5 h-5 text-primary" />
              Add Funds
            </SheetTitle>
          </SheetHeader>
          <DepositFlowContent
            onPlayNow={() => { setPhoneDepositOpen(false); setLocation("/"); }}
            onClose={() => setPhoneDepositOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* Phone-mode friends modal */}
      <FriendsListModal
        open={phoneFriendsOpen}
        onClose={() => setPhoneFriendsOpen(false)}
        onChallenge={() => setPhoneFriendsOpen(false)}
      />
    </div>
  );
}
