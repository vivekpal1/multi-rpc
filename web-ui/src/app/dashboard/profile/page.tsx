"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  User,
  Mail,
  Wallet,
  Shield,
  Key,
  Activity,
  CreditCard,
  Settings,
  AlertCircle,
  CheckCircle,
  Camera,
  Edit,
  Save,
  X,
  Loader2,
  Link2,
  Github,
  Twitter,
  Globe,
  Calendar,
  Clock,
  Database,
  Zap,
} from "lucide-react";
import { format } from "date-fns";
import { ClientDate } from "@/components/client-date";

export default function ProfilePage() {
  const { user: privyUser, getAccessToken, logout } = usePrivy();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    image: "",
  });

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch("/api/user/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setFormData({
          name: data.user.name || "",
          email: data.user.email || "",
          image: data.user.image || "",
        });
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (privyUser) {
      fetchUserProfile();
    }
  }, [privyUser]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const token = await getAccessToken();
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setEditing(false);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") return;

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/user/profile", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        logout();
      }
    } catch (error) {
      console.error("Error deleting account:", error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load profile. Please try again later.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const getInitials = () => {
    if (user.name) {
      return user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile</h1>
          <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>
        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => {
              setEditing(false);
              setFormData({
                name: user.name || "",
                email: user.email || "",
                image: user.image || "",
              });
            }}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      {/* Profile Overview */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-start gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={user.image} />
                <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
              </Avatar>
              {editing && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full p-2"
                >
                  <Camera className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="flex-1 space-y-4">
              {editing ? (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h2 className="text-2xl font-bold">{user.name || "Unnamed User"}</h2>
                    <p className="text-gray-500">{user.email || "No email set"}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    {user.walletAddress && (
                      <Badge variant="secondary" className="font-mono">
                        <Wallet className="h-3 w-3 mr-1" />
                        {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                      </Badge>
                    )}
                    <Badge variant={user.emailVerified ? "default" : "secondary"}>
                      {user.emailVerified ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {user.emailVerified ? "Verified" : "Unverified"}
                    </Badge>
                    {user.subscription?.plan && (
                      <Badge className="bg-gradient-to-r from-blue-600 to-purple-600">
                        <Zap className="h-3 w-3 mr-1" />
                        {user.subscription.plan} Plan
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      Joined {format(new Date(user.createdAt), "MMM yyyy")}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      Last updated <ClientDate date={user.updatedAt} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="linked">Linked Accounts</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Key className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold">{user.stats?.totalApiKeys || 0}</span>
                </div>
                <p className="text-sm text-gray-500">API Keys</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Activity className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold">
                    {user.usage?.monthly?.requests?.toLocaleString() || 0}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Monthly Requests</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Database className="h-5 w-5 text-purple-600" />
                  <span className="text-2xl font-bold">
                    {user.usage?.today?.requests?.toLocaleString() || 0}
                  </span>
                </div>
                <p className="text-sm text-gray-500">Today&apos;s Requests</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                  <span className="text-2xl font-bold">{user.stats?.totalInvoices || 0}</span>
                </div>
                <p className="text-sm text-gray-500">Invoices</p>
              </CardContent>
            </Card>
          </div>

          {/* Usage Details */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
              <CardDescription>Your API usage for this billing period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Monthly Usage</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Total Requests</span>
                      <span className="font-medium">{user.usage?.monthly?.requests?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Successful</span>
                      <span className="font-medium">{user.usage?.monthly?.successCount?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Errors</span>
                      <span className="font-medium">{user.usage?.monthly?.errorCount?.toLocaleString() || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Data In</span>
                      <span className="font-medium">
                        {((user.usage?.monthly?.bytesIn || 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Data Out</span>
                      <span className="font-medium">
                        {((user.usage?.monthly?.bytesOut || 0) / 1024 / 1024).toFixed(2)} MB
                      </span>
                    </div>
                  </div>
                </div>
                
                {user.usage?.today && (
                  <div>
                    <h4 className="font-semibold mb-3">Today&apos;s Usage</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Total Requests</span>
                        <span className="font-medium">{user.usage.today.requests?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Successful</span>
                        <span className="font-medium">{user.usage.today.successCount?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Errors</span>
                        <span className="font-medium">{user.usage.today.errorCount?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Data In</span>
                        <span className="font-medium">
                          {((user.usage.today.bytesIn || 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Data Out</span>
                        <span className="font-medium">
                          {((user.usage.today.bytesOut || 0) / 1024 / 1024).toFixed(2)} MB
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="linked" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Linked Accounts</CardTitle>
              <CardDescription>Manage your connected accounts and wallets</CardDescription>
            </CardHeader>
            <CardContent>
              {user.linkedAccounts && user.linkedAccounts.length > 0 ? (
                <div className="space-y-4">
                  {user.linkedAccounts.map((account: any) => (
                    <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {account.type === 'wallet' && <Wallet className="h-5 w-5" />}
                        {account.type === 'google' && <Globe className="h-5 w-5" />}
                        {account.type === 'github' && <Github className="h-5 w-5" />}
                        {account.type === 'twitter' && <Twitter className="h-5 w-5" />}
                        <div>
                          <p className="font-medium capitalize">{account.type}</p>
                          <p className="text-sm text-gray-500">
                            {account.address || account.providerId || 'Connected'}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        <Link2 className="h-4 w-4 mr-2" />
                        Manage
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Wallet className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No linked accounts</p>
                  <Button className="mt-4">
                    <Link2 className="h-4 w-4 mr-2" />
                    Link Account
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent API keys and usage activity</CardDescription>
            </CardHeader>
            <CardContent>
              {user.apiKeys && user.apiKeys.length > 0 ? (
                <div className="space-y-4">
                  {user.apiKeys.map((key: any) => (
                    <div key={key.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Key className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium">{key.name}</p>
                          <p className="text-sm text-gray-500">
                            Created <ClientDate date={key.createdAt} />
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={key.active ? "default" : "secondary"}>
                          {key.active ? "Active" : "Inactive"}
                        </Badge>
                        {key.lastUsedAt && (
                          <span className="text-sm text-gray-500">
                            Last used <ClientDate date={key.lastUsedAt} />
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No API keys created yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <Button variant="outline">Enable</Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-semibold text-red-600">Danger Zone</h4>
                <div className="border border-red-200 rounded-lg p-4 space-y-4">
                  <div>
                    <p className="font-medium">Delete Account</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setShowDeleteModal(true)}
                  >
                    Delete Account
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Account Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete your account? This action cannot be undone.
              All your data, API keys, and settings will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Type <strong>DELETE</strong> to confirm account deletion.
              </AlertDescription>
            </Alert>
            <Input
              placeholder="Type DELETE to confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDeleteModal(false);
              setDeleteConfirmation("");
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE"}
            >
              Delete Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}