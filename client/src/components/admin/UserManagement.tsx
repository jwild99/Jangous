import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, DollarSign, Mail, Calendar, Ban, CheckCircle, MailCheck, Award } from "lucide-react";
import type { User } from "@shared/schema";

export default function UserManagement() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newBalance, setNewBalance] = useState("");

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: string; isAdmin: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/admin-status`, { isAdmin });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User admin status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update admin status",
        variant: "destructive",
      });
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: async ({ userId, balance }: { userId: string; balance: string }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/balance`, { balance });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setEditDialogOpen(false);
      setSelectedUser(null);
      setNewBalance("");
      toast({
        title: "Success",
        description: "User balance updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update balance",
        variant: "destructive",
      });
    },
  });

  const banUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/ban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User has been banned",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to ban user",
        variant: "destructive",
      });
    },
  });

  const unbanUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("POST", `/api/admin/users/${userId}/unban`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "User has been unbanned",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unban user",
        variant: "destructive",
      });
    },
  });

  const updateEmailVerificationMutation = useMutation({
    mutationFn: async ({ userId, isEmailVerified }: { userId: string; isEmailVerified: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/email-verification`, { isEmailVerified });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Email verification status updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update email verification",
        variant: "destructive",
      });
    },
  });

  const updateVerifiedAccountMutation = useMutation({
    mutationFn: async ({ userId, isVerifiedAccount }: { userId: string; isVerifiedAccount: boolean }) => {
      return await apiRequest("PATCH", `/api/admin/users/${userId}/verified-account`, { isVerifiedAccount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: "Verified account badge updated",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update verified account badge",
        variant: "destructive",
      });
    },
  });

  const handleEditBalance = (user: User) => {
    setSelectedUser(user);
    setNewBalance(user.balance || "0.00");
    setEditDialogOpen(true);
  };

  const handleUpdateBalance = () => {
    if (!selectedUser) return;
    
    const balance = parseFloat(newBalance);
    if (isNaN(balance) || balance < 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number",
        variant: "destructive",
      });
      return;
    }

    updateBalanceMutation.mutate({
      userId: selectedUser.id,
      balance: balance.toFixed(2),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-2">User Management</h2>
        <p className="text-muted-foreground">View and manage all platform users</p>
      </div>

      <Card className="card-depth border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            Password Management Note
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This platform uses Replit Auth for authentication. User passwords are securely managed by Replit, not by this application. 
            Users can reset their passwords through the Replit login page. Admins cannot directly reset user passwords.
          </p>
        </CardContent>
      </Card>

      <Card className="card-depth">
        <CardHeader>
          <CardTitle>All Users ({users?.length || 0})</CardTitle>
          <CardDescription>Manage user roles and balances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium">
                      <div>
                        <div>{user.firstName} {user.lastName}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{user.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-chart-3" />
                        <span className="font-mono">${user.balance || "0.00"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge variant="default" className="gap-1">
                          <Shield className="w-3 h-3" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary">User</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {user.isBanned ? (
                        <Badge variant="destructive" className="gap-1">
                          <Ban className="w-3 h-3" />
                          Banned
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Active
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <Button
                            variant={user.isEmailVerified ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => updateEmailVerificationMutation.mutate({
                              userId: user.id,
                              isEmailVerified: !user.isEmailVerified
                            })}
                            disabled={updateEmailVerificationMutation.isPending}
                            className="h-7 text-xs"
                            data-testid={`button-toggle-email-verification-${user.id}`}
                          >
                            <MailCheck className="w-3 h-3 mr-1" />
                            {user.isEmailVerified ? "Verified" : "Unverified"}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant={user.isVerifiedAccount ? "default" : "outline"}
                            size="sm"
                            onClick={() => updateVerifiedAccountMutation.mutate({
                              userId: user.id,
                              isVerifiedAccount: !user.isVerifiedAccount
                            })}
                            disabled={updateVerifiedAccountMutation.isPending}
                            className="h-7 text-xs"
                            data-testid={`button-toggle-verified-account-${user.id}`}
                          >
                            <Award className="w-3 h-3 mr-1" />
                            {user.isVerifiedAccount ? "Badge" : "No Badge"}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(user.createdAt || "").toLocaleDateString()}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditBalance(user)}
                          data-testid={`button-edit-balance-${user.id}`}
                        >
                          Edit Balance
                        </Button>
                        <Button
                          variant={user.isAdmin ? "secondary" : "default"}
                          size="sm"
                          onClick={() => updateAdminMutation.mutate({ 
                            userId: user.id, 
                            isAdmin: !user.isAdmin 
                          })}
                          disabled={updateAdminMutation.isPending}
                          data-testid={`button-toggle-admin-${user.id}`}
                        >
                          {user.isAdmin ? "Remove Admin" : "Make Admin"}
                        </Button>
                        {user.isBanned ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unbanUserMutation.mutate(user.id)}
                            disabled={unbanUserMutation.isPending}
                            data-testid={`button-unban-${user.id}`}
                          >
                            Unban
                          </Button>
                        ) : (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => banUserMutation.mutate(user.id)}
                            disabled={banUserMutation.isPending}
                            data-testid={`button-ban-${user.id}`}
                          >
                            Ban
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Balance Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="dialog-edit-balance">
          <DialogHeader>
            <DialogTitle>Edit User Balance</DialogTitle>
            <DialogDescription>
              Update balance for {selectedUser?.firstName} {selectedUser?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="current-balance">Current Balance</Label>
              <div className="text-2xl font-bold text-primary mt-1">
                ${selectedUser?.balance || "0.00"}
              </div>
            </div>
            <div>
              <Label htmlFor="new-balance">New Balance</Label>
              <Input
                id="new-balance"
                type="number"
                step="0.01"
                min="0"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="Enter new balance"
                className="mt-1 font-mono"
                data-testid="input-new-balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditDialogOpen(false);
                setSelectedUser(null);
                setNewBalance("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateBalance}
              disabled={updateBalanceMutation.isPending}
              data-testid="button-confirm-update-balance"
            >
              Update Balance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
