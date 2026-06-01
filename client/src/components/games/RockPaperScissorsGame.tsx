import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { MatchWithPlayers } from "@shared/schema";
import { GameLayout } from "@/components/games/GameLayout";
import { getBotOpponentName } from "@/lib/botMatchUtils";
import type { RPSGameState, Choice } from "@shared/rockPaperScissorsEngine";
import { ArrowLeft, HandMetal, FileText, Scissors, HelpCircle, Zap } from "lucide-react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface RockPaperScissorsGameProps {
  match: MatchWithPlayers;
  currentUserId?: string;
}

const choiceIcons = {
  rock: HandMetal,
  paper: FileText,
  scissors: Scissors,
};

const choiceLabels = {
  rock: "Rock",
  paper: "Paper",
  scissors: "Scissors",
};

function getTieLabel(streak: number): string {
  if (streak >= 4) return "SUPREME STANDOFF";
  if (streak === 3) return "INTENSE STANDOFF";
  if (streak === 2) return "DOUBLE CLASH";
  return "CLASH!";
}

function getTieSubtext(streak: number): string {
  if (streak >= 4) return "Unprecedented tension — who will break first?";
  if (streak === 3) return "Three rounds with no winner — the pressure is immense!";
  if (streak === 2) return "Second clash — the stakes are rising!";
  return "Both picked the same — no points awarded";
}

