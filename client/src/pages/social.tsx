import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { motion, AnimatePresence } from "framer-motion";
import {
  Rss, MessageCircle, Users, ThumbsUp, Flame, Crown, Skull, HandMetal,
  Send, ChevronDown, ChevronUp, MoreHorizontal, Flag, VolumeX,
  Swords, TrendingUp, Loader2, Paperclip, Trophy, Star, Shield, Hash,
  Copy, MessageSquare, Gamepad2, Target, DollarSign, Smile,
  PanelRightClose, PanelRight, ArrowLeft, Zap, Circle, ChevronRight,
} from "lucide-react";
import { RankBadge } from "@/components/RankBadge";
import CreateMatchDialog from "@/components/CreateMatchDialog";
import type { User, FriendshipWithUsers, ChatMessage, DirectMessage } from "@shared/schema";
import { format, isToday, isYesterday } from "date-fns";

type ChatMessageWithUser = ChatMessage & { user: User | null };
type DirectMessageWithUser = DirectMessage & { sender: User; recipient: User };
type Conversation = { friend: User; lastMessage: DirectMessageWithUser; unreadCount: number };
type ChannelView = { kind: "global"; channelId: string } | { kind: "dm"; friend: User };

const GLOBAL_CHANNELS = [
  { id: "general",   label: "General",    icon: Hash },
  { id: "lobby",     label: "Lobby",      icon: Gamepad2 },
  { id: "strategy",  label: "Strategy",   icon: Target },
  { id: "bets",      label: "Bets",       icon: DollarSign },
  { id: "wins",      label: "Wins",       icon: Trophy },
  { id: "off-topic", label: "Off Topic",  icon: MessageSquare },
];

const GAME_CHANNELS = [
  { id: "chess",       label: "Chess",         icon: Crown },
  { id: "mini-golf",   label: "Mini Golf",      icon: Flag },
  { id: "connect4",    label: "Connect 4",      icon: Circle },
  { id: "air-hockey",  label: "Air Hockey",     icon: Zap },
  { id: "rps",         label: "Rock Paper Sc.", icon: Swords },
  { id: "dots-boxes",  label: "Dots & Boxes",   icon: Hash },
  { id: "8ball",       label: "8-Ball Pool",    icon: Circle },
  { id: "bowling",     label: "Bowling",        icon: Target },
  { id: "cup-king",    label: "Cup King",       icon: Gamepad2 },
  { id: "tower-stack", label: "Tower Stack",    icon: Zap },
];

const EMOJIS = [
  "\u{1F600}","\u{1F602}","\u{1F60D}","\u{1F914}","\u{1F60E}","\u{1F525}","\u{1F4AF}","\u{1F44D}","\u{1F44E}","\u{2764}\u{FE0F}",
  "\u{1F3AE}","\u{1F3C6}","\u{1F4B0}","\u{26A1}","\u{1F3AF}","\u{1F3B2}","\u{1F0CF}","\u{265F}\u{FE0F}","\u{1F3B3}","\u{1F3D2}",
  "\u{1F91D}","\u{1F4AA}","\u{1F44F}","\u{1F64C}","\u{1F624}","\u{1F605}","\u{1F923}","\u{1F62D}","\u{1F631}","\u{1F973}",
];

interface SocialAuthor {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  profileImageUrl: string | null;
  nicknameColor: string | null;
  chessRating?: number | null;
  level?: number | null;
}

interface SocialReply {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string | null;
  author: SocialAuthor | null;
}

interface SocialPostData {
  id: string;
  authorId: string;
  subjectUserId: string | null;
  type: string;
  content: string;
  createdAt: string | null;
  author: SocialAuthor | null;
  subjectUser: SocialAuthor | null;
  replies: SocialReply[];
  reactionCounts: Record<string, number>;
  userReactions: string[];
}

const POST_TYPE_CONFIG: Record<string, { label: string; icon: typeof Hash; color: string }> = {
  general: { label: "General", icon: Hash, color: "text-blue-400" },
  win: { label: "Win", icon: Trophy, color: "text-yellow-400" },
  challenge: { label: "Challenge", icon: Swords, color: "text-orange-400" },
  achievement: { label: "Achievement", icon: Star, color: "text-purple-400" },
  clan: { label: "Clan", icon: Shield, color: "text-emerald-400" },
  auto: { label: "Platform", icon: TrendingUp, color: "text-cyan-400" },
};

const REACTION_CONFIG: Record<string, { icon: typeof ThumbsUp; label: string; activeColor: string }> = {
  like: { icon: ThumbsUp, label: "Like", activeColor: "text-blue-400 bg-blue-400/15 border-blue-400/30" },
  fire: { icon: Flame, label: "Fire", activeColor: "text-orange-400 bg-orange-400/15 border-orange-400/30" },
  crown: { icon: Crown, label: "Crown", activeColor: "text-yellow-400 bg-yellow-400/15 border-yellow-400/30" },
  skull: { icon: Skull, label: "Skull", activeColor: "text-red-400 bg-red-400/15 border-red-400/30" },
  clap: { icon: HandMetal, label: "Clap", activeColor: "text-green-400 bg-green-400/15 border-green-400/30" },
};

