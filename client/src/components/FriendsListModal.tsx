import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, UserMinus, Check, X, Search, Swords } from "lucide-react";
import type { User, FriendshipWithUsers } from "@shared/schema";

interface FriendsListModalProps {
  open: boolean;
  onClose: () => void;
  onChallenge?: (friend: User) => void;
}

export function FriendsListModal({ open, onClose, onChallenge }: FriendsListModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  
  const { data: friends = [] } = useQuery<FriendshipWithUsers[]>({
    queryKey: ["/api/friends"],
    enabled: open,
  });

  const { data: friendRequests = [] } = useQuery<FriendshipWithUsers[]>({
    queryKey: ["/api/friends/requests"],
    enabled: open,
  });

  const { data: searchResults = [], refetch: refetchSearch } = useQuery<User[]>({
    queryKey: ["/api/users/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const response = await fetch(`/api/users/search?query=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: false,
  });

  useEffect(() => {
    if (searchQuery.length >= 2) {
      refetchSearch();
    }
  }, [searchQuery, refetchSearch]);

  useEffect(() => {
    if (!open) return;

    const ws = new WebSocket(`${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'user-status-change') {
          setOnlineUsers((prev) => {
            const newSet = new Set(prev);
            if (data.status === 'online') {
              newSet.add(data.userId);
            } else {
              newSet.delete(data.userId);
            }
            return newSet;
          });
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    return () => {
      ws.close();
    };
  }, [open]);

  const sendRequestMutation = useMutation({
    mutationFn: async (addresseeId: string) => {
      const response = await apiRequest("POST", "/api/friends/request", { addresseeId });
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request sent!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
      setSearchQuery("");
    },
    onError: (error: any) => {
      toast({
        title: "Failed to send friend request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const acceptRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiRequest("POST", `/api/friends/accept/${friendshipId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request accepted!" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept request",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const declineRequestMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiRequest("POST", `/api/friends/decline/${friendshipId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Friend request declined" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends/requests"] });
    },
  });

  const removeFriendMutation = useMutation({
    mutationFn: async (friendshipId: string) => {
      const response = await apiRequest("DELETE", `/api/friends/${friendshipId}`);
      return await response.json();
    },
    onSuccess: () => {
      toast({ title: "Friend removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/friends"] });
    },
  });

  const getFriendUser = (friendship: FriendshipWithUsers, userId: string): User => {
    return friendship.requesterId === userId ? friendship.addressee : friendship.requester;
  };

  const getUserInitials = (user: User) => {
    return `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || user.email?.[0]?.toUpperCase() || '?';
  };

  const isOnline = (userId: string) => onlineUsers.has(userId);

  const isFriend = (userId: string) => {
    return friends.some((f) => 
      f.requesterId === userId || f.addresseeId === userId
    );
  };

  const hasPendingRequest = (userId: string) => {
    return friendRequests.some((f) => f.requesterId === userId);
  };

  // Deduplicate friends to show each friend only once
  const uniqueFriends = friends.reduce((acc, friendship) => {
    const friend = getFriendUser(friendship, user?.id || "");
    if (!acc.some(item => item.friend.id === friend.id)) {
      acc.push({ friendship, friend });
    }
    return acc;
  }, [] as Array<{ friendship: FriendshipWithUsers; friend: User }>);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="modal-friends">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Friends
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="friends" data-testid="tab-friends">
              Friends ({uniqueFriends.length})
            </TabsTrigger>
            <TabsTrigger value="requests" data-testid="tab-requests">
              Requests ({friendRequests.length})
            </TabsTrigger>
            <TabsTrigger value="search" data-testid="tab-search">
              Add Friends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            {uniqueFriends.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <Users className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Build your squad</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">Add friends, challenge players, and track rivals. Search by username to get started.</p>
                </div>
                <button
                  className="text-xs text-primary/70 hover:text-primary transition-colors"
                  onClick={() => {
                    const el = document.querySelector('[data-testid="friends-search-input"]') as HTMLInputElement | null;
                    el?.focus();
                  }}
                  data-testid="button-find-players"
                >
                  Find Players →
                </button>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {uniqueFriends.map(({ friendship, friend }) => {
                    const online = isOnline(friend.id);
                    
                    return (
                      <Card
                        key={friend.id}
                        className="p-4 hover-elevate"
                        data-testid={`card-friend-${friend.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <Avatar>
                                <AvatarFallback>{getUserInitials(friend)}</AvatarFallback>
                              </Avatar>
                              <div
                                className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card ${
                                  online ? "bg-green-500" : "bg-gray-400"
                                }`}
                                data-testid={`status-${friend.id}`}
                              />
                            </div>
                            <div>
                              <div className="font-medium">
                                {friend.firstName} {friend.lastName}
                              </div>
                              <div className="text-sm text-muted-foreground">{friend.email}</div>
                            </div>
                            {online && (
                              <Badge variant="outline" className="text-green-500">
                                Online
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {onChallenge && (
                              <Button
                                size="sm"
                                onClick={() => onChallenge(friend)}
                                data-testid={`button-challenge-${friend.id}`}
                              >
                                <Swords className="w-4 h-4 mr-1" />
                                Challenge
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFriendMutation.mutate(friendship.id)}
                              data-testid={`button-remove-${friend.id}`}
                            >
                              <UserMinus className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="requests" className="space-y-4">
            {friendRequests.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/8 flex items-center justify-center">
                  <UserPlus className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground">No pending friend requests</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {friendRequests.map((request) => (
                    <Card
                      key={request.id}
                      className="p-4"
                      data-testid={`card-request-${request.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getUserInitials(request.requester)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {request.requester.firstName} {request.requester.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {request.requester.email}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => acceptRequestMutation.mutate(request.id)}
                            data-testid={`button-accept-${request.id}`}
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => declineRequestMutation.mutate(request.id)}
                            data-testid={`button-decline-${request.id}`}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="search" className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-users"
              />
            </div>

            {searchQuery.length < 2 ? (
              <div className="text-center py-8 text-muted-foreground">
                Enter at least 2 characters to search
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
            ) : (
              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <Card
                      key={user.id}
                      className="p-4"
                      data-testid={`card-search-result-${user.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {user.firstName} {user.lastName}
                            </div>
                            <div className="text-sm text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                        {isFriend(user.id) ? (
                          <Badge variant="outline">Friend</Badge>
                        ) : hasPendingRequest(user.id) ? (
                          <Badge variant="outline">Request Sent</Badge>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => sendRequestMutation.mutate(user.id)}
                            disabled={sendRequestMutation.isPending}
                            data-testid={`button-add-friend-${user.id}`}
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Add Friend
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