function playClashSound() {
  try {
    const ctx = new AudioContext();
    const sampleRate = ctx.sampleRate;

    // Short noise burst — "thud/clash" feel
    const bufferSize = Math.floor(sampleRate * 0.18);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.pow(1 - i / bufferSize, 1.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass for percussive "clash" quality
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = 280;
    bpf.Q.value = 0.7;

    // Slight distortion via gain
    const gain = ctx.createGain();
    gain.gain.value = 1.4;

    source.connect(bpf);
    bpf.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    // Second metallic ring layer
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = 180;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.25, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    // Audio not available — silently skip
  }
}

export default function RockPaperScissorsGame({ match, currentUserId }: RockPaperScissorsGameProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [gameState, setGameState] = useState<RPSGameState>(() => {
    if (match.gameState && (match.gameState as any).status) {
      return match.gameState as RPSGameState;
    }
    return {
      status: "choosing",
      currentRound: 1,
      totalRounds: 3,
      player1Score: 0,
      player2Score: 0,
      player1Choice: null,
      player2Choice: null,
      bothPlayersReady: false,
      roundHistory: [],
      countdownValue: 0,
      winner: null,
      revealTime: null,
      lastUpdate: Date.now(),
    };
  });
  const [myChoice, setMyChoice] = useState<Choice | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [tieStreak, setTieStreak] = useState(0);
  const [showTieOverlay, setShowTieOverlay] = useState(false);
  const [isTieShake, setIsTieShake] = useState(false);
  // Track last seen round count to avoid duplicate processing
  const lastProcessedRoundRef = useRef(0);

  const isPlayer1 = match.player1Id === currentUserId;
  const playerKey = isPlayer1 ? "player1" : "player2";
  const opponentKey = isPlayer1 ? "player2" : "player1";

  // Update game state when match data changes
  useEffect(() => {
    if (match.gameState && (match.gameState as any).status) {
      const newState = match.gameState as RPSGameState;
      setGameState(newState);

      if (isPlayer1 && newState.player1Choice) {
        setMyChoice(newState.player1Choice);
      } else if (!isPlayer1 && newState.player2Choice) {
        setMyChoice(newState.player2Choice);
      }
    }
  }, [match.gameState, isPlayer1]);

  // Handle round result animations and tie detection
  useEffect(() => {
    if (gameState.status === "revealing" && gameState.roundHistory.length > 0) {
      const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1];
      const roundNum = lastRound.roundNumber;

      // Only process this round once
      if (roundNum <= lastProcessedRoundRef.current) return;
      lastProcessedRoundRef.current = roundNum;

      setRoundWinner(lastRound.result);

      if (lastRound.result === "tie") {
        // Increment streak
        setTieStreak(prev => {
          const newStreak = prev + 1;

          // Play clash sound
          playClashSound();

          // Show overlay
          setShowTieOverlay(true);
          setIsTieShake(true);

          // Stop shake after 600ms
          setTimeout(() => setIsTieShake(false), 600);

          // For high streaks, show stronger effect
          if (newStreak >= 4) {
            confetti({
              particleCount: 30,
              colors: ["#FFD700", "#FFF", "#FF8C00"],
              spread: 90,
              gravity: 0.8,
              origin: { y: 0.5 },
            });
          }

          return newStreak;
        });
      } else {
        // Non-tie round — reset streak, hide overlay
        setTieStreak(0);
        setShowTieOverlay(false);

        if (
          (lastRound.result === "player1" && isPlayer1) ||
          (lastRound.result === "player2" && !isPlayer1)
        ) {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      }

      const timer = setTimeout(() => {
        setRoundWinner(null);
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [gameState.status, gameState.roundHistory, isPlayer1]);

  // Auto-advance after roundComplete — for TIES specifically, do it quickly
  useEffect(() => {
    if (gameState.status !== "roundComplete") return;
    // If status is "roundComplete" (not "finished"), the engine guarantees another round exists.
    // Do NOT guard on currentRound >= totalRounds — the engine increments currentRound
    // before broadcasting roundComplete, so round 3 of 3 has currentRound===totalRounds===3
    // yet still needs to be played.

    const lastRound = gameState.roundHistory[gameState.roundHistory.length - 1];
    const isTie = lastRound?.result === "tie";

    // For bot/practice matches OR for ties in any match, auto-advance
    const shouldAutoAdvance = match.isBotMatch || match.isPractice || isTie;
    if (!shouldAutoAdvance) return;

    const delay = isTie ? 700 : 800;

    const timer = setTimeout(() => {
      setShowTieOverlay(false);
      handleNextRound();
    }, delay);

    return () => clearTimeout(timer);
  }, [gameState.status, match.isBotMatch, match.isPractice, gameState.roundHistory]);

  // Auto-generate bot moves for bot and practice matches
  useEffect(() => {
    if ((!match.isBotMatch && !match.isPractice) || match.status !== "in-progress") return;
    if (gameState.status !== "choosing") return;

    const botHasChosen = isPlayer1 ? gameState.player2Choice : gameState.player1Choice;

    if (!botHasChosen) {
      const timer = setTimeout(async () => {
        try {
          const response = await fetch(`/api/matches/${match.id}/bot-move`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
          });

          if (response.ok) {
            const data = await response.json();
            if (data.move && data.move.gameState) {
              setGameState(data.move.gameState);
            }
          }
        } catch (error) {
          console.error("Bot move error:", error);
        }
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [match.isBotMatch, match.isPractice, match.status, match.id, gameState.status, gameState.player1Choice, gameState.player2Choice, isPlayer1]);

  // WebSocket connection for real-time multiplayer
  const setupWebSocket = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join", matchId: match.id, userId: currentUserId }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "rps-state-update" && data.matchId === match.id) {
          setGameState(data.gameState);
        } else if (data.type === "error") {
          toast({ title: "Error", description: data.message, variant: "destructive" });
        } else if (data.type === "player-disconnected" && data.matchId === match.id) {
          if (data.userId !== currentUserId) {
            toast({
              title: "Opponent Disconnected",
              description: `Waiting for reconnection (${Math.floor(data.gracePeriodMs / 1000)}s grace period)...`,
            });
          }
        } else if (data.type === "player-reconnected" && data.matchId === match.id) {
          if (data.userId !== currentUserId) {
            toast({ title: "Opponent Reconnected", description: "The match continues!" });
          }
        } else if (data.type === "match-forfeit" && data.matchId === match.id) {
          const isWinner = data.winnerId === currentUserId;
          if (isWinner) {
            toast({ title: "You Win!", description: "Your opponent forfeited the match" });
          } else if (data.forfeitedById === currentUserId) {
            toast({ title: "Match Forfeited", description: "You have forfeited the match", variant: "destructive" });
          }
          setTimeout(() => { window.location.href = "/lobby"; }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      wsRef.current = ws;

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [match.id, currentUserId, toast]);

  useEffect(() => {
    return setupWebSocket();
  }, [setupWebSocket]);

  const makeChoice = async (choice: Choice) => {
    if (gameState.status !== "choosing") return;
    const alreadyChosen = isPlayer1 ? gameState.player1Choice : gameState.player2Choice;
    if (alreadyChosen) return;

    setMyChoice(choice);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "rps-choice", matchId: match.id, choice }));
    }
  };

  const handleNextRound = () => {
    if (gameState.status !== "revealing" && gameState.status !== "roundComplete") return;

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "rps-next-round", matchId: match.id }));
    }

    setMyChoice(null);
  };

  const myChoiceValue = isPlayer1 ? gameState.player1Choice : gameState.player2Choice;
  const opponentChoiceValue = isPlayer1 ? gameState.player2Choice : gameState.player1Choice;
  const myScore = isPlayer1 ? gameState.player1Score : gameState.player2Score;
  const opponentScore = isPlayer1 ? gameState.player2Score : gameState.player1Score;

  const bothPlayersChosen = gameState.player1Choice && gameState.player2Choice;
  const waitingForOpponent = myChoiceValue && !bothPlayersChosen;

  const isRevealing = gameState.status === "revealing";
  const lastRoundResult = gameState.roundHistory[gameState.roundHistory.length - 1]?.result;
  const isLastRoundTie = lastRoundResult === "tie";

  // Shake animation keyframes for tie
  const shakeVariants = {
    idle: { x: 0 },
    shake: {
      x: [0, -8, 8, -6, 6, -4, 4, 0],
      transition: { duration: 0.5, ease: "easeInOut" },
    },
  };

  return (
    <GameLayout match={match} currentUserId={currentUserId} accentColor="#f97316" accentRgb="249,115,22" controls="Click your choice" winCondition="First to 3 wins" helpItems={[{ label: "Rock", value: "Beats Scissors" }, { label: "Paper", value: "Beats Rock" }, { label: "Scissors", value: "Beats Paper" }]}>
      {/* Slim sticky header */}
      <div
        className="sticky top-0 z-20 border-b border-white/8 px-4 py-3 flex items-center gap-3"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(14px)" }}
      >
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="text-xs text-white/40 uppercase tracking-[0.15em] font-medium">Rock · Paper · Scissors</p>
          <div className="flex items-center justify-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs border-white/20 text-white/60">Best of {gameState.totalRounds}</Badge>
            <span className="text-sm font-bold text-white/90">Round {gameState.currentRound}</span>
          </div>
        </div>
        <div className="w-9" />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Player vs Opponent strip */}
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
          {/* Player 1 panel */}
          <div
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300"
            style={{
              background: "rgba(168,85,247,0.08)",
              borderColor: gameState.status === "choosing" && !myChoiceValue
                ? "rgba(168,85,247,0.5)"
                : "rgba(255,255,255,0.10)",
              boxShadow: gameState.status === "choosing" && !myChoiceValue
                ? "0 0 22px rgba(168,85,247,0.2), inset 0 0 20px rgba(168,85,247,0.05)"
                : "none",
            }}
          >
            <div className="relative">
              {gameState.status === "choosing" && !myChoiceValue && (
                <div
                  className="absolute -inset-1.5 rounded-full animate-pulse"
                  style={{ background: "rgba(168,85,247,0.3)", filter: "blur(6px)" }}
                />
              )}
              <Avatar className="w-14 h-14 relative" style={{ boxShadow: "0 0 0 2px rgba(168,85,247,0.3)" }}>
                <AvatarImage src={match.player1?.profileImageUrl || undefined} />
                <AvatarFallback style={{ background: "rgba(168,85,247,0.2)", color: "#c084fc" }}>
                  {(match.player1?.username || "P1").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/90 truncate max-w-[100px]">
                {match.player1?.username || "Player 1"}
              </p>
              {isPlayer1 && <Badge variant="secondary" className="text-xs mt-0.5">You</Badge>}
            </div>
            <div
              className="text-4xl font-black tabular-nums"
              style={{ color: "#c084fc", textShadow: "0 0 20px rgba(168,85,247,0.5)" }}
            >
              {isPlayer1 ? myScore : opponentScore}
            </div>
          </div>

          {/* VS center */}
          <div className="flex flex-col items-center justify-center gap-2 min-w-[52px]">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="text-xl font-black"
              style={{ color: "white", textShadow: "0 0 25px rgba(168,85,247,0.9), 0 0 50px rgba(239,68,68,0.5)" }}
            >
              VS
            </motion.div>
            {gameState.status === "finished" && (
              <Badge
                className="text-xs font-black"
                style={{
                  background: gameState.winner === playerKey ? "#22c55e" : gameState.winner === opponentKey ? "#ef4444" : "#6b7280",
                  color: "#000",
                  boxShadow: gameState.winner === playerKey ? "0 0 12px rgba(34,197,94,0.6)" : gameState.winner === opponentKey ? "0 0 12px rgba(239,68,68,0.6)" : "none",
                }}
              >
                {gameState.winner === playerKey ? "WIN!" : gameState.winner === opponentKey ? "LOSS" : "DRAW"}
              </Badge>
            )}
          </div>

          {/* Player 2 panel */}
          <div
            className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all duration-300"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(255,255,255,0.10)" }}
          >
            <Avatar className="w-14 h-14" style={{ boxShadow: "0 0 0 2px rgba(239,68,68,0.3)" }}>
              <AvatarImage src={match.player2?.profileImageUrl || undefined} />
              <AvatarFallback style={{ background: "rgba(239,68,68,0.2)", color: "#f87171" }}>
                {getBotOpponentName(match).substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/90 truncate max-w-[100px]">
                {getBotOpponentName(match)}
              </p>
              {!isPlayer1 && <Badge variant="secondary" className="text-xs mt-0.5">You</Badge>}
            </div>
            <div
              className="text-4xl font-black tabular-nums"
              style={{ color: "#f87171", textShadow: "0 0 20px rgba(239,68,68,0.5)" }}
            >
              {isPlayer1 ? opponentScore : myScore}
            </div>
          </div>
        </div>

        {/* Tie streak banner */}
        <AnimatePresence>
          {showTieOverlay && tieStreak >= 2 && (
            <motion.div
              key={`streak-${tieStreak}`}
              initial={{ opacity: 0, y: -12, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="flex items-center justify-center gap-3 px-4 py-3 rounded-xl border"
              style={{ borderColor: "rgba(251,191,36,0.45)", background: "rgba(251,191,36,0.08)" }}
            >
              <Zap className="w-4 h-4 shrink-0" style={{ color: "hsl(45 100% 60%)" }} />
              <div className="text-center">
                <p className="font-black text-sm" style={{ color: "hsl(45 100% 60%)" }}>
                  {getTieLabel(tieStreak)} — {tieStreak} ties in a row!
                </p>
                <p className="text-xs text-white/40">{getTieSubtext(tieStreak)}</p>
              </div>
              <Zap className="w-4 h-4 shrink-0" style={{ color: "hsl(45 100% 60%)" }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Choice clash area */}
        <div
          className="relative rounded-2xl border overflow-hidden"
          style={{ minHeight: 188, borderColor: "rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.04)" }}
        >
          {/* Center divider */}
          <div
            className="absolute inset-y-0 left-1/2 w-px -translate-x-px pointer-events-none"
            style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.12), transparent)" }}
          />

          <div className="grid grid-cols-2 h-full">
            {/* My choice */}
            <motion.div
              className="flex flex-col items-center justify-center p-6 gap-2"
              variants={shakeVariants}
              animate={isTieShake && isRevealing ? "shake" : "idle"}
            >
              <p className="text-xs text-white/40 uppercase tracking-widest font-medium">You</p>
              {myChoiceValue ? (
                <motion.div
                  key={myChoiceValue}
                  initial={{ scale: 0.3, x: -30, opacity: 0 }}
                  animate={{ scale: 1, x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18 }}
                  className="flex flex-col items-center gap-1"
                >
                  {(() => {
                    const Icon = choiceIcons[myChoiceValue];
                    const won = isRevealing && roundWinner === playerKey;
                    const lost = isRevealing && roundWinner === opponentKey;
                    const tied = isRevealing && isLastRoundTie;
                    return (
                      <>
                        <div
                          className="w-20 h-20 rounded-2xl flex items-center justify-center"
                          style={{
                            background: won ? "rgba(34,197,94,0.18)" : lost ? "rgba(239,68,68,0.12)" : tied ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.08)",
                            border: `1px solid ${won ? "rgba(34,197,94,0.5)" : lost ? "rgba(239,68,68,0.3)" : tied ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.12)"}`,
                            boxShadow: won ? "0 0 28px rgba(34,197,94,0.4)" : tied ? "0 0 24px rgba(251,191,36,0.3)" : "none",
                          }}
                        >
                          <Icon
                            className="w-10 h-10"
                            style={{ color: won ? "#22c55e" : lost ? "#ef4444" : tied ? "hsl(45 100% 60%)" : "white" }}
                          />
                        </div>
                        <p className="text-sm font-bold text-white/80">{choiceLabels[myChoiceValue]}</p>
                      </>
                    );
                  })()}
                </motion.div>
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl border border-dashed flex items-center justify-center"
                  style={{ borderColor: "rgba(255,255,255,0.15)" }}
                >
                  <HelpCircle className="w-8 h-8 text-white/20" />
                </div>
              )}
            </motion.div>

            {/* Opponent choice */}
            <motion.div
              className="flex flex-col items-center justify-center p-6 gap-2"
              variants={shakeVariants}
              animate={isTieShake && isRevealing ? "shake" : "idle"}
            >
              <p className="text-xs text-white/40 uppercase tracking-widest font-medium">Opponent</p>
              {gameState.status === "revealing" && opponentChoiceValue ? (
                <motion.div
                  key={opponentChoiceValue}
                  initial={{ scale: 0.3, x: 30, opacity: 0 }}
                  animate={{ scale: 1, x: 0, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.08 }}
                  className="flex flex-col items-center gap-1"
                >
                  {(() => {
                    const Icon = choiceIcons[opponentChoiceValue];
                    const won = isRevealing && roundWinner === opponentKey;
                    const lost = isRevealing && roundWinner === playerKey;
                    const tied = isRevealing && isLastRoundTie;
                    return (
                      <>
                        <motion.div
                          className="w-20 h-20 rounded-2xl flex items-center justify-center"
                          animate={tied ? { scale: [1, 1.08, 1, 1.06, 1] } : {}}
                          transition={tied ? { duration: 0.5 } : {}}
                          style={{
                            background: won ? "rgba(34,197,94,0.18)" : lost ? "rgba(239,68,68,0.12)" : tied ? "rgba(251,191,36,0.12)" : "rgba(255,255,255,0.08)",
                            border: `1px solid ${won ? "rgba(34,197,94,0.5)" : lost ? "rgba(239,68,68,0.3)" : tied ? "rgba(251,191,36,0.4)" : "rgba(255,255,255,0.12)"}`,
                            boxShadow: won ? "0 0 28px rgba(34,197,94,0.4)" : tied ? "0 0 24px rgba(251,191,36,0.3)" : "none",
                          }}
                        >
                          <Icon
                            className="w-10 h-10"
                            style={{ color: won ? "#22c55e" : lost ? "#ef4444" : tied ? "hsl(45 100% 60%)" : "white" }}
                          />
                        </motion.div>
                        <p className="text-sm font-bold text-white/80">{choiceLabels[opponentChoiceValue]}</p>
                      </>
                    );
                  })()}
                </motion.div>
              ) : opponentChoiceValue && gameState.status === "choosing" ? (
                <div className="flex flex-col items-center gap-1">
                  <motion.div
                    className="w-20 h-20 rounded-2xl border flex items-center justify-center"
                    style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.08)" }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                  >
                    <HelpCircle className="w-8 h-8" style={{ color: "rgba(239,68,68,0.6)" }} />
                  </motion.div>
                  <p className="text-xs text-white/40">Ready</p>
                </div>
              ) : (
                <div
                  className="w-20 h-20 rounded-2xl border border-dashed flex items-center justify-center"
                  style={{ borderColor: "rgba(255,255,255,0.12)" }}
                >
                  <HelpCircle className="w-8 h-8 text-white/15" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Round result pill */}
          <AnimatePresence mode="wait">
            {(gameState.status === "revealing" || gameState.status === "roundComplete") && (
              <motion.div
                key={`result-${gameState.roundHistory.length}`}
                initial={{ opacity: 0, scale: 0.7, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="absolute top-2 left-1/2 -translate-x-1/2 pointer-events-none"
              >
                <div
                  className="px-4 py-1 rounded-full text-xs font-black whitespace-nowrap"
                  style={{
                    background: isLastRoundTie ? "hsl(45 100% 60%)" : roundWinner === playerKey ? "#22c55e" : "#ef4444",
                    color: "#000",
                    boxShadow: isLastRoundTie ? "0 0 16px hsl(45 100% 60% / 0.6)" : roundWinner === playerKey ? "0 0 16px rgba(34,197,94,0.6)" : "0 0 16px rgba(239,68,68,0.6)",
                  }}
                >
                  {isLastRoundTie ? "CLASH!" : roundWinner === playerKey ? "YOU WIN" : "OPPONENT WINS"}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Big choice buttons */}
        {gameState.status === "choosing" && !myChoiceValue && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { choice: "rock" as const, Icon: HandMetal, label: "Rock",     c: "#f59e0b", g: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.08)", b: "rgba(245,158,11,0.30)" },
              { choice: "paper" as const, Icon: FileText,  label: "Paper",    c: "#3b82f6", g: "rgba(59,130,246,0.35)",  bg: "rgba(59,130,246,0.08)",  b: "rgba(59,130,246,0.30)"  },
              { choice: "scissors" as const, Icon: Scissors,  label: "Scissors", c: "#ef4444", g: "rgba(239,68,68,0.35)",   bg: "rgba(239,68,68,0.08)",   b: "rgba(239,68,68,0.30)"   },
            ].map(({ choice, Icon, label, c, g, bg, b }) => (
              <motion.button
                key={choice}
                onClick={() => makeChoice(choice)}
                data-testid={`button-${choice}`}
                whileHover={{ scale: 1.04, y: -3 }}
                whileTap={{ scale: 0.96 }}
                className="group relative flex flex-col items-center justify-center gap-3 py-7 rounded-2xl border cursor-pointer transition-colors duration-150"
                style={{ background: bg, borderColor: b }}
              >
                <div
                  className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  style={{ boxShadow: `0 0 32px ${g}` }}
                />
                <Icon className="w-12 h-12 sm:w-14 sm:h-14 relative z-10" style={{ color: c }} />
                <span className="text-sm sm:text-base font-bold relative z-10" style={{ color: c }}>
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        )}

        {/* Next round button (non-bot, non-practice, non-tie) */}
        {(gameState.status === "revealing" || gameState.status === "roundComplete") && !gameState.winner && !isLastRoundTie && !match.isBotMatch && !match.isPractice && (
          <div className="flex justify-center">
            <Button size="lg" onClick={handleNextRound} data-testid="button-next-round" className="px-10">
              Next Round →
            </Button>
          </div>
        )}

        {/* Auto-advance indicator */}
        {showTieOverlay && (gameState.status === "revealing" || gameState.status === "roundComplete") && !gameState.winner && (
          <div className="flex justify-center">
            <motion.p
              className="text-sm text-white/40"
              animate={{ opacity: [0.4, 0.9, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              Next round starting automatically…
            </motion.p>
          </div>
        )}

        {/* Round history */}
        {gameState.roundHistory.length > 0 && (
          <div
            className="rounded-xl border p-4"
            style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.03)" }}
          >
            <p className="text-xs text-white/30 uppercase tracking-widest font-medium mb-3">Round History</p>
            <div className="flex flex-wrap gap-2">
              {gameState.roundHistory.map((round, idx) => {
                const pc = isPlayer1 ? round.player1Choice : round.player2Choice;
                const oc = isPlayer1 ? round.player2Choice : round.player1Choice;
                const isTie = round.result === "tie";
                const won = round.result === playerKey;
                const PIc = pc ? choiceIcons[pc] : HelpCircle;
                const OIc = oc ? choiceIcons[oc] : HelpCircle;
                return (
                  <div
                    key={idx}
                    data-testid={`round-history-${idx}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                    style={{
                      background: isTie ? "rgba(251,191,36,0.08)" : won ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
                      borderColor: isTie ? "rgba(251,191,36,0.25)" : won ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
                      color: isTie ? "hsl(45 100% 60%)" : won ? "#4ade80" : "#f87171",
                    }}
                  >
                    <span className="text-white/30 mr-0.5">R{round.roundNumber}</span>
                    {pc && <PIc className="w-3 h-3" />}
                    <span className="text-white/20 text-xs">vs</span>
                    {oc && <OIc className="w-3 h-3" />}
                    <span>{isTie ? "CLASH" : won ? "W" : "L"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GameLayout>
  );
}
