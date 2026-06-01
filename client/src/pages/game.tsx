import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import type { MatchWithPlayers } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Flag, Swords } from "lucide-react";
import ProductionChessGame from "@/components/games/ProductionChessGame";
import MiniGolfGame from "@/components/games/MiniGolfGame";
import Connect4Game from "@/components/games/Connect4Game";
import { AirHockeyGame } from "@/components/games/AirHockeyGame";
import RockPaperScissorsGame from "@/components/games/RockPaperScissorsGame";
import DotsAndBoxesGame from "@/components/games/DotsAndBoxesGame";
import EightBallGame from "@/components/games/EightBallGame";
import BowlingGame from "@/components/games/BowlingGame";
import CupKingGame from "@/components/games/CupKingGame";
import StackTowerGame from "@/components/games/StackTowerGame";
import BasketballGame from "@/components/games/BasketballGame";
import FootballGame from "@/components/games/FootballGame";
import RacingGame from "@/components/games/RacingGame";
import BlockBlastGame from "@/components/games/BlockBlastGame";
import { TronGame } from "@/components/games/TronGame";
import PostGameScreen from "@/components/PostGameScreen";
import { GameHelpButton } from "@/components/games/GameNavBar";
import { ReportPlayerModal } from "@/components/ReportPlayerModal";
import { VictoryAnimation, DefeatAnimation } from "@/components/VictoryAnimation";
import { MatchIntroOverlay } from "@/components/MatchIntroOverlay";
import { useAuth } from "@/hooks/useAuth";
import GameWorldBackground from "@/components/games/GameWorldBackground";

const GAME_MAP: Record<string, React.ComponentType<{ match: MatchWithPlayers; currentUserId?: string }>> = {
  "chess": ProductionChessGame,
  "mini-golf": MiniGolfGame,
  "connect-4": Connect4Game,
  "air-hockey": AirHockeyGame,
  "rock-paper-scissors": RockPaperScissorsGame,
  "dots-and-boxes": DotsAndBoxesGame,
  "8-ball": EightBallGame,
  "bowling": BowlingGame,
  "cup-king": CupKingGame,
  "stack-tower": StackTowerGame,
  "basketball": BasketballGame,
  "football": FootballGame,
  "racing": RacingGame,
  "block-blast": BlockBlastGame,
  "tron": TronGame,
};

const MemoizedGameRenderer = memo(function GameRenderer({
  match,
  currentUserId,
}: {
  match: MatchWithPlayers;
  currentUserId?: string;
}) {
  const GameComponent = GAME_MAP[match.gameType] || Connect4Game;
  return <GameComponent match={match} currentUserId={currentUserId} />;
});