function formatTimestamp(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday`;
  return format(d, "MMM d");
}

function getUserLabel(u: SocialAuthor | User | null | undefined): string {
  if (!u) return "Unknown";
  return (u as SocialAuthor).username || u.firstName || "Player";
}

interface PostCardProps {
  post: SocialPostData;
  onChallenge: (user: SocialAuthor) => void;
}

function PostCard({ post, onChallenge }: PostCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showReplies, setShowReplies] = useState(false);
  const [replyInput, setReplyInput] = useState("");
  const [optimisticReactions, setOptimisticReactions] = useState<Record<string, number>>(post.reactionCounts || {});
  const [optimisticUserReactions, setOptimisticUserReactions] = useState<string[]>(post.userReactions || []);

  const postTypeConfig = POST_TYPE_CONFIG[post.type] || POST_TYPE_CONFIG.general;
  const PostTypeIcon = postTypeConfig.icon;

  const reactMutation = useMutation({
    mutationFn: async (reactionType: string) => {
      const res = await apiRequest("POST", `/api/social/posts/${post.id}/react`, { reactionType });
      return res.json();
    },
    onMutate: (reactionType: string) => {
      const isActive = optimisticUserReactions.includes(reactionType);
      if (isActive) {
        setOptimisticReactions(prev => ({ ...prev, [reactionType]: Math.max(0, (prev[reactionType] || 0) - 1) }));
        setOptimisticUserReactions(prev => prev.filter(r => r !== reactionType));
      } else {
        setOptimisticReactions(prev => ({ ...prev, [reactionType]: (prev[reactionType] || 0) + 1 }));
        setOptimisticUserReactions(prev => [...prev, reactionType]);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/social/posts/${post.id}/reply`, { content });
      return res.json();
    },
    onSuccess: () => {
      setReplyInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
    },
    onError: () => {
      toast({ title: "Failed to post reply", variant: "destructive" });
    },
  });

  const handleShare = async () => {
    const url = `${window.location.origin}/social?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Check out this post on Jango", url });
      } catch {
        // user cancelled share sheet
      }
    } else {
      navigator.clipboard.writeText(url).then(() => {
        toast({ title: "Link copied to clipboard" });
      });
    }
  };

  const handleSubmitReply = () => {
    if (!replyInput.trim()) return;
    replyMutation.mutate(replyInput.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="card-depth p-4 md:p-5" data-testid={`post-card-${post.id}`}>
        <div className="flex gap-3">
          <Avatar className="w-10 h-10 shrink-0 ring-1 ring-white/10" data-testid={`post-avatar-${post.id}`}>
            <AvatarImage src={post.author?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {getUserLabel(post.author).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {post.type === "auto" && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">
                  Auto
                </span>
              )}
              <span
                className="text-sm font-semibold truncate"
                style={{ color: post.author?.nicknameColor || undefined }}
                data-testid={`post-author-${post.id}`}
              >
                {getUserLabel(post.author)}
              </span>
              {post.author?.chessRating && (
                <RankBadge rating={post.author.chessRating} size="xs" showLabel={true} showRating={false} />
              )}
              <Badge variant="outline" className={`${postTypeConfig.color} border-current/20 no-default-hover-elevate no-default-active-elevate`}>
                <PostTypeIcon className="w-3 h-3 mr-1" />
                {postTypeConfig.label}
              </Badge>
              <span className="text-xs text-muted-foreground" data-testid={`post-time-${post.id}`}>
                {formatTimestamp(post.createdAt)}
              </span>
            </div>

            <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap break-words" data-testid={`post-content-${post.id}`}>
              {post.content}
            </p>

            <div className="flex items-center gap-1.5 mt-3 flex-wrap">
              {Object.entries(REACTION_CONFIG).map(([type, config]) => {
                const Icon = config.icon;
                const count = optimisticReactions[type] || 0;
                const isActive = optimisticUserReactions.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => reactMutation.mutate(type)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all ${
                      isActive
                        ? config.activeColor
                        : "text-muted-foreground border-white/10 hover-elevate"
                    }`}
                    data-testid={`reaction-${type}-${post.id}`}
                  >
                    <motion.div
                      key={`${type}-${count}`}
                      initial={isActive ? { scale: 1.4 } : { scale: 1 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 15 }}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </motion.div>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}

              <div className="flex-1" />

              <button
                onClick={() => setShowReplies(!showReplies)}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover-elevate"
                data-testid={`button-replies-${post.id}`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {post.replies?.length || 0}
                {showReplies ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>

              {(post.subjectUser || post.author) && (post.subjectUser || post.author)!.id !== user?.id && (
                <button
                  onClick={() => onChallenge((post.subjectUser || post.author)!)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-orange-400 hover-elevate"
                  data-testid={`button-challenge-${post.id}`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  Challenge
                </button>
              )}

              <button
                onClick={handleShare}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground hover-elevate"
                data-testid={`button-share-${post.id}`}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="px-1.5 py-1 rounded-md text-muted-foreground hover-elevate"
                    data-testid={`button-post-menu-${post.id}`}
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" data-testid={`dropdown-post-menu-${post.id}`}>
                  <DropdownMenuItem onClick={() => {
                    apiRequest("POST", `/api/social/posts/${post.id}/report`, { reason: "inappropriate_content" })
                      .then(() => toast({ title: "Post reported" }))
                      .catch(() => toast({ title: "Failed to report post", variant: "destructive" }));
                  }} data-testid={`menu-report-${post.id}`}>
                    <Flag className="w-4 h-4 mr-2" />Report Post
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    apiRequest("POST", `/api/social/posts/${post.id}/mute`)
                      .then(() => toast({ title: "Player muted" }))
                      .catch(() => toast({ title: "Failed to mute player", variant: "destructive" }));
                  }} data-testid={`menu-mute-${post.id}`}>
                    <VolumeX className="w-4 h-4 mr-2" />Mute Player
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <AnimatePresence>
              {showReplies && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 pt-3 border-t border-white/[0.06] space-y-3">
                    {post.replies?.map((reply: SocialReply) => (
                      <div key={reply.id} className="flex gap-2" data-testid={`reply-${reply.id}`}>
                        <Avatar className="w-6 h-6 shrink-0">
                          <AvatarImage src={reply.author?.profileImageUrl || undefined} />
                          <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                            {getUserLabel(reply.author).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold" style={{ color: reply.author?.nicknameColor || undefined }}>
                              {getUserLabel(reply.author)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{formatTimestamp(reply.createdAt)}</span>
                          </div>
                          <p className="text-xs text-foreground/80 mt-0.5">{reply.content}</p>
                        </div>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <Input
                        placeholder="Write a reply..."
                        value={replyInput}
                        onChange={(e) => setReplyInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") handleSubmitReply(); }}
                        className="text-xs"
                        data-testid={`input-reply-${post.id}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={handleSubmitReply}
                        disabled={!replyInput.trim() || replyMutation.isPending}
                        data-testid={`button-submit-reply-${post.id}`}
                      >
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function FeedTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [postContent, setPostContent] = useState("");
  const [postType, setPostType] = useState("general");
  const [challengeTarget, setChallengeTarget] = useState<SocialAuthor | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);

  const { data: posts = [], isLoading } = useQuery<SocialPostData[]>({
    queryKey: ["/api/social/posts"],
    refetchInterval: 30000,
  });

  const { data: trending = [] } = useQuery<Array<SocialPostData & { totalEngagement: number; reactionCount: number }>>({
    queryKey: ["/api/social/posts/trending"],
  });

  const createPostMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/social/posts", { content: postContent, type: postType });
      return res.json();
    },
    onSuccess: () => {
      setPostContent("");
      setPostType("general");
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts/trending"] });
      toast({ title: "Post published" });
    },
    onError: () => {
      toast({ title: "Failed to create post", variant: "destructive" });
    },
  });

  const handleChallenge = (targetUser: SocialAuthor) => {
    setChallengeTarget(targetUser);
    setChallengeModalOpen(true);
  };

  return (
    <div
      className="space-y-4"
      style={{ paddingBottom: "1rem" }}
    >
      {trending.length > 0 && (
        <div data-testid="trending-strip">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Trending</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {trending.map((t: SocialPostData & { totalEngagement: number; reactionCount: number }) => (
              <Card key={t.id} className="card-depth p-3 hover-elevate cursor-pointer" data-testid={`trending-post-${t.id}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="w-5 h-5">
                    <AvatarImage src={t.author?.profileImageUrl || undefined} />
                    <AvatarFallback className="text-[8px] bg-primary/20 text-primary">
                      {getUserLabel(t.author).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-medium truncate">{getUserLabel(t.author)}</span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] text-muted-foreground">{t.reactionCount} reactions</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Card className="card-depth p-4" data-testid="post-composer">
        <div className="flex gap-3">
          <Avatar className="w-9 h-9 shrink-0">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {getUserLabel(user).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="What's on your mind, player?"
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="resize-none border-0 text-sm focus-visible:ring-0"
              rows={2}
              data-testid="input-post-content"
            />
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 flex-wrap">
                {Object.entries(POST_TYPE_CONFIG).filter(([k]) => k !== "auto").map(([type, config]) => {
                  const Icon = config.icon;
                  return (
                    <button
                      key={type}
                      onClick={() => setPostType(type)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                        postType === type
                          ? `${config.color} bg-white/10 font-medium`
                          : "text-muted-foreground hover-elevate"
                      }`}
                      data-testid={`button-post-type-${type}`}
                    >
                      <Icon className="w-3 h-3" />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-1.5 rounded-md text-muted-foreground hover-elevate"
                  onClick={() => toast({ title: "Attachments coming soon" })}
                  data-testid="button-attach"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <Button
                  size="sm"
                  onClick={() => createPostMutation.mutate()}
                  disabled={!postContent.trim() || createPostMutation.isPending}
                  data-testid="button-submit-post"
                >
                  {createPostMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Post
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12">
          <Rss className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No posts yet. Be the first to share something!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post: SocialPostData) => (
            <PostCard key={post.id} post={post} onChallenge={handleChallenge} />
          ))}
        </div>
      )}

      <CreateMatchDialog
        open={challengeModalOpen}
        onOpenChange={(open) => { if (!open) { setChallengeModalOpen(false); setChallengeTarget(null); } }}
        preSelectedOpponent={challengeTarget}
      />
    </div>
  );
}

function formatMsgTimestamp(date: Date | string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "MMM d, HH:mm");
}

function getMsgUserLabel(u: User | null | undefined): string {
  if (!u) return "User";
  return u.firstName || u.email?.split("@")[0] || "User";
}

function MsgBubble({ message, isMe, isGrouped, showAvatar }: { message: ChatMessageWithUser; isMe: boolean; isGrouped: boolean; showAvatar: boolean }) {
  return (
    <div
      className={`flex gap-3 group ${isMe ? "flex-row-reverse" : "flex-row"} ${isGrouped ? "mt-0.5" : "mt-4"}`}
      data-testid={`message-${message.id}`}
    >
      <div className="w-9 shrink-0 flex items-end">
        {showAvatar && !isMe ? (
          <Avatar className="w-9 h-9 ring-1 ring-white/10">
            <AvatarImage src={message.user?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {getMsgUserLabel(message.user).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-9" />
        )}
      </div>
      <div className={`flex flex-col max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
        {showAvatar && !isGrouped && (
          <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-xs font-semibold text-foreground/80">{getMsgUserLabel(message.user)}</span>
            <span className="text-[10px] text-muted-foreground">{formatMsgTimestamp(message.createdAt)}</span>
          </div>
        )}
        <div className={`relative px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words
          ${isMe
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-white/8 border border-white/8 text-foreground rounded-tl-sm"
          }`}
        >
          {message.message}
        </div>
        {isGrouped && (
          <span className={`text-[10px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? "text-right" : "text-left"}`}>
            {formatMsgTimestamp(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}

function DMBubble({ message, isMe, isGrouped }: { message: DirectMessageWithUser; isMe: boolean; isGrouped: boolean }) {
  return (
    <div
      className={`flex gap-3 ${isMe ? "flex-row-reverse" : "flex-row"} ${isGrouped ? "mt-0.5" : "mt-4"}`}
      data-testid={`dm-${message.id}`}
    >
      <div className="w-9 shrink-0 flex items-end">
        {!isGrouped && !isMe ? (
          <Avatar className="w-9 h-9 ring-1 ring-white/10">
            <AvatarImage src={message.sender?.profileImageUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
              {getMsgUserLabel(message.sender).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-9" />
        )}
      </div>
      <div className={`flex flex-col max-w-[68%] ${isMe ? "items-end" : "items-start"}`}>
        {!isGrouped && (
          <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
            <span className="text-xs font-semibold text-foreground/80">{isMe ? "You" : getMsgUserLabel(message.sender)}</span>
            <span className="text-[10px] text-muted-foreground">{formatMsgTimestamp(message.createdAt)}</span>
          </div>
        )}
        <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words
          ${isMe
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-white/8 border border-white/8 text-foreground rounded-tl-sm"
          }`}
        >
          {message.message}
        </div>
      </div>
    </div>
  );
}

function MessagesTab({ onGoToFriends }: { onGoToFriends: () => void }) {
  const { user } = useAuth();
  const userId = user?.id ?? "";

  const [activeView, setActiveView] = useState<ChannelView>({ kind: "global", channelId: "general" });
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageWithUser[]>([]);
  const [input, setInput] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [wsReady, setWsReady] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat">("sidebar");
  const [sidebarSections, setSidebarSections] = useState({ global: true, games: false, dms: true });
  const [unreadChannels, setUnreadChannels] = useState<Record<string, number>>({});
  const [dmUnread, setDmUnread] = useState<Record<string, number>>({});
  const [challengeTarget, setChallengeTarget] = useState<User | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeViewRef = useRef(activeView);
  activeViewRef.current = activeView;

  const { data: friends } = useQuery<User[]>({ queryKey: ["/api/friends"] });
  const { data: conversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
  });
  const { data: initialGlobalMessages } = useQuery<ChatMessageWithUser[]>({
    queryKey: ["/api/chat", activeView.kind === "global" ? activeView.channelId : null],
    queryFn: async () => {
      if (activeView.kind !== "global") return [];
      const r = await fetch(`/api/chat/${activeView.channelId}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeView.kind === "global",
  });
  const { data: friendDMs } = useQuery<DirectMessageWithUser[]>({
    queryKey: ["/api/messages", activeView.kind === "dm" ? activeView.friend.id : null],
    queryFn: async () => {
      if (activeView.kind !== "dm") return [];
      const r = await fetch(`/api/messages/${activeView.friend.id}`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    enabled: activeView.kind === "dm",
  });

  useEffect(() => {
    if (initialGlobalMessages && activeView.kind === "global") {
      setMessages(initialGlobalMessages);
    }
  }, [initialGlobalMessages, activeView.kind === "global" ? activeView.channelId : ""]);

  useEffect(() => {
    if (friendDMs) setDirectMessages(friendDMs);
  }, [friendDMs]);

  useEffect(() => {
    if (activeView.kind === "dm") {
      fetch(`/api/messages/mark-read/${activeView.friend.id}`, { method: "POST" }).then(() => {
        refetchConversations();
        setDmUnread(prev => { const n = {...prev}; delete n[activeView.kind === "dm" ? activeView.friend.id : ""]; return n; });
      });
    }
  }, [activeView]);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);

    socket.onopen = () => setWsReady(true);
    socket.onclose = () => setWsReady(false);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const view = activeViewRef.current;

        if (data.type === "chat-message" && !data.message.matchId) {
          const ch = data.message.channel as string;
          if (view.kind === "global" && view.channelId === ch) {
            setMessages(prev => [...prev, data.message]);
          } else {
            setUnreadChannels(prev => ({ ...prev, [ch]: (prev[ch] || 0) + 1 }));
          }
        } else if (data.type === "direct-message") {
          const dm = data.message as DirectMessageWithUser;
          if (view.kind === "dm" && (dm.senderId === view.friend.id || dm.recipientId === view.friend.id)) {
            setDirectMessages(prev => [...prev, dm]);
          } else if (dm.senderId !== userId) {
            setDmUnread(prev => ({ ...prev, [dm.senderId]: (prev[dm.senderId] || 0) + 1 }));
          }
          refetchConversations();
        } else if (data.type === "typing") {
          const typerId = data.userId as string;
          const typerName = data.username as string || "Someone";
          if (typerId !== userId) {
            setTypingUsers(prev => ({ ...prev, [typerId]: typerName }));
            setTimeout(() => {
              setTypingUsers(prev => {
                const next = { ...prev };
                delete next[typerId];
                return next;
              });
            }, 3000);
          }
        }
      } catch (e) { /* ignore */ }
    };

    setWs(socket);
    return () => socket.close();
  }, [userId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, directMessages]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    const view = activeViewRef.current;
    if (view.kind === "global") {
      ws.send(JSON.stringify({ type: "chat-message", channel: view.channelId, message: input.trim() }));
    } else if (view.kind === "dm") {
      ws.send(JSON.stringify({ type: "direct-message", recipientId: view.friend.id, message: input.trim() }));
    }
    setInput("");
    setShowEmojiPicker(false);
  }, [input, ws]);

  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleInputChange = (value: string) => {
    setInput(value);
    if (ws && ws.readyState === WebSocket.OPEN && value.trim()) {
      if (!typingTimeoutRef.current) {
        ws.send(JSON.stringify({ type: "typing" }));
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => { typingTimeoutRef.current = null; }, 2000);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    if (e.key === "Escape") setShowEmojiPicker(false);
  };

  const typingNames = Object.values(typingUsers);
  const typingIndicator = typingNames.length > 0
    ? typingNames.length === 1
      ? `${typingNames[0]} is typing...`
      : `${typingNames.slice(0, 2).join(", ")} ${typingNames.length > 2 ? `and ${typingNames.length - 2} more ` : ""}are typing...`
    : null;

  const selectChannel = (channelId: string) => {
    setActiveView({ kind: "global", channelId });
    setUnreadChannels(prev => { const n = {...prev}; delete n[channelId]; return n; });
    setMessages([]);
    setMobileView("chat");
    inputRef.current?.focus();
  };

  const selectDM = (friend: User) => {
    setActiveView({ kind: "dm", friend });
    setDmUnread(prev => { const n = {...prev}; delete n[friend.id]; return n; });
    setDirectMessages([]);
    setMobileView("chat");
    inputRef.current?.focus();
  };

  const appendEmoji = (emoji: string) => {
    setInput(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const currentChannelLabel = activeView.kind === "global"
    ? [...GLOBAL_CHANNELS, ...GAME_CHANNELS].find(c => c.id === activeView.channelId)?.label || activeView.channelId
    : getMsgUserLabel(activeView.friend);

  const displayMessages = activeView.kind === "global" ? messages : directMessages;

  const groupedMessages = displayMessages.map((msg, i) => {
    const prev = displayMessages[i - 1];
    if (!prev) return { msg, isGrouped: false };
    const senderId = activeView.kind === "global" ? (msg as ChatMessageWithUser).userId : (msg as DirectMessageWithUser).senderId;
    const prevSenderId = activeView.kind === "global" ? (prev as ChatMessageWithUser).userId : (prev as DirectMessageWithUser).senderId;
    const gap = msg.createdAt && prev.createdAt
      ? new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime()
      : 999999;
    return { msg, isGrouped: senderId === prevSenderId && gap < 5 * 60 * 1000 };
  });

  const totalDmUnread = Object.values(dmUnread).reduce((a, b) => a + b, 0)
    + (conversations?.reduce((s, c) => s + c.unreadCount, 0) || 0);
  const totalChannelUnread = Object.values(unreadChannels).reduce((a, b) => a + b, 0);

  return (
    <div
      className="flex overflow-hidden rounded-lg border border-white/[0.06] h-[calc(100dvh-260px)] min-h-[420px] md:h-[calc(100vh-340px)] md:min-h-[360px]"
    >
      <aside className={`
        w-full md:w-56 md:shrink-0 flex-col border-r border-white/[0.06] bg-black/20 backdrop-blur-sm
        ${mobileView === "chat" ? "hidden md:flex" : "flex"}
      `}>
        <div className="px-3 py-3 border-b border-white/[0.06]">
          <h2 className="text-xs font-bold text-foreground">Channels</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {wsReady ? <span className="text-emerald-400">Connected</span> : <span className="text-muted-foreground">Connecting...</span>}
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-1.5 py-2 space-y-0.5">
            <button
              onClick={() => setSidebarSections(s => ({ ...s, global: !s.global }))}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover-elevate rounded-md"
              data-testid="section-global-channels"
            >
              {sidebarSections.global ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Global
              {totalChannelUnread > 0 && (
                <Badge variant="destructive" className="ml-auto h-4 min-w-4 px-1 text-[10px]">{totalChannelUnread}</Badge>
              )}
            </button>

            {sidebarSections.global && GLOBAL_CHANNELS.map(ch => {
              const Icon = ch.icon;
              const active = activeView.kind === "global" && activeView.channelId === ch.id;
              const unread = unreadChannels[ch.id] || 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors
                    ${active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover-elevate"}`}
                  data-testid={`channel-${ch.id}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{ch.label}</span>
                  {unread > 0 && (
                    <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">{unread}</Badge>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setSidebarSections(s => ({ ...s, games: !s.games }))}
              className="w-full flex items-center gap-1 px-2 py-1 mt-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover-elevate rounded-md"
              data-testid="section-game-channels"
            >
              {sidebarSections.games ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Game Rooms
            </button>

            {sidebarSections.games && GAME_CHANNELS.map(ch => {
              const Icon = ch.icon;
              const active = activeView.kind === "global" && activeView.channelId === ch.id;
              const unread = unreadChannels[ch.id] || 0;
              return (
                <button
                  key={ch.id}
                  onClick={() => selectChannel(ch.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors
                    ${active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover-elevate"}`}
                  data-testid={`channel-${ch.id}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate flex-1 text-left">{ch.label}</span>
                  {unread > 0 && (
                    <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">{unread}</Badge>
                  )}
                </button>
              );
            })}

            <button
              onClick={() => setSidebarSections(s => ({ ...s, dms: !s.dms }))}
              className="w-full flex items-center gap-1 px-2 py-1 mt-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider hover-elevate rounded-md"
              data-testid="section-direct-messages"
            >
              {sidebarSections.dms ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Direct Messages
              {totalDmUnread > 0 && (
                <Badge variant="destructive" className="ml-auto h-4 min-w-4 px-1 text-[10px]">{totalDmUnread}</Badge>
              )}
            </button>

            {sidebarSections.dms && (
              conversations && conversations.length > 0 ? (
                conversations.map(conv => {
                  const active = activeView.kind === "dm" && activeView.friend.id === conv.friend.id;
                  const unread = (dmUnread[conv.friend.id] || 0) + conv.unreadCount;
                  return (
                    <button
                      key={conv.friend.id}
                      onClick={() => selectDM(conv.friend)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors
                        ${active ? "bg-primary/15 text-primary" : "hover-elevate"}`}
                      data-testid={`dm-conv-${conv.friend.id}`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={conv.friend.profileImageUrl || undefined} />
                          <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                            {getMsgUserLabel(conv.friend).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`text-xs truncate font-medium ${active ? "text-primary" : "text-foreground/80"}`}>
                          {getMsgUserLabel(conv.friend)}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{conv.lastMessage.message}</p>
                      </div>
                      {unread > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] shrink-0">{unread}</Badge>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-2 py-3 space-y-2" data-testid="dm-empty-state">
                  <p className="text-[11px] text-muted-foreground">No conversations yet</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={onGoToFriends}
                    data-testid="button-find-friends"
                  >
                    <Users className="w-3.5 h-3.5 mr-1.5" />
                    Find Friends
                  </Button>
                </div>
              )
            )}
          </div>
        </ScrollArea>
      </aside>

      <main className={`
        flex-1 flex flex-col min-w-0
        ${mobileView === "sidebar" ? "hidden md:flex" : "flex"}
      `}>
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06] bg-black/10 backdrop-blur-sm shrink-0">
          <button
            onClick={() => setMobileView("sidebar")}
            className="md:hidden text-muted-foreground hover-elevate rounded-md p-1"
            data-testid="button-back-to-sidebar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {activeView.kind === "global" ? (
            <>
              {(() => {
                const ch = [...GLOBAL_CHANNELS, ...GAME_CHANNELS].find(c => c.id === activeView.channelId);
                const Icon = ch?.icon || Hash;
                return <Icon className="w-4 h-4 text-muted-foreground shrink-0" />;
              })()}
              <div>
                <h2 className="font-semibold text-xs">{currentChannelLabel}</h2>
                <p className="text-[10px] text-muted-foreground">Global channel</p>
              </div>
            </>
          ) : (
            <>
              <Avatar className="w-7 h-7">
                <AvatarImage src={activeView.friend.profileImageUrl || undefined} />
                <AvatarFallback className="text-[10px] font-bold bg-primary/20 text-primary">
                  {getMsgUserLabel(activeView.friend).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h2 className="font-semibold text-xs">{getMsgUserLabel(activeView.friend)}</h2>
                <p className="text-[10px] text-muted-foreground">Direct message</p>
              </div>
              <div className="flex items-center gap-1 ml-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setChallengeTarget(activeView.friend); setChallengeModalOpen(true); }}
                      data-testid="button-challenge-dm"
                    >
                      <Swords className="w-3.5 h-3.5 mr-1 text-orange-400" />
                      <span className="text-xs hidden sm:inline">Challenge</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Challenge to Match</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setChallengeTarget(activeView.friend); setChallengeModalOpen(true); }}
                      data-testid="button-invite-dm"
                    >
                      <Gamepad2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                      <span className="text-xs hidden sm:inline">Invite</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Invite to Match</TooltipContent>
                </Tooltip>
              </div>
            </>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowRightPanel(v => !v)}
                  className="hidden md:flex"
                  data-testid="button-toggle-right-panel"
                >
                  {showRightPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{showRightPanel ? "Hide Members" : "Show Members"}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 scroll-smooth"
          data-testid="message-timeline"
        >
          {displayMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                {activeView.kind === "global"
                  ? <Hash className="w-6 h-6 text-primary/50" />
                  : <MessageSquare className="w-6 h-6 text-primary/50" />
                }
              </div>
              <p className="font-semibold text-foreground/70 text-xs">
                {activeView.kind === "global"
                  ? `Welcome to #${currentChannelLabel.toLowerCase()}`
                  : `Start a conversation with ${currentChannelLabel}`
                }
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">Be the first to say something!</p>
            </div>
          ) : (
            <div className="space-y-0">
              {groupedMessages.map(({ msg, isGrouped }) => {
                if (activeView.kind === "global") {
                  const m = msg as ChatMessageWithUser;
                  const isMe = m.userId === userId;
                  return (
                    <MsgBubble
                      key={m.id}
                      message={m}
                      isMe={isMe}
                      isGrouped={isGrouped}
                      showAvatar={!isGrouped}
                    />
                  );
                } else {
                  const m = msg as DirectMessageWithUser;
                  const isMe = m.senderId === userId;
                  return (
                    <DMBubble
                      key={m.id}
                      message={m}
                      isMe={isMe}
                      isGrouped={isGrouped}
                    />
                  );
                }
              })}
            </div>
          )}
        </div>

        <div
          className="shrink-0 px-3 pt-2 border-t border-white/[0.06] bg-black/5"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {typingIndicator && (
            <div className="flex items-center gap-1.5 px-1 pb-1.5" data-testid="typing-indicator">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <span className="text-[10px] text-muted-foreground italic">{typingIndicator}</span>
            </div>
          )}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="mb-2 p-2 rounded-xl bg-background/90 backdrop-blur-sm border border-white/10 shadow-xl"
                data-testid="emoji-picker"
              >
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-1">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      onClick={() => appendEmoji(emoji)}
                      className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 w-11 h-11 sm:w-7 sm:h-7 text-base flex items-center justify-center rounded-lg hover-elevate active-elevate-2 transition-transform"
                      data-testid={`emoji-${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-xl px-2.5 py-1">
              <Input
                ref={inputRef}
                value={input}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message ${activeView.kind === "global" ? "#" + currentChannelLabel.toLowerCase() : currentChannelLabel}`}
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 px-0 placeholder:text-muted-foreground/50 text-sm h-8"
                maxLength={1000}
                data-testid="input-message"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowEmojiPicker(v => !v)}
                className="shrink-0 h-7 w-7 text-muted-foreground"
                data-testid="button-emoji-picker"
              >
                <Smile className="w-4 h-4" />
              </Button>
            </div>
            <Button
              onClick={sendMessage}
              size="icon"
              disabled={!input.trim() || !wsReady}
              className="shrink-0"
              data-testid="button-send"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {showRightPanel && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 180, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="hidden md:flex shrink-0 flex-col border-l border-white/[0.06] bg-black/20 backdrop-blur-sm overflow-hidden"
          >
            <div className="px-3 py-3 border-b border-white/[0.06]">
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                Friends
                {friends && friends.length > 0 && (
                  <span className="ml-auto text-foreground/60">{friends.length}</span>
                )}
              </h3>
            </div>
            <ScrollArea className="flex-1">
              <div className="px-1.5 py-2 space-y-0.5">
                {(friends ?? []).length === 0 ? (
                  <p className="px-2 py-2 text-[10px] text-muted-foreground">No friends yet</p>
                ) : (
                  (friends ?? []).map(friend => (
                    <div key={friend.id} className="flex items-center gap-1 px-1 py-0.5 rounded-md hover-elevate group" data-testid={`friend-${friend.id}`}>
                      <button
                        onClick={() => selectDM(friend)}
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                      >
                        <div className="relative shrink-0">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={friend.profileImageUrl || undefined} />
                            <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">
                              {getMsgUserLabel(friend).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-medium text-foreground/80 truncate">{getMsgUserLabel(friend)}</p>
                        </div>
                      </button>
                      <button
                        onClick={() => { setChallengeTarget(friend); setChallengeModalOpen(true); }}
                        className="shrink-0 p-0.5 rounded text-orange-400/70 invisible group-hover:visible"
                        title="Challenge"
                        data-testid={`button-challenge-friend-${friend.id}`}
                      >
                        <Swords className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setChallengeTarget(friend); setChallengeModalOpen(true); }}
                        className="shrink-0 p-0.5 rounded text-emerald-400/70 invisible group-hover:visible"
                        title="Invite to Match"
                        data-testid={`button-invite-friend-${friend.id}`}
                      >
                        <Gamepad2 className="w-3 h-3" />
                      </button>
                      {(dmUnread[friend.id] || 0) > 0 && (
                        <Badge variant="destructive" className="h-3.5 min-w-3.5 px-0.5 text-[9px] shrink-0">{dmUnread[friend.id]}</Badge>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.aside>
        )}
      </AnimatePresence>

      <CreateMatchDialog
        open={challengeModalOpen}
        onOpenChange={(open) => { if (!open) { setChallengeModalOpen(false); setChallengeTarget(null); } }}
        preSelectedOpponent={challengeTarget}
      />
    </div>
  );
}

function FriendCard({ friend, status, onChallenge }: { friend: User; status: "online" | "in-match" | "offline"; onChallenge: (user: User) => void }) {
  const statusColors = {
    online: "bg-green-400",
    "in-match": "bg-orange-400",
    offline: "bg-gray-500",
  };
  const statusLabels = {
    online: "Online",
    "in-match": "In Match",
    offline: "Offline",
  };

  return (
    <Card className="card-depth p-3 hover-elevate" data-testid={`friend-card-${friend.id}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-9 h-9">
              <AvatarImage src={friend.profileImageUrl || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                {getUserLabel(friend).slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[status]}`} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: friend.nicknameColor || undefined }}>
              {getUserLabel(friend)}
            </p>
            <p className="text-xs text-muted-foreground">{statusLabels[status]} &middot; Level {friend.level || 1}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => onChallenge(friend)} data-testid={`button-invite-match-${friend.id}`}>
          <Swords className="w-3.5 h-3.5 mr-1.5" />
          Invite to Match
        </Button>
      </div>
    </Card>
  );
}

function FriendsTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [challengeTarget, setChallengeTarget] = useState<User | null>(null);
  const [challengeModalOpen, setChallengeModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "user-status-change") {
          setOnlineUsers(prev => {
            const next = new Set(prev);
            if (data.status === "online") next.add(data.userId);
            else next.delete(data.userId);
            return next;
          });
        }
      } catch {}
    };
    return () => ws.close();
  }, []);

  const { data: friends = [], isLoading } = useQuery<FriendshipWithUsers[]>({
    queryKey: ["/api/friends"],
  });

  const { data: friendRequests = [] } = useQuery<FriendshipWithUsers[]>({
    queryKey: ["/api/friends/requests"],
  });

  const { data: activeMatches = [] } = useQuery<Array<{ status: string; player1Id?: string; player2Id?: string }>>({
    queryKey: ["/api/matches/active"],
    refetchInterval: 15000,
  });

  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const res = await apiRequest("POST", `/api/friends/accept/${friendshipId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const res = await apiRequest("POST", `/api/friends/decline/${friendshipId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });

  const getFriendUser = (f: FriendshipWithUsers): User => {
    return f.requesterId === user?.id ? f.addressee : f.requester;
  };

  const uniqueFriends = friends.reduce((acc, friendship) => {
    const friend = getFriendUser(friendship);
    if (!acc.some(item => item.friend.id === friend.id)) {
      acc.push({ friendship, friend });
    }
    return acc;
  }, [] as Array<{ friendship: FriendshipWithUsers; friend: User }>);

  const inMatchUserIds = new Set<string>();
  activeMatches.forEach((m: { status: string; player1Id?: string; player2Id?: string }) => {
    if (m.status === "in-progress") {
      if (m.player1Id) inMatchUserIds.add(m.player1Id);
      if (m.player2Id) inMatchUserIds.add(m.player2Id);
    }
  });

  const getFriendStatus = (friendId: string): "online" | "in-match" | "offline" => {
    if (inMatchUserIds.has(friendId)) return "in-match";
    if (onlineUsers.has(friendId)) return "online";
    return "offline";
  };

  const onlineFriends = uniqueFriends.filter(f => getFriendStatus(f.friend.id) === "online");
  const inMatchFriends = uniqueFriends.filter(f => getFriendStatus(f.friend.id) === "in-match");
  const offlineFriends = uniqueFriends.filter(f => getFriendStatus(f.friend.id) === "offline");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div
      className="space-y-4"
      style={{ paddingBottom: "1rem" }}
    >
      {friendRequests.length > 0 && (
        <div data-testid="pending-requests-section">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Pending Requests ({friendRequests.length})
          </h3>
          <div className="space-y-2">
            {friendRequests.map((req) => (
              <Card key={req.id} className="card-depth p-3" data-testid={`friend-request-${req.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={req.requester?.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                        {getUserLabel(req.requester).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{getUserLabel(req.requester)}</p>
                      <p className="text-xs text-muted-foreground">{req.requester?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => acceptMutation.mutate(req.id)} data-testid={`button-accept-request-${req.id}`}>
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => declineMutation.mutate(req.id)} data-testid={`button-decline-request-${req.id}`}>
                      Decline
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {uniqueFriends.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No friends yet. Add some from the Friends button in the navbar!</p>
        </div>
      ) : (
        <>
          {inMatchFriends.length > 0 && (
            <div data-testid="friends-in-match-section">
              <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider mb-2">
                In Match ({inMatchFriends.length})
              </h3>
              <div className="space-y-2">
                {inMatchFriends.map(({ friend }) => (
                  <FriendCard key={friend.id} friend={friend} status="in-match" onChallenge={(u) => { setChallengeTarget(u); setChallengeModalOpen(true); }} />
                ))}
              </div>
            </div>
          )}

          {onlineFriends.length > 0 && (
            <div data-testid="friends-online-section">
              <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider mb-2">
                Online ({onlineFriends.length})
              </h3>
              <div className="space-y-2">
                {onlineFriends.map(({ friend }) => (
                  <FriendCard key={friend.id} friend={friend} status="online" onChallenge={(u) => { setChallengeTarget(u); setChallengeModalOpen(true); }} />
                ))}
              </div>
            </div>
          )}

          {offlineFriends.length > 0 && (
            <div data-testid="friends-offline-section">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Offline ({offlineFriends.length})
              </h3>
              <div className="space-y-2">
                {offlineFriends.map(({ friend }) => (
                  <FriendCard key={friend.id} friend={friend} status="offline" onChallenge={(u) => { setChallengeTarget(u); setChallengeModalOpen(true); }} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <CreateMatchDialog
        open={challengeModalOpen}
        onOpenChange={(open) => { if (!open) { setChallengeModalOpen(false); setChallengeTarget(null); } }}
        preSelectedOpponent={challengeTarget}
      />
    </div>
  );
}

import { PageDepthBackground } from "@/components/PageDepthBackground";

export default function SocialPage() {
  const { user } = useAuth();

  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get("tab") || "feed";
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 10000,
    enabled: !!user,
  });
  const msgUnread = unreadData?.count ?? 0;

  return (
    <div className="min-h-screen bg-background relative" data-testid="page-social">
      <PageDepthBackground
        glowZones={[
          { x: "20%", y: "10%", color: "99,102,241",  size: "45%", opacity: 0.06 },
          { x: "75%", y: "30%", color: "255,45,138",  size: "35%", opacity: 0.04 },
          { x: "50%", y: "80%", color: "34,211,238",  size: "40%", opacity: 0.03 },
        ]}
        particleCount={16}
      />
      <AppNavbar />
      <div className={`mx-auto px-4 py-6 ${activeTab === "messages" ? "max-w-5xl" : "max-w-2xl"}`}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-md bg-primary/15 flex items-center justify-center">
            <Rss className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-social-title">Community Hub</h1>
            <p className="text-xs text-muted-foreground">Feed, Messages & Friends</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="feed" data-testid="tab-feed">
              <Rss className="w-4 h-4 mr-1.5" />
              Feed
            </TabsTrigger>
            <TabsTrigger value="messages" data-testid="tab-messages" className="relative">
              <MessageCircle className="w-4 h-4 mr-1.5" />
              Messages
              {msgUnread > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                  {msgUnread > 9 ? "9+" : msgUnread}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="friends" data-testid="tab-friends">
              <Users className="w-4 h-4 mr-1.5" />
              Friends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed">
            <FeedTab />
          </TabsContent>
          <TabsContent value="messages">
            <MessagesTab onGoToFriends={() => setActiveTab("friends")} />
          </TabsContent>
          <TabsContent value="friends">
            <FriendsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}