import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, MessageCircle, X, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChatMessage, User, DirectMessage } from "@shared/schema";

interface MessagingBoxProps {
  userId: string;
  className?: string;
  defaultCollapsed?: boolean;
}

type ChatMessageWithUser = ChatMessage & { user: User | null };
type DirectMessageWithUser = DirectMessage & { sender: User; recipient: User };
type Conversation = {
  friend: User;
  lastMessage: DirectMessageWithUser;
  unreadCount: number;
};

export function MessagingBox({ userId, className = "", defaultCollapsed = false }: MessagingBoxProps) {
  const [messages, setMessages] = useState<ChatMessageWithUser[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageWithUser[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [selectedFriend, setSelectedFriend] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<"global" | "dms">("global");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stable refs for values used inside the WS handler (avoids recreating the socket on every state change)
  const isCollapsedRef = useRef(isCollapsed);
  isCollapsedRef.current = isCollapsed;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const selectedFriendRef = useRef(selectedFriend);
  selectedFriendRef.current = selectedFriend;

  // Fetch initial global chat messages
  const { data: initialMessages } = useQuery<ChatMessageWithUser[]>({
    queryKey: ["/api/chat/global"],
    queryFn: async () => {
      const response = await fetch("/api/chat/global");
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
  });

  // Fetch conversations
  const { data: conversations, refetch: refetchConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    enabled: activeTab === "dms",
  });

  // Fetch direct messages with selected friend
  const { data: friendMessages, refetch: refetchDMs } = useQuery<DirectMessageWithUser[]>({
    queryKey: ["/api/messages", selectedFriend?.id],
    enabled: !!selectedFriend,
    queryFn: async () => {
      if (!selectedFriend) return [];
      const response = await fetch(`/api/messages/${selectedFriend.id}`);
      if (!response.ok) throw new Error("Failed to fetch direct messages");
      return response.json();
    },
  });

  // Fetch unread DM count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    refetchInterval: 5000, // Poll every 5 seconds
  });

  useEffect(() => {
    if (unreadData) {
      setDmUnreadCount(unreadData.count);
    }
  }, [unreadData]);

  // Initialize WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {};

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "chat-message") {
          if (data.message.channel === "global" && !data.message.matchId) {
            setMessages((prev) => [data.message, ...prev]);
            if ((isCollapsedRef.current || activeTabRef.current === "dms") && data.message.userId !== userId) {
              setUnreadCount((prev) => prev + 1);
            }
          }
        } else if (data.type === "direct-message") {
          const dmMessage = data.message as DirectMessageWithUser;
          const curFriend = selectedFriendRef.current;
          
          if (curFriend && (dmMessage.senderId === curFriend.id || dmMessage.recipientId === curFriend.id)) {
            setDirectMessages((prev) => [dmMessage, ...prev]);
            if (dmMessage.senderId === curFriend.id && activeTabRef.current === "dms" && !isCollapsedRef.current) {
              fetch(`/api/messages/mark-read/${curFriend.id}`, { method: "POST" });
            }
          }
          
          if (dmMessage.senderId !== userId && (isCollapsedRef.current || activeTabRef.current === "global" || curFriend?.id !== dmMessage.senderId)) {
            setDmUnreadCount((prev) => prev + 1);
          }
          
          refetchConversations();
        }
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    };

    socket.onerror = (error) => {
      console.error("Messaging WebSocket error:", error);
    };

    socket.onclose = () => {};

    setWs(socket);

    return () => {
      socket.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Load initial messages
  useEffect(() => {
    if (initialMessages) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  // Load friend messages
  useEffect(() => {
    if (friendMessages) {
      setDirectMessages(friendMessages);
    }
  }, [friendMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, directMessages]);

  // Mark messages as read when viewing DM
  useEffect(() => {
    if (selectedFriend && activeTab === "dms" && !isCollapsed) {
      fetch(`/api/messages/mark-read/${selectedFriend.id}`, { method: "POST" })
        .then(() => {
          // Recalculate unread count
          refetchConversations();
        });
    }
  }, [selectedFriend, activeTab, isCollapsed, refetchConversations]);

  const sendMessage = () => {
    if (!inputValue.trim() || !ws || ws.readyState !== WebSocket.OPEN) return;

    if (activeTab === "global") {
      const messageData = {
        type: "chat-message",
        channel: "global",
        message: inputValue.trim(),
      };
      ws.send(JSON.stringify(messageData));
    } else if (selectedFriend) {
      const messageData = {
        type: "direct-message",
        recipientId: selectedFriend.id,
        message: inputValue.trim(),
      };
      ws.send(JSON.stringify(messageData));
    }

    setInputValue("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as "global" | "dms");
    if (value === "global") {
      setUnreadCount(0);
      setSelectedFriend(null);
    } else {
      // Refresh conversations when switching to DMs
      refetchConversations();
    }
  };

  const handleFriendSelect = (friend: User) => {
    setSelectedFriend(friend);
    refetchDMs();
  };

  const totalUnread = unreadCount + dmUnreadCount;

  return (
    <>
      {/* Messaging Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setIsCollapsed(!isCollapsed);
          if (isCollapsed && activeTab === "global") setUnreadCount(0);
        }}
        className="gap-2 relative"
        data-testid="button-messaging-toggle"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="hidden md:inline">Messages</span>
        {totalUnread > 0 && (
          <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs absolute -top-1 -right-1">
            {totalUnread > 9 ? "9+" : totalUnread}
          </Badge>
        )}
      </Button>

      {/* Messaging Panel */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={className}
          >
            <Card className="card-depth shadow-lg w-96" data-testid="card-messaging">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  Messages
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsCollapsed(true)}
                  className="h-6 w-6 shrink-0"
                  data-testid="button-messaging-close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <Tabs value={activeTab} onValueChange={handleTabChange}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="global" className="relative" data-testid="tab-global-chat">
                      Global
                      {unreadCount > 0 && (
                        <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-xs">
                          {unreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="dms" className="relative" data-testid="tab-direct-messages">
                      DMs
                      {dmUnreadCount > 0 && (
                        <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-xs">
                          {dmUnreadCount}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="global" className="space-y-4 mt-4">
                    <ScrollArea className="h-96 pr-4" ref={scrollRef}>
                      <div className="space-y-3 flex flex-col-reverse">
                        {messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex flex-col ${
                              message.userId === userId ? "items-end" : "items-start"
                            }`}
                            data-testid={`message-${message.id}`}
                          >
                            <div
                              className={`rounded-lg px-3 py-2 max-w-[80%] ${
                                message.userId === userId
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-medium">
                                  {message.user?.firstName || message.user?.email?.split("@")[0] || "User"}
                                </span>
                                <span className="text-xs opacity-70">
                                  {message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}
                                </span>
                              </div>
                              <p className="text-sm break-words">{message.message}</p>
                            </div>
                          </div>
                        ))}
                        {messages.length === 0 && (
                          <div className="text-center text-muted-foreground py-8" data-testid="text-no-messages">
                            No messages yet. Start the conversation!
                          </div>
                        )}
                      </div>
                    </ScrollArea>

                    <div className="flex gap-2">
                      <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyPress}
                        placeholder="Type a message..."
                        className="flex-1"
                        data-testid="input-chat-message"
                        maxLength={500}
                      />
                      <Button
                        onClick={sendMessage}
                        size="icon"
                        disabled={!inputValue.trim()}
                        data-testid="button-send-message"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="dms" className="space-y-4 mt-4">
                    {!selectedFriend ? (
                      <ScrollArea className="h-96 pr-4">
                        <div className="space-y-2">
                          {(conversations ?? []).length === 0 ? (
                            <div className="text-center text-muted-foreground py-8" data-testid="text-no-conversations">
                              No conversations yet. Add friends to start messaging!
                            </div>
                          ) : (
                            (conversations ?? []).map((conv) => (
                              <button
                                key={conv.friend.id}
                                onClick={() => handleFriendSelect(conv.friend)}
                                className="w-full flex items-center gap-3 p-3 rounded-lg hover-elevate active-elevate-2 text-left"
                                data-testid={`conversation-${conv.friend.id}`}
                              >
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={conv.friend.profileImageUrl || undefined} />
                                  <AvatarFallback>
                                    <UserIcon className="h-5 w-5" />
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-sm font-medium truncate">
                                      {conv.friend.firstName || conv.friend.email?.split("@")[0] || "User"}
                                    </p>
                                    {conv.unreadCount > 0 && (
                                      <Badge variant="destructive" className="h-5 min-w-5 px-1 text-xs">
                                        {conv.unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {conv.lastMessage.message}
                                  </p>
                                </div>
                              </button>
                            ))
                          )}
                        </div>
                      </ScrollArea>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 pb-2 border-b">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedFriend(null)}
                            data-testid="button-back-to-conversations"
                          >
                            ← Back
                          </Button>
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={selectedFriend.profileImageUrl || undefined} />
                            <AvatarFallback>
                              <UserIcon className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {selectedFriend.firstName || selectedFriend.email?.split("@")[0] || "User"}
                          </span>
                        </div>

                        <ScrollArea className="h-80 pr-4" ref={scrollRef}>
                          <div className="space-y-3 flex flex-col-reverse">
                            {directMessages.map((message) => (
                              <div
                                key={message.id}
                                className={`flex flex-col ${
                                  message.senderId === userId ? "items-end" : "items-start"
                                }`}
                                data-testid={`dm-${message.id}`}
                              >
                                <div
                                  className={`rounded-lg px-3 py-2 max-w-[80%] ${
                                    message.senderId === userId
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium">
                                      {message.sender.firstName || message.sender.email?.split("@")[0] || "User"}
                                    </span>
                                    <span className="text-xs opacity-70">
                                      {message.createdAt ? format(new Date(message.createdAt), "HH:mm") : ""}
                                    </span>
                                  </div>
                                  <p className="text-sm break-words">{message.message}</p>
                                </div>
                              </div>
                            ))}
                            {directMessages.length === 0 && (
                              <div className="text-center text-muted-foreground py-8" data-testid="text-no-direct-messages">
                                No messages yet. Say hi!
                              </div>
                            )}
                          </div>
                        </ScrollArea>

                        <div className="flex gap-2">
                          <Input
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder="Type a message..."
                            className="flex-1"
                            data-testid="input-dm-message"
                            maxLength={500}
                          />
                          <Button
                            onClick={sendMessage}
                            size="icon"
                            disabled={!inputValue.trim()}
                            data-testid="button-send-dm"
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
