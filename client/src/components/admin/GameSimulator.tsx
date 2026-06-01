import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Play, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function GameSimulator() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [gameType, setGameType] = useState("chess");
  const [count, setCount] = useState("5");
  const [betAmount, setBetAmount] = useState("10");
  const [difficulty, setDifficulty] = useState("medium");

  const simulateMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("User not found");
      
      return await apiRequest("POST", "/api/admin/simulate-games", {
        gameType,
        count: parseInt(count),
        betAmount,
        difficulty,
        userId: user.id,
      });
    },
    onSuccess: (data: any) => {
      const wins = data.results.filter((r: any) => r.winner === "player").length;
      const losses = data.results.filter((r: any) => r.winner === "bot").length;
      
      toast({
        title: "Simulation Complete",
        description: `Successfully simulated ${data.gamesSimulated} games. Won: ${wins}, Lost: ${losses}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Simulation Failed",
        description: error.message || "Failed to simulate games",
        variant: "destructive",
      });
    },
  });

  const handleSimulate = () => {
    // Validate count
    const numCount = Number(count);
    if (!count || !Number.isFinite(numCount) || numCount <= 0 || numCount > 50) {
      toast({
        title: "Invalid Count",
        description: "Please enter a valid number between 1 and 50",
        variant: "destructive",
      });
      return;
    }

    // Validate bet amount
    const numBet = Number(betAmount);
    if (!betAmount || !Number.isFinite(numBet) || numBet <= 0) {
      toast({
        title: "Invalid Bet Amount",
        description: "Please enter a valid bet amount greater than 0",
        variant: "destructive",
      });
      return;
    }

    // Ensure count is an integer
    if (!Number.isInteger(numCount)) {
      toast({
        title: "Invalid Count",
        description: "Count must be a whole number",
        variant: "destructive",
      });
      return;
    }

    // Enforce reasonable maximum bet
    const MAX_BET = 1000000;
    if (numBet > MAX_BET) {
      toast({
        title: "Bet Too Large",
        description: `Bet amount cannot exceed $${MAX_BET.toLocaleString()}`,
        variant: "destructive",
      });
      return;
    }

    // Check for total overflow
    const totalRequired = numBet * numCount;
    if (!Number.isFinite(totalRequired)) {
      toast({
        title: "Calculation Overflow",
        description: "Total bet amount is too large - please reduce bet or game count",
        variant: "destructive",
      });
      return;
    }
    
    simulateMutation.mutate();
  };

  return (
    <Card className="card-depth">
      <CardHeader>
        <CardTitle>Game Simulator</CardTitle>
        <CardDescription>
          Simulate bot games with betting to generate statistics and test the platform
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="game-type">Game Type</Label>
            <Select value={gameType} onValueChange={setGameType}>
              <SelectTrigger id="game-type" data-testid="select-game-type">
                <SelectValue placeholder="Select game type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chess">Chess</SelectItem>
                <SelectItem value="mini-golf">Mini Golf</SelectItem>
                <SelectItem value="connect-4">Connect 4</SelectItem>
                <SelectItem value="air-hockey">Air Hockey</SelectItem>
                <SelectItem value="rock-paper-scissors">Rock Paper Scissors</SelectItem>
                <SelectItem value="dots-and-boxes">Dots & Boxes</SelectItem>
                <SelectItem value="8-ball">8-Ball Pool</SelectItem>
                <SelectItem value="bowling">Bowling</SelectItem>
                <SelectItem value="cup-king">Cup King</SelectItem>
                <SelectItem value="stack-tower">Stack Tower</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="difficulty">Bot Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger id="difficulty" data-testid="select-difficulty">
                <SelectValue placeholder="Select difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy (70% win rate)</SelectItem>
                <SelectItem value="medium">Medium (60% win rate)</SelectItem>
                <SelectItem value="hard">Hard (50% win rate)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">Number of Games</Label>
            <Input
              id="count"
              type="number"
              min="1"
              max="50"
              value={count}
              onChange={(e) => setCount(e.target.value)}
              data-testid="input-game-count"
            />
            <p className="text-xs text-muted-foreground">Maximum: 50 games</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bet-amount">Bet Amount (SCALPS)</Label>
            <Input
              id="bet-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              data-testid="input-bet-amount"
            />
            <p className="text-xs text-muted-foreground">Per game bet amount</p>
          </div>
        </div>

        <div className="pt-4">
          <Button
            onClick={handleSimulate}
            disabled={simulateMutation.isPending}
            className="w-full md:w-auto"
            data-testid="button-simulate-games"
          >
            {simulateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
        </div>

        <div className="pt-2 space-y-1 text-xs text-muted-foreground border-t">
          <p>• Games are simulated with realistic scores and outcomes</p>
          <p>• All stats, ratings, and transactions are updated</p>
          <p>• Win rates vary based on bot difficulty</p>
          <p>• Check your dashboard and leaderboards to see the generated stats</p>
        </div>
      </CardContent>
    </Card>
  );
}
