import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, MessageCircle, X } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import type { ChatMessage, User } from "@shared/schema";

interface ChatBoxProps {
  channel: string;
  matchId?: string;
  userId: string;
  className?: string;
  defaultCollapsed?: boolean;
}

type ChatMessageWithUser = ChatMessage & { user: User | null };

export function ChatBox({ channel, matchId, userId, className = "", defaultCollapsed = false }: ChatBoxProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [unreadCount, setUnreadCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: initialMessages } = useQuery<ChatMessageWithUser[]>({
    queryKey: ["/api/chat", channel, matchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (matchId) params.append("matchId", matchId);
      const url = `/api/chat/${channel}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {};

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "chat-message") {
          if (data.message.channel === channel) {
            if (matchId && data.message.matchId !== matchId) return;
            if (!matchId && data.message.matchId) return;
            setMessages((prev) => [data.message, ...prev]);
            if (isCollapsed && data.message.userId !== userId) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      } catch (error) {
        console.error("Failed to parse chat message:", error);
      }
    };

    socket.onerror = (error) => console.error("Chat WebSocket error:", error);
    socket.onclose = () => {};

    setWs(socket);
    return () => socket.close();
  }, [channel, matchId, isCollapsed, userId]);

  useEffect(() => {
    if (initialMessages) setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!inputValue.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "chat-message", channel, matchId, message: inputValue.trim() }));
    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Chat Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsCollapsed(!isCollapsed);
          if (isCollapsed) setUnreadCount(0);
        }}
        className="gap-2 relative"
        data-testid="button-chat-toggle"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden md:inline">Chat</span>
        {unreadCount > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs absolute -top-1 -right-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </Button>

      {/* Chat Panel */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={className}
          >
            <div className="glass-chat w-96 overflow-hidden" data-testid="card-chat">

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.07]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                    <MessageCircle className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold">
                    {matchId ? "Match Chat" : "Global Chat"}
                  </span>
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCollapsed(true)}
                  className="h-6 w-6 shrink-0 opacity-60 hover:opacity-100"
                  data-testid="button-chat-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Messages */}
              <ScrollArea className="h-80 px-4 py-3" ref={scrollRef}>
                <div className="space-y-3 flex flex-col-reverse">
                  {messages.map((message) => {
                    const isMe = message.userId === userId;
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                        data-testid={`message-${message.id}`}
                      >
                        <div className={`px-3.5 py-2.5 max-w-[80%] ${isMe ? "glass-bubble-mine" : "glass-bubble-other"}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs font-semibold ${isMe ? "text-blue-300" : "text-foreground/70"}`}>
                              {message.user?.firstName || message.user?.email?.split("@")[0] || "User"}
                            </span>
                            <span className="text-xs opacity-40">
                              {message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}
                            </span>
                          </div>
                          <p className="text-sm break-words leading-relaxed">{message.message}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                  {messages.length === 0 && (
                    <div className="text-center text-muted-foreground py-10 text-sm" data-testid="text-no-messages">
                      <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No messages yet. Start the conversation!
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="px-4 pb-4 pt-3 border-t border-white/[0.07]">
                <div className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl bg-white/5 border-white/10 placeholder:text-white/30 text-sm"
                    data-testid="input-chat-message"
                    maxLength={500}
                  />
                  <Button
                    onClick={sendMessage}
                    size="icon"
                    disabled={!inputValue.trim()}
                    className="rounded-xl shrink-0"
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
