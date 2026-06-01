import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Home from "@/pages/home";
import Leaderboard from "@/pages/leaderboard";
import Dashboard from "@/pages/dashboard";
import Settings from "@/pages/settings";
import Admin from "@/pages/admin";
import Game from "@/pages/game";
import GlobalStats from "@/pages/global-stats";
import Contact from "@/pages/contact";
import TermsOfService from "@/pages/terms";
import PrivacyPolicy from "@/pages/privacy";
import Deposit from "@/pages/deposit";
import ProfilePage from "@/pages/profile";
import PaymentMethods from "@/pages/payment-methods";
import Shop from "@/pages/shop";
import Tournaments from "@/pages/tournaments";
import WalletPage from "@/pages/wallet";
import ClansPage from "@/pages/clans";
import ClanPage from "@/pages/clan";
import SocialPage from "@/pages/social";
import BattlePassPage from "@/pages/battle-pass";
import SpectatorPage from "@/pages/spectator";
import PartyPage from "@/pages/party";
import ArenaOriginsPage from "@/pages/arena-origins";
import RankProgressionPage from "@/pages/rank-progression";
import TutorialHubPage from "@/pages/tutorial-hub";
import { AchievementUnlockToast } from "@/components/AchievementUnlockToast";
import { LevelUpOverlay } from "@/components/LevelUpOverlay";
import { RankUpOverlay } from "@/components/RankUpOverlay";
import { XPFloatLayer } from "@/components/XPFloatLayer";
import { ScalpsFloatLayer } from "@/components/ScalpsFloatLayer";
import { StreamerProvider } from "@/contexts/StreamerContext";
import { PhoneBottomNav } from "@/components/PhoneBottomNav";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { DevicePrompt } from "@/components/DevicePrompt";
import { OnboardingModal } from "@/components/OnboardingModal";
import { LiveTournamentBanner } from "@/components/LiveTournamentBanner";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/contact" component={Contact} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/story" component={ArenaOriginsPage} />
          <Route path="/arena-origins" component={ArenaOriginsPage} />
        </>
      ) : (
        <>
          <Route path="/" component={Home} />
          <Route path="/leaderboard" component={Leaderboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin" component={Admin} />
          <Route path="/game/:id" component={Game} />
          <Route path="/global-stats" component={GlobalStats} />
          <Route path="/contact" component={Contact} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/deposit" component={Deposit} />
          <Route path="/profile/:userId" component={ProfilePage} />
          <Route path="/payment-methods" component={PaymentMethods} />
          <Route path="/shop" component={Shop} />
          <Route path="/tournaments" component={Tournaments} />
          <Route path="/wallet" component={WalletPage} />
          <Route path="/social" component={SocialPage} />
          <Route path="/messages">{() => <Redirect to="/social?tab=messages" />}</Route>
          <Route path="/clans" component={ClansPage} />
          <Route path="/clans/:id" component={ClanPage} />
          <Route path="/battle-pass" component={BattlePassPage} />
          <Route path="/spectate/:matchId" component={SpectatorPage} />
          <Route path="/party" component={PartyPage} />
          <Route path="/party/:id" component={PartyPage} />
          <Route path="/story" component={ArenaOriginsPage} />
          <Route path="/arena-origins" component={ArenaOriginsPage} />
          <Route path="/rank-progression" component={RankProgressionPage} />
          <Route path="/dashboard/rank" component={RankProgressionPage} />
          <Route path="/tutorial" component={TutorialHubPage} />
          <Route path="/training" component={TutorialHubPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

const PHONE_W = 390;
const PHONE_H = 844;

function usePhoneScale() {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    function compute() {
      const scaleX = (window.innerWidth - 32) / PHONE_W;
      const scaleY = (window.innerHeight - 32) / PHONE_H;
      setScale(Math.min(scaleX, scaleY, 1));
    }
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);
  return scale;
}

function AppShell() {
  const { phoneMode } = useTheme();
  const phoneScale = usePhoneScale();

  if (!phoneMode) {
    return (
      <>
        <DevicePrompt />
        <OnboardingModal />
        <AchievementUnlockToast />
        <LevelUpOverlay />
        <RankUpOverlay />
        <XPFloatLayer />
        <ScalpsFloatLayer />
        <LiveTournamentBanner />
        {/* Bottom padding on mobile to clear the fixed bottom tab bar + safe area */}
        <div className="pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-0">
          <Router />
        </div>
        <MobileBottomNav />
      </>
    );
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{
        background: "radial-gradient(ellipse at 30% 40%, #1a2744 0%, #010208 60%)",
      }}
      data-testid="phone-shell-backdrop"
    >
      <LevelUpOverlay />
      {/* Ambient glow behind the device */}
      <div
        className="absolute w-[440px] h-[900px] rounded-[48px] pointer-events-none"
        style={{
          background: "radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)",
          filter: "blur(20px)",
        }}
      />

      {/* Phone device frame */}
      <div
        className="relative flex flex-col overflow-hidden"
        style={{
          width: `${PHONE_W}px`,
          height: `${PHONE_H}px`,
          borderRadius: "44px",
          border: "2px solid rgba(255,255,255,0.12)",
          boxShadow: "0 0 0 1px rgba(0,0,0,0.8), 0 50px 120px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.04)",
          background: "#010208",
          transform: `scale(${phoneScale})`,
          transformOrigin: "center center",
        }}
        data-testid="phone-device-frame"
      >
        {/* Status bar notch area */}
        <div
          className="shrink-0 flex items-center justify-center"
          style={{ height: "44px", paddingTop: "12px" }}
        >
          {/* Dynamic island / notch pill */}
          <div
            className="rounded-full bg-black"
            style={{ width: "120px", height: "34px" }}
          />
        </div>

        {/* Scrollable content area */}
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden"
          style={{ scrollbarWidth: "none" }}
          data-testid="phone-content-area"
        >
          <AchievementUnlockToast />
          <Router />
        </div>

        {/* Bottom nav */}
        <PhoneBottomNav />
      </div>

      {/* Side buttons (decorative) */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "calc(50% - 200px)",
          top: "160px",
          width: "3px",
          height: "32px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.15)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left: "calc(50% - 200px)",
          top: "210px",
          width: "3px",
          height: "60px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.15)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          left: "calc(50% - 200px)",
          top: "284px",
          width: "3px",
          height: "60px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.15)",
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          right: "calc(50% - 200px)",
          top: "210px",
          width: "3px",
          height: "80px",
          borderRadius: "2px",
          background: "rgba(255,255,255,0.15)",
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <StreamerProvider>
          <TooltipProvider>
            <Toaster />
            <AppShell />
          </TooltipProvider>
        </StreamerProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