export default function Game() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showPostGame, setShowPostGame] = useState(false);
  const [rematchRequested, setRematchRequested] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [showReportBtn, setShowReportBtn] = useState(false);
  const [showVictory, setShowVictory] = useState(false);
  const [showDefeat, setShowDefeat] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const animTriggered = useRef(false);

  const { data: match, isLoading } = useQuery<MatchWithPlayers>({
    queryKey: ["/api/matches", id],
    refetchInterval: 3000,
    structuralSharing: true,
  });

  const userId = user?.id;

  useEffect(() => {
    if (match?.status === "completed" && !showPostGame) {
      setTimeout(() => setShowPostGame(true), 1000);
    }
    if (match?.status === "completed" && userId && !animTriggered.current) {
      animTriggered.current = true;
      if (match.winnerId === userId) {
        setShowVictory(true);
      } else if (match.winnerId && match.winnerId !== userId) {
        setShowDefeat(true);
      }
    }
  }, [match?.status, match?.winnerId, userId, showPostGame]);

  useEffect(() => {
    if (match?.status === "in-progress") {
      const t = setTimeout(() => setShowReportBtn(true), 10000);
      return () => clearTimeout(t);
    }
  }, [match?.status]);

  const handleRematch = useCallback(async () => {
    if (!match || !userId) return;
    try {
      setRematchRequested(true);
      const betAmount = parseFloat(match.potAmount || "0") / 2;
      const response = await fetch("/api/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          gameType: match.gameType,
          betAmount,
          opponentId: match.player1Id === userId ? match.player2Id : match.player1Id,
        }),
      });
      if (response.ok) {
        const newMatch = await response.json();
        setLocation(`/game/${newMatch.id}`);
      }
    } catch {
      setRematchRequested(false);
    }
  }, [match, userId, setLocation]);

  const { opponentId, opponentName, isBotMatch } = useMemo(() => {
    if (!match) return { opponentId: null, opponentName: "Opponent", isBotMatch: false };
    const bot = match.isBotMatch;
    const oppId = bot ? null : (userId
      ? (match.player1Id === userId ? match.player2Id : match.player1Id)
      : null);
    const oppName = bot
      ? `Bot (${match.botDifficulty ? match.botDifficulty.charAt(0).toUpperCase() + match.botDifficulty.slice(1) : "AI"})`
      : (userId
        ? (match.player1Id === userId ? match.player2?.firstName : match.player1?.firstName) ?? "Opponent"
        : "Opponent");
    return { opponentId: oppId, opponentName: oppName, isBotMatch: bot };
  }, [match?.id, match?.isBotMatch, match?.botDifficulty, match?.player1Id, match?.player2Id, userId]);

  const rematchHandler = useMemo(() => {
    if (isBotMatch || rematchRequested) return undefined;
    return handleRematch;
  }, [isBotMatch, rematchRequested, handleRematch]);

  const handleIntroComplete = useCallback(() => setShowIntro(false), []);
  const handleReportOpen = useCallback(() => setReportOpen(true), []);
  const handleReportClose = useCallback(() => setReportOpen(false), []);
  const handlePostGameClose = useCallback(() => setShowPostGame(false), []);
  const handleVictoryDismiss = useCallback(() => setShowVictory(false), []);
  const handleDefeatDismiss = useCallback(() => setShowDefeat(false), []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <GameWorldBackground />
        <div className="text-center relative z-10">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div
              className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping"
              style={{ animationDuration: "1.5s" }}
            />
            <div className="absolute inset-2 rounded-full border border-primary/40 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Swords className="w-8 h-8 text-primary/70" />
            </div>
          </div>
          <p className="text-white/70 font-semibold text-lg tracking-wide">Setting the arena…</p>
          <p className="text-white/30 text-sm mt-1">Preparing your match</p>
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        <GameWorldBackground />
        <div className="text-center relative z-10">
          <h2 className="text-2xl font-bold mb-3 text-white/90">Match Not Found</h2>
          <p className="text-white/40 text-sm mb-6">This arena doesn't exist or has already ended.</p>
          <Button onClick={() => setLocation("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />Back to Lobby
          </Button>
        </div>
      </div>
    );
  }

  const scalpsWon = showVictory && match.potAmount
    ? parseFloat(match.potAmount) * 0.97
    : undefined;

  return (
    <>
      <GameWorldBackground gameType={match?.gameType} />
      <GameHelpButton match={match} />

      {opponentId && (showReportBtn || match.status === "completed") && (
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 border-red-500/25 text-red-400/70 bg-black/60 backdrop-blur-sm hover:border-red-500/50 hover:text-red-400 text-xs"
            onClick={handleReportOpen}
            data-testid="button-report-opponent"
          >
            <Flag className="w-3.5 h-3.5" />
            Report Player
          </Button>
        </div>
      )}

      {match.status === "in-progress" && showIntro && (
        <MatchIntroOverlay match={match} currentUserId={userId} onComplete={handleIntroComplete} />
      )}

      <MemoizedGameRenderer match={match} currentUserId={userId} />

      {match.status === "completed" && (
        <PostGameScreen
          match={match}
          currentUserId={userId}
          onRematch={rematchHandler}
          isOpen={showPostGame}
          onClose={handlePostGameClose}
        />
      )}

      {opponentId && (
        <ReportPlayerModal
          open={reportOpen}
          onClose={handleReportClose}
          reportedUserId={opponentId}
          reportedName={opponentName}
          matchId={match.id}
        />
      )}

      <VictoryAnimation
        show={showVictory}
        winnerName={user?.firstName ?? undefined}
        scalpsWon={scalpsWon}
        onDismiss={handleVictoryDismiss}
      />
      <DefeatAnimation
        show={showDefeat}
        onDismiss={handleDefeatDismiss}
      />
    </>
  );
}
