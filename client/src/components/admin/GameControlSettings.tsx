import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Info } from "lucide-react";
import type { GameSettings } from "@shared/schema";
import { ChessIcon, MiniGolfIcon, Connect4Icon, AirHockeyIcon } from "@/components/GameIcons";
import GameSimulator from "./GameSimulator";

export default function GameControlSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    platformRake: "5.00",
    minBet: "5.00",
    maxBet: "1000.00",
    chessEnabled: true,
    miniGolfEnabled: true,
    connect4Enabled: true,
    airHockeyEnabled: true,
    newUserBonus: "100.00",
  });

  const { data: gameSettings, isLoading } = useQuery<GameSettings>({
    queryKey: ["/api/admin/game-settings"],
  });

  // Update local state when data is loaded
  useEffect(() => {
    if (gameSettings) {
      setSettings({
        platformRake: gameSettings.platformRake,
        minBet: gameSettings.minBet,
        maxBet: gameSettings.maxBet,
        chessEnabled: gameSettings.chessEnabled,
        miniGolfEnabled: gameSettings.miniGolfEnabled,
        connect4Enabled: gameSettings.connect4Enabled,
        airHockeyEnabled: gameSettings.airHockeyEnabled,
        newUserBonus: gameSettings.newUserBonus,
      });
    }
  }, [gameSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<GameSettings>) => {
      return await apiRequest("PATCH", "/api/admin/game-settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/game-settings"] });
      toast({
        title: "Settings Saved",
        description: "Game control settings have been updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    updateSettingsMutation.mutate(settings);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const gameControls = [
    {
      id: "chess",
      name: "Chess",
      icon: ChessIcon,
      enabled: settings.chessEnabled,
      onChange: (checked: boolean) => setSettings({ ...settings, chessEnabled: checked }),
    },
    {
      id: "mini-golf",
      name: "Mini Golf",
      icon: MiniGolfIcon,
      enabled: settings.miniGolfEnabled,
      onChange: (checked: boolean) => setSettings({ ...settings, miniGolfEnabled: checked }),
    },
    {
      id: "connect-4",
      name: "Connect 4",
      icon: Connect4Icon,
      enabled: settings.connect4Enabled,
      onChange: (checked: boolean) => setSettings({ ...settings, connect4Enabled: checked }),
    },
    {
      id: "air-hockey",
      name: "Air Hockey",
      icon: AirHockeyIcon,
      enabled: settings.airHockeyEnabled,
      onChange: (checked: boolean) => setSettings({ ...settings, airHockeyEnabled: checked }),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">Game Control Settings</h2>
        <p className="text-muted-foreground">Configure platform-wide game settings and parameters</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Platform Settings */}
        <Card className="card-depth">
          <CardHeader>
            <CardTitle>Platform Settings</CardTitle>
            <CardDescription>Global platform configuration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform-rake">Platform Rake (%)</Label>
              <Input
                id="platform-rake"
                type="number"
                min="0"
                max="20"
                step="0.01"
                value={settings.platformRake}
                onChange={(e) => setSettings({ ...settings, platformRake: e.target.value })}
                data-testid="input-platform-rake"
              />
              <p className="text-xs text-muted-foreground">
                Percentage taken from each match pot
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-user-bonus">New User Bonus ($)</Label>
              <Input
                id="new-user-bonus"
                type="number"
                min="0"
                step="0.01"
                value={settings.newUserBonus}
                onChange={(e) => setSettings({ ...settings, newUserBonus: e.target.value })}
                data-testid="input-new-user-bonus"
              />
              <p className="text-xs text-muted-foreground">
                Starting balance for new users
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Betting Limits */}
        <Card className="card-depth">
          <CardHeader>
            <CardTitle>Betting Limits</CardTitle>
            <CardDescription>Configure minimum and maximum bets</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="min-bet">Minimum Bet (SCALPS)</Label>
              <Input
                id="min-bet"
                type="number"
                min="1"
                step="0.01"
                value={settings.minBet}
                onChange={(e) => setSettings({ ...settings, minBet: e.target.value })}
                data-testid="input-min-bet"
              />
              <p className="text-xs text-muted-foreground">
                Lowest allowed bet amount
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-bet">Maximum Bet (SCALPS)</Label>
              <Input
                id="max-bet"
                type="number"
                min="1"
                step="0.01"
                value={settings.maxBet}
                onChange={(e) => setSettings({ ...settings, maxBet: e.target.value })}
                data-testid="input-max-bet"
              />
              <p className="text-xs text-muted-foreground">
                Highest allowed bet amount
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Game Availability */}
      <Card className="card-depth">
        <CardHeader>
          <CardTitle>Game Availability</CardTitle>
          <CardDescription>Enable or disable specific games</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {gameControls.map((game) => {
              const Icon = game.icon;
              return (
                <div
                  key={game.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                  data-testid={`game-control-${game.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-primary/10">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">{game.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {game.enabled ? "Currently enabled" : "Currently disabled"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={game.enabled}
                    onCheckedChange={game.onChange}
                    data-testid={`switch-${game.id}`}
                  />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Game Simulator */}
      <GameSimulator />

      {/* Information Card */}
      <Card className="card-depth border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            • Game settings changes take effect immediately for new matches
          </p>
          <p>
            • Existing matches will continue with their original settings
          </p>
          <p>
            • Disabling a game will prevent new matches from being created
          </p>
          <p>
            • Changes to rake percentage affect all new matches going forward
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          size="lg"
          disabled={updateSettingsMutation.isPending}
          data-testid="button-save-settings"
        >
          {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
