import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Target, TrendingUp } from "lucide-react";
import type { UserStats } from "@shared/schema";

interface UserStatsCardProps {
  stats: UserStats;
}

export default function UserStatsCard({ stats }: UserStatsCardProps) {
  return (
    <Card className="card-depth glass-override" data-testid="card-user-stats">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Your Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center" data-testid="stat-total-matches">
            <div className="text-3xl font-bold font-mono text-foreground mb-1">
              {stats.totalMatches}
            </div>
            <div className="text-sm text-muted-foreground">Total Matches</div>
          </div>
          <div className="text-center" data-testid="stat-wins">
            <div className="text-3xl font-bold font-mono text-chart-3 mb-1">
              {stats.wins}
            </div>
            <div className="text-sm text-muted-foreground">Wins</div>
          </div>
          <div className="text-center" data-testid="stat-losses">
            <div className="text-3xl font-bold font-mono text-chart-4 mb-1">
              {stats.losses}
            </div>
            <div className="text-sm text-muted-foreground">Losses</div>
          </div>
          <div className="text-center" data-testid="stat-win-rate">
            <div className="text-3xl font-bold font-mono text-primary mb-1">
              {stats.winRate}%
            </div>
            <div className="text-sm text-muted-foreground">Win Rate</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
