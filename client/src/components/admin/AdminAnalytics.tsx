import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, DollarSign, Activity, TrendingUp, Percent, Gamepad2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function AdminAnalytics() {
  const { data: analytics, isLoading } = useQuery<{
    totalUsers: number;
    totalMatches: number;
    totalRevenue: string;
    totalRakedMatches: number;
    activeUsers24h: number;
    matchesLast24h: number;
  }>({
    queryKey: ["/api/admin/analytics"],
  });

  const { data: revenueByGame, isLoading: revenueLoading } = useQuery<Array<{
    gameType: string;
    totalRevenue: string;
    matchCount: number;
  }>>({
    queryKey: ["/api/admin/analytics/revenue-by-game"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="card-depth">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const totalRevenue = parseFloat(analytics?.totalRevenue || "0");
  const totalRakedMatches = analytics?.totalRakedMatches || 0;
  const averageRakePerMatch = totalRakedMatches > 0 ? totalRevenue / totalRakedMatches : 0;

  const stats = [
    {
      title: "Total Users",
      value: analytics?.totalUsers.toLocaleString() || "0",
      icon: Users,
      description: "Registered players",
      color: "text-blue-500",
      testId: "stat-total-users",
    },
    {
      title: "Total Matches",
      value: analytics?.totalMatches.toLocaleString() || "0",
      icon: Trophy,
      description: "Games played",
      color: "text-green-500",
      testId: "stat-total-matches",
    },
    {
      title: "Platform Revenue",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      description: "3% rake collected from all matches",
      color: "text-chart-3",
      testId: "stat-total-revenue",
      highlight: true,
    },
    {
      title: "Active Users (24h)",
      value: analytics?.activeUsers24h.toLocaleString() || "0",
      icon: Activity,
      description: "Users in last 24 hours",
      color: "text-purple-500",
      testId: "stat-active-users",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Platform Analytics</h2>
        <p className="text-muted-foreground">Real-time metrics and platform statistics</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card 
              key={stat.title} 
              data-testid={stat.testId}
              className={`card-depth ${stat.highlight ? "border-chart-3/50 bg-chart-3/5" : ""}`}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`${stat.testId}-value`}>
                  {stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="card-depth border-primary/50 bg-primary/5" data-testid="card-rake-policy">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-primary" />
              Platform Rake Policy
            </CardTitle>
            <CardDescription>Jango.us's revenue model</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Rake Percentage</span>
                <Badge variant="default" className="text-base font-mono" data-testid="badge-rake-percentage">
                  3%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Applied to every completed match with a pot
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Winner Receives</span>
                <Badge variant="secondary" className="text-base font-mono" data-testid="badge-winner-percentage">
                  97%
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Of the total pot after rake deduction
              </p>
            </div>
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average Rake/Match</span>
                <span className="text-lg font-bold text-primary font-mono" data-testid="text-avg-rake">
                  ${averageRakePerMatch.toFixed(2)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="card-depth" data-testid="card-24h-activity">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Last 24 Hours Activity
            </CardTitle>
            <CardDescription>Recent platform activity summary</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Matches Played</span>
              <span className="text-2xl font-bold text-primary font-mono" data-testid="matches-24h-value">
                {analytics?.matchesLast24h.toLocaleString() || "0"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Active Players</span>
              <span className="text-2xl font-bold text-primary font-mono" data-testid="active-users-24h-value">
                {analytics?.activeUsers24h.toLocaleString() || "0"}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="card-depth" data-testid="card-revenue-by-game">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-primary" />
            Revenue by Game Type
          </CardTitle>
          <CardDescription>Platform revenue breakdown across different games</CardDescription>
        </CardHeader>
        <CardContent>
          {revenueLoading ? (
            <div className="h-80 flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : !revenueByGame || revenueByGame.length === 0 ? (
            <div className="h-80 flex items-center justify-center text-muted-foreground">
              No revenue data available
            </div>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={(revenueByGame || []).map(item => ({
                  name: item.gameType === "chess" ? "Chess" : item.gameType === "mini-golf" ? "Mini Golf" : item.gameType === "connect-4" ? "Connect 4" : "Air Hockey",
                  revenue: parseFloat(item.totalRevenue),
                  matches: item.matchCount,
                }))} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                  <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "revenue" ? `$${value.toFixed(2)}` : value,
                      name === "revenue" ? "Revenue" : "Matches"
                    ]}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {revenueByGame?.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={index === 0 ? "hsl(var(--chart-1))" : index === 1 ? "hsl(var(--chart-2))" : index === 2 ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="grid gap-4 md:grid-cols-4">
                {revenueByGame?.map((game, index) => (
                  <div key={game.gameType} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-sm" 
                        style={{ 
                          backgroundColor: index === 0 ? "hsl(var(--chart-1))" : index === 1 ? "hsl(var(--chart-2))" : index === 2 ? "hsl(var(--chart-3))" : "hsl(var(--chart-4))"
                        }}
                      />
                      <span className="text-sm font-medium">
                        {game.gameType === "chess" ? "Chess" : game.gameType === "mini-golf" ? "Mini Golf" : game.gameType === "connect-4" ? "Connect 4" : "Air Hockey"}
                      </span>
                    </div>
                    <div className="ml-5 space-y-1">
                      <div className="text-2xl font-bold text-primary font-mono">
                        ${parseFloat(game.totalRevenue).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {game.matchCount} matches
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
