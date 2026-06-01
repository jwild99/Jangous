import type { MatchWithPlayers } from "@shared/schema";

export function getBotOpponentName(match: MatchWithPlayers): string {
  if (match.isBotMatch) {
    const diff = match.botDifficulty;
    const label = diff ? diff.charAt(0).toUpperCase() + diff.slice(1) : "AI";
    return `Bot (${label})`;
  }
  return (
    match.player2?.username ??
    match.player2?.firstName ??
    match.player2?.email?.split("@")[0] ??
    "Waiting..."
  );
}

export function getBotOpponentInitial(match: MatchWithPlayers): string {
  if (match.isBotMatch) return "B";
  return match.player2?.username?.[0] ?? match.player2?.firstName?.[0] ?? "P2";
}
