import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MatchWithPlayers, GameType } from "@shared/schema";
import { Play, Clock, X, Trash2, Smartphone, Monitor } from "lucide-react";
import { SiBitcoin, SiEthereum, SiSolana } from "react-icons/si";
import { Link } from "wouter";
import { gameIcons, gameLabels } from "@/components/GameIcons";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";
import type { DeviceType } from "@/hooks/useDeviceType";

interface MatchCardProps {
  match: MatchWithPlayers;
  currentUserId?: string;
  userDeviceType?: DeviceType;
  onJoin?: () => void;
  isJoining?: boolean;
  onCancel?: () => void;
  isCancelling?: boolean;
  onDelete?: () => void;
  isDeleting?: boolean;
  variant?: "available" | "active";
}

export default function MatchCard({
  match,
  currentUserId,
  userDeviceType,
  onJoin,
  isJoining = false,
  onCancel,
  isCancelling = false,
  onDelete,
  isDeleting = false,
  variant = "available"
}: MatchCardProps) {
  const { convertFromUsd, formatCrypto, hasLoaded } = useCryptoPrices();
  const GameIcon = gameIcons[match.gameType as GameType] || gameIcons.chess;
  const gameLabel = gameLabels[match.gameType as GameType] || match.gameType;
  const isMyMatch = match.player1Id === currentUserId || match.player2Id === currentUserId;

  const potAmount = parseFloat(match.potAmount || "0");
  const hasBet = potAmount > 0;

  const matchDevice = (match as any).deviceType as DeviceType | undefined;
  const isDeviceMismatch = !!(matchDevice && userDeviceType && matchDevice !== userDeviceType);

  return (
    <div className="glass-match-card p-5" data-testid={`match-card-${match.id}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          {/* Game Icon */}
          <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 shadow-md shadow-primary/10">
            <GameIcon className="w-6 h-6 text-primary" />
          </div>

          {/* Match Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h4 className="font-semibold text-lg" data-testid={`text-game-${match.id}`}>{gameLabel}</h4>
              <Badge
                variant={match.status === "in-progress" ? "default" : "secondary"}
                data-testid={`badge-status-${match.id}`}
              >
                {match.status === "waiting" ? (
                  <>
                    <Clock className="w-3 h-3 mr-1" />
                    Waiting
                  </>
                ) : match.status === "in-progress" ? (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    In Progress
                  </>
                ) : (
                  match.status
                )}
              </Badge>

              {/* Device type badge */}
              {matchDevice === "mobile" && (
                <Badge
                  variant="outline"
                  className="border-cyan-500/40 text-cyan-400 bg-cyan-500/10"
                  data-testid={`badge-device-${match.id}`}
                >
                  <Smartphone className="w-3 h-3 mr-1" />
                  Mobile Only
                </Badge>
              )}
              {matchDevice === "desktop" && (
                <Badge
                  variant="outline"
                  className="border-violet-500/40 text-violet-400 bg-violet-500/10"
                  data-testid={`badge-device-${match.id}`}
                >
                  <Monitor className="w-3 h-3 mr-1" />
                  Desktop Only
                </Badge>
              )}

              {hasBet && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="default" className="bg-emerald-600 cursor-help" data-testid={`badge-pot-${match.id}`}>
                      {potAmount.toFixed(2)} S
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="p-2" data-testid={`tooltip-crypto-${match.id}`}>
                    {hasLoaded ? (
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1" data-testid={`crypto-btc-${match.id}`}>
                          <SiBitcoin className="w-3 h-3 text-orange-500" />
                          <span>{formatCrypto(convertFromUsd(potAmount, "btc"), "btc")} BTC</span>
                        </div>
                        <div className="flex items-center gap-1" data-testid={`crypto-eth-${match.id}`}>
                          <SiEthereum className="w-3 h-3 text-blue-500" />
                          <span>{formatCrypto(convertFromUsd(potAmount, "eth"), "eth")} ETH</span>
                        </div>
                        <div className="flex items-center gap-1" data-testid={`crypto-sol-${match.id}`}>
                          <SiSolana className="w-3 h-3 text-purple-500" />
                          <span>{formatCrypto(convertFromUsd(potAmount, "sol"), "sol")} SOL</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Loading rates...</div>
                    )}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Players */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Avatar className="w-6 h-6">
                  <AvatarImage src={match.player1?.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                  <AvatarFallback className="text-xs">
                    {match.player1?.firstName?.[0] || match.player1?.email?.[0] || "P1"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground truncate max-w-[120px]" data-testid={`text-player1-${match.id}`}>
                  {match.player1?.firstName || match.player1?.email?.split('@')[0] || "Player 1"}
                </span>
              </div>

              <span className="text-muted-foreground text-xs font-medium">vs</span>

              {match.player2 ? (
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={match.player2.profileImageUrl || undefined} style={{ objectFit: 'cover' }} />
                    <AvatarFallback className="text-xs">
                      {match.player2.firstName?.[0] || match.player2.email?.[0] || "P2"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground truncate max-w-[120px]" data-testid={`text-player2-${match.id}`}>
                    {match.player2.firstName || match.player2.email?.split('@')[0] || "Player 2"}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic">Waiting for player...</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 w-full sm:w-auto flex gap-2">
          {variant === "active" && isMyMatch ? (
            <>
              {(match.isBotMatch || match.isPractice) && onDelete && (
                <Button
                  onClick={onDelete}
                  disabled={isDeleting}
                  variant="outline"
                  size="sm"
                  className="flex-shrink-0 rounded-xl"
                  data-testid={`button-delete-${match.id}`}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {isDeleting ? "Deleting..." : "Delete"}
                </Button>
              )}

              {match.status === "waiting" && match.player1Id === currentUserId && onCancel ? (
                <Button
                  onClick={onCancel}
                  disabled={isCancelling}
                  variant="destructive"
                  size="sm"
                  className="flex-shrink-0 rounded-xl"
                  data-testid={`button-cancel-${match.id}`}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              ) : (
                <Link href={`/game/${match.id}`}>
                  <Button size="sm" className="flex-shrink-0 rounded-xl" data-testid={`button-continue-${match.id}`}>
                    <Play className="w-4 h-4 mr-2" />
                    Continue
                  </Button>
                </Link>
              )}
            </>
          ) : variant === "available" && onJoin ? (
            isDeviceMismatch ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full sm:w-auto">
                    <Button
                      disabled
                      variant="outline"
                      className="w-full rounded-xl border-cyan-500/30 text-cyan-400/60 cursor-not-allowed"
                      data-testid={`button-join-${match.id}`}
                    >
                      <Smartphone className="w-4 h-4 mr-2" />
                      {matchDevice === "mobile" ? "Mobile Only" : "Desktop Only"}
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {matchDevice === "mobile"
                    ? "Available on mobile devices only"
                    : "Available on desktop only"}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                onClick={onJoin}
                disabled={isJoining}
                className="w-full sm:w-auto rounded-xl"
                data-testid={`button-join-${match.id}`}
              >
                {isJoining ? "Joining..." : "Join Match"}
              </Button>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
