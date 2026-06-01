import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Search, ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { MatchWithPlayers } from "@shared/schema";
import { ChessIcon, MiniGolfIcon, Connect4Icon } from "@/components/GameIcons";

type FairPlayMatch = MatchWithPlayers & { verificationHash: string };

const gameIcons = {
  chess: ChessIcon,
  "mini-golf": MiniGolfIcon,
  "connect-4": Connect4Icon,
};

const gameLabels = {
  chess: "Chess",
  "mini-golf": "Mini Golf",
  "connect-4": "Connect 4",
};

export default function DisputeReview() {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<FairPlayMatch | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const itemsPerPage = 20;

  const offset = page * itemsPerPage;
  const { data: fairPlayLog, isLoading } = useQuery<FairPlayMatch[]>({
    queryKey: [`/api/stats/fair-play-log?limit=${itemsPerPage}&offset=${offset}`],
  });

  const filteredLog = fairPlayLog?.filter((match) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const player1Name = match.player1?.firstName || match.player1?.email || "";
    const player2Name = match.player2?.firstName || match.player2?.email || "";
    return (
      player1Name.toLowerCase().includes(query) ||
      player2Name.toLowerCase().includes(query) ||
      match.id.toLowerCase().includes(query) ||
      match.verificationHash.toLowerCase().includes(query)
    );
  });

  const handleViewDetails = (match: FairPlayMatch) => {
    setSelectedMatch(match);
    setDetailsOpen(true);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Match Dispute Review</h2>
        <p className="text-muted-foreground">
          Review match fairness logs with cryptographic verification for dispute resolution
        </p>
      </div>

      {/* Search */}
      <Card className="card-depth">
        <CardHeader>
          <CardTitle className="text-base">Search Matches</CardTitle>
          <CardDescription>
            Search by player name, match ID, or verification hash
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Search className="w-5 h-5 text-muted-foreground mt-2" />
            <Input
              placeholder="Search matches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-md"
              data-testid="input-search-matches"
            />
          </div>
        </CardContent>
      </Card>

      {/* Match List */}
      <Card className="card-depth">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <CardTitle>Fair Play Match Log</CardTitle>
              <CardDescription>
                Server-verified match results with SHA-256 cryptographic proof
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredLog && filteredLog.length > 0 ? (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Match ID</TableHead>
                      <TableHead>Game</TableHead>
                      <TableHead>Players</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Pot/Rake</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Verification Hash</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLog.map((match) => {
                      const GameIcon = gameIcons[match.gameType as keyof typeof gameIcons];
                      const player1Name =
                        match.player1?.firstName || match.player1?.email?.split("@")[0] || "Unknown";
                      const player2Name =
                        match.player2?.firstName || match.player2?.email?.split("@")[0] || "Unknown";
                      const winnerId = match.winnerId;
                      const winnerName =
                        winnerId === match.player1Id
                          ? player1Name
                          : winnerId === match.player2Id
                            ? player2Name
                            : "Draw";

                      return (
                        <TableRow key={match.id} data-testid={`dispute-row-${match.id}`}>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {match.id.substring(0, 8)}...
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {GameIcon && <GameIcon className="w-5 h-5" />}
                              <span className="font-medium">
                                {gameLabels[match.gameType as keyof typeof gameLabels] ?? match.gameType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className={winnerId === match.player1Id ? "font-semibold" : ""}>
                                  {player1Name}
                                </span>
                              </div>
                              <div className="text-sm">
                                <span className={winnerId === match.player2Id ? "font-semibold" : ""}>
                                  {player2Name}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {winnerId ? (
                              <Badge variant="default" className="bg-primary/20 text-primary">
                                <Trophy className="w-3 h-3 mr-1" />
                                {winnerName}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Draw</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-mono">
                              {match.player1Score} - {match.player2Score}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-mono text-xs">
                                ${match.potAmount || "0.00"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Rake: ${match.rakeAmount || "0.00"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-muted-foreground">
                              {match.completedAt
                                ? formatDistanceToNow(new Date(match.completedAt), { addSuffix: true })
                                : "N/A"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                              {match.verificationHash.substring(0, 16)}...
                            </code>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewDetails(match)}
                              data-testid={`button-view-details-${match.id}`}
                            >
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {filteredLog.length > 0
                    ? `Showing ${filteredLog.length} match${filteredLog.length !== 1 ? "es" : ""}`
                    : "No matches found"}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={!fairPlayLog || fairPlayLog.length < itemsPerPage}
                    data-testid="button-next-page"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No match data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Match Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="dialog-match-details">
          <DialogHeader>
            <DialogTitle>Match Details & Verification</DialogTitle>
            <DialogDescription>
              Complete match information for dispute resolution
            </DialogDescription>
          </DialogHeader>

          {selectedMatch && (
            <div className="space-y-6">
              {/* Match Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Match ID</Label>
                  <div className="font-mono text-sm mt-1">{selectedMatch.id}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Game Type</Label>
                  <div className="text-sm mt-1">
                    {gameLabels[selectedMatch.gameType as keyof typeof gameLabels]}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Player 1</Label>
                  <div className="text-sm mt-1">
                    {selectedMatch.player1?.firstName} {selectedMatch.player1?.lastName} (
                    {selectedMatch.player1?.email})
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Player 2</Label>
                  <div className="text-sm mt-1">
                    {selectedMatch.player2?.firstName} {selectedMatch.player2?.lastName} (
                    {selectedMatch.player2?.email})
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Final Score</Label>
                  <div className="text-sm mt-1 font-mono">
                    {selectedMatch.player1Score} - {selectedMatch.player2Score}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Winner</Label>
                  <div className="text-sm mt-1">
                    {selectedMatch.winnerId
                      ? selectedMatch.winnerId === selectedMatch.player1Id
                        ? `${selectedMatch.player1?.firstName} (Player 1)`
                        : `${selectedMatch.player2?.firstName} (Player 2)`
                      : "Draw"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Pot Amount</Label>
                  <div className="text-sm mt-1 font-mono">${selectedMatch.potAmount || "0.00"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Rake Amount</Label>
                  <div className="text-sm mt-1 font-mono">${selectedMatch.rakeAmount || "0.00"}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Started At</Label>
                  <div className="text-sm mt-1">
                    {selectedMatch.startedAt
                      ? new Date(selectedMatch.startedAt).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Completed At</Label>
                  <div className="text-sm mt-1">
                    {selectedMatch.completedAt
                      ? new Date(selectedMatch.completedAt).toLocaleString()
                      : "N/A"}
                  </div>
                </div>
              </div>

              {/* Verification Hash */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <Label className="text-xs text-muted-foreground">SHA-256 Verification Hash</Label>
                <div className="font-mono text-xs mt-2 break-all bg-background p-2 rounded border">
                  {selectedMatch.verificationHash}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This cryptographic hash proves the match result was server-verified and tamper-evident.
                  Hash formula: SHA-256(matchId:gameType:winnerId:scores:timestamp)
                </p>
              </div>

              {/* Game State */}
              {selectedMatch.gameState != null && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Game State (JSON)
                  </Label>
                  <div className="bg-muted/50 p-4 rounded-lg text-xs overflow-x-auto max-h-64 overflow-y-auto font-mono">
                    {JSON.stringify(selectedMatch.gameState as Record<string, unknown>, null, 2)}
                  </div>
                </div>
              )}

              {/* PGN Moves (Chess) */}
              {selectedMatch.pgnMoves && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">PGN Moves (Chess)</Label>
                  <pre className="bg-muted/50 p-4 rounded-lg text-xs overflow-x-auto">
                    {selectedMatch.pgnMoves}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
