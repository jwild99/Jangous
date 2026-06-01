import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Users, TrendingUp, DollarSign, Activity, Shield, Settings, Flag, Gavel } from "lucide-react";
import { AppNavbar } from "@/components/AppNavbar";
import { PageHero } from "@/components/PageHero";
import AdminAnalytics from "@/components/admin/AdminAnalytics";
import UserManagement from "@/components/admin/UserManagement";
import GameControlSettings from "@/components/admin/GameControlSettings";
import AdminTransactions from "@/components/admin/AdminTransactions";
import DisputeReview from "@/components/admin/DisputeReview";
import ReportsReview from "@/components/admin/ReportsReview";
import ModerationDashboard from "@/components/admin/ModerationDashboard";

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("analytics");

  // Fetch user balance
  const { data: balanceData } = useQuery<{ balance: string }>({
    queryKey: ["/api/wallet/balance"],
  });

  // Check if user is admin
  if (!user?.isAdmin) {
    return (
      <div className="min-h-screen glass-bg flex items-center justify-center">
        <Card className="card-depth max-w-md glass-override">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-destructive" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have administrator privileges to access this page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">Return to Home</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen glass-bg">
      <AppNavbar />
      <PageHero
        title="Admin Panel"
        subtitle="Platform management and analytics"
        motif="admin"
      />


      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Manage users, monitor analytics, and control game settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="flex flex-wrap gap-1 h-auto p-1 w-full" data-testid="admin-tabs">
            <TabsTrigger value="analytics" className="flex items-center gap-1.5 text-xs" data-testid="tab-analytics">
              <TrendingUp className="w-3.5 h-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs" data-testid="tab-users">
              <Users className="w-3.5 h-3.5" />
              Users
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-1.5 text-xs" data-testid="tab-transactions">
              <DollarSign className="w-3.5 h-3.5" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 text-xs" data-testid="tab-game-settings">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="disputes" className="flex items-center gap-1.5 text-xs" data-testid="tab-disputes">
              <Shield className="w-3.5 h-3.5" />
              Disputes
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs" data-testid="tab-reports">
              <Flag className="w-3.5 h-3.5" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="moderation" className="flex items-center gap-1.5 text-xs" data-testid="tab-moderation">
              <Gavel className="w-3.5 h-3.5" />
              Moderation
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics" className="space-y-4">
            <AdminAnalytics />
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <UserManagement />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <AdminTransactions />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <GameControlSettings />
          </TabsContent>

          <TabsContent value="disputes" className="space-y-4">
            <DisputeReview />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ReportsReview />
          </TabsContent>

          <TabsContent value="moderation" className="space-y-4">
            <ModerationDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
