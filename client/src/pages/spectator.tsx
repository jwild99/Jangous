import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Wifi, WifiOff, ArrowLeft, Users, Trophy } from "lucide-react";
import { Link } from "wouter";
import type { MatchWithPlayers } from "@shared/schema";

function getGameLabel(gameType: string): string {
  const labels: Record<string, string> = {
    chess: "Chess", "mini-golf": "Mini Golf", connect4: "Connect 4",
    "air-hockey": "Air Hockey", "block-blast": "Block Blast",
    "rock-paper-scissors": "Rock Paper Scissors", "dots-and-boxes": "Dots & Boxes",
    "8-ball": "8-Ball Pool", bowling: "Bowling", "cup-king": "Cup King",
    "stack-tower": "Stack Tower",
  };
  return labels[gameType] ?? gameType;
}

export default function SpectatorPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [gameState, setGameState] = useState<any>(null);
  const [gameType, setGameType] = useState<string>("");
  const [matchComplete, setMatchComplete] = useState(false);

  const { data: match } = useQuery<MatchWithPlayers>({
    queryKey: ["/api/matches", matchId],
    queryFn: async () => {
      const res = await fetch(`/api/matches/${matchId}`);
      if (!res.ok) throw new Error("Match not found");
      return res.json();
    },
    enabled: !!matchId,
  });

  const connect = useCallback(() => {
    if (!matchId) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: "spectate", matchId }));
    };

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data);
        if (data.type === "spectator-count" && data.matchId === matchId) {
          setSpectatorCount(data.count);
        } else if (data.type === "game-state" && data.matchId === matchId) {
          setGameState(data.gameState);
          setGameType(data.gameType ?? "");
        } else if (data.type === "gameStateUpdate" || data.type === "boardUpdate") {
          if (data.matchId === matchId || data.gameType) {
            setGameState(data.gameState ?? data.board ?? data.state);
          }
        } else if (data.type === "matchComplete" && data.matchId === matchId) {
          setMatchComplete(true);
          setGameState(data.gameState);
        }
      } catch {}
    };

    ws.onclose = () => {
      setConnected(false);
    };
  }, [matchId]);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "leave-spectate", matchId }));
        wsRef.current.close();
      }
    };
  }, [connect, matchId]);

  const player1Name = match?.player1
    ? match.player1.username ?? match.player1.firstName ?? "Player 1"
    : "Player 1";
  const player2Name = match?.player2
    ? match.player2.username ?? match.player2.firstName ?? "Player 2"
    : "Player 2";

  return (
    <div className="min-h-screen bg-[#050810]">
      <AppNavbar />
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <Link href="/">
            <Button variant="ghost" size="sm" className="text-white/60" data-testid="btn-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
          </Link>
          <div className="flex items-center gap-2 ml-auto flex-wrap gap-2">
            <Badge className={`${connected ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
              {connected ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
              {connected ? "Live" : "Disconnected"}
            </Badge>
            <Badge className="bg-white/10 text-white/60 border-white/10">
              <Users className="w-3 h-3 mr-1" /> {spectatorCount} watching
            </Badge>
          </div>
        </div>

        {/* Match Info */}
        <Card className="card-depth border-white/10 bg-white/3 mb-6">
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                <Eye className="w-3 h-3 mr-1" /> Spectating
              </Badge>
              {match && (
                <Badge className="bg-white/10 text-white/60 border-white/10">
                  {getGameLabel(match.gameType)}
                </Badge>
              )}
              {matchComplete && (
                <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
                  <Trophy className="w-3 h-3 mr-1" /> Match Complete
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-center gap-8 py-4">
              <div className="text-center">
                {match?.player1?.profileImageUrl ? (
                  <img src={match.player1.profileImageUrl} className="w-14 h-14 rounded-full mx-auto mb-2 object-cover border-2 border-white/20" alt={player1Name} />
                ) : (
                  <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-blue-500/30 flex items-center justify-center text-xl font-bold text-blue-300">
                    {player1Name[0]?.toUpperCase()}
                  </div>
                )}
                <p className="font-bold text-white" data-testid="player1-name">{player1Name}</p>
              </div>
              <div className="text-2xl font-black text-white/30">VS</div>
              <div className="text-center">
                {match?.player2?.profileImageUrl ? (
                  <img src={match.player2.profileImageUrl} className="w-14 h-14 rounded-full mx-auto mb-2 object-cover border-2 border-white/20" alt={player2Name} />
                ) : (
                  <div className="w-14 h-14 rounded-full mx-auto mb-2 bg-pink-500/30 flex items-center justify-center text-xl font-bold text-pink-300">
                    {player2Name[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <p className="font-bold text-white" data-testid="player2-name">{player2Name}</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Game State Display */}
        <AnimatePresence mode="wait">
          {!connected ? (
            <motion.div key="connecting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="card-depth border-white/10 bg-white/3 p-12 text-center">
                <div className="animate-pulse flex flex-col items-center gap-3">
                  <WifiOff className="w-10 h-10 text-white/30" />
                  <p className="text-white/50">Connecting to live match…</p>
                  <Button size="sm" onClick={connect} variant="outline">Reconnect</Button>
                </div>
              </Card>
            </motion.div>
          ) : !gameState ? (
            <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Card className="card-depth border-white/10 bg-white/3 p-12 text-center">
                <Eye className="w-10 h-10 text-blue-400 mx-auto mb-3 animate-pulse" />
                <p className="text-white/70 font-semibold">Waiting for game state…</p>
                <p className="text-white/40 text-sm mt-1">The match will appear here once a move is made.</p>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="state" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="card-depth border-white/10 bg-white/3 p-5">
                <p className="text-xs text-white/40 font-semibold uppercase tracking-wider mb-3">Live Game State</p>
                <pre className="text-xs text-white/70 overflow-auto max-h-96 rounded-lg bg-black/30 p-3 leading-relaxed">
                  {JSON.stringify(gameState, null, 2).slice(0, 2000)}
                  {JSON.stringify(gameState, null, 2).length > 2000 ? "\n… (truncated)" : ""}
                </pre>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {matchComplete && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-4 text-center">
            <p className="text-white/50 mb-3">This match has ended.</p>
            <Link href="/">
              <Button>Find Another Match to Watch</Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
