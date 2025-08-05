"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuth } from "@/hooks/use-auth";
import {
  User,
  Bell,
  Shield,
  Globe,
  Key,
  Loader2,
  CheckCircle,
  AlertCircle,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface UserSettings {
  notifications: {
    email: boolean;
    endpoints: boolean;
    usage: boolean;
    billing: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    apiKeyExpiration: number; // days
  };
  preferences: {
    timezone: string;
    dateFormat: string;
    theme: string;
  };
}

export default function SettingsPage() {
  const { getAccessToken } = usePrivy();
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      endpoints: true,
      usage: true,
      billing: true,
    },
    security: {
      twoFactorEnabled: false,
      apiKeyExpiration: 90,
    },
    preferences: {
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
      theme: "light",
    },
  });
  const [profileName, setProfileName] = useState(user?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/user/settings", {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateProfile = async () => {
    setIsSaving(true);
    try {
      const token = await getAccessToken();
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ name: profileName }),
      });

      if (response.ok) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
      </div>

      {showSuccess && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Settings saved successfully
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={profileName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProfileName(e.target.value)}
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-gray-100"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Email cannot be changed
                </p>
              </div>

              {user?.walletAddress && (
                <div>
                  <Label htmlFor="wallet">Wallet Address</Label>
                  <div className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-gray-400" />
                    <Input
                      id="wallet"
                      value={user.walletAddress}
                      disabled
                      className="bg-gray-100 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="userId">User ID</Label>
                <Input
                  id="userId"
                  value={user?.id || ""}
                  disabled
                  className="bg-gray-100 font-mono text-sm"
                />
              </div>

              <Button onClick={updateProfile} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Update Profile"
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6 border-red-200">
            <h2 className="text-lg font-semibold mb-4 text-red-600">Danger Zone</h2>
            <p className="text-sm text-gray-600 mb-4">
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <Button variant="destructive">Delete Account</Button>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Email Notifications</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-sm text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notif"
                  checked={settings.notifications.email}
                  onCheckedChange={(checked: boolean) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email: checked },
                    })
                  }
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="endpoint-notif">Endpoint Alerts</Label>
                  <p className="text-sm text-gray-500">
                    Get notified when endpoints go down
                  </p>
                </div>
                <Switch
                  id="endpoint-notif"
                  checked={settings.notifications.endpoints}
                  onCheckedChange={(checked: boolean) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, endpoints: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="usage-notif">Usage Alerts</Label>
                  <p className="text-sm text-gray-500">
                    Alerts when approaching usage limits
                  </p>
                </div>
                <Switch
                  id="usage-notif"
                  checked={settings.notifications.usage}
                  onCheckedChange={(checked: boolean) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, usage: checked },
                    })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="billing-notif">Billing Updates</Label>
                  <p className="text-sm text-gray-500">
                    Payment receipts and billing updates
                  </p>
                </div>
                <Switch
                  id="billing-notif"
                  checked={settings.notifications.billing}
                  onCheckedChange={(checked: boolean) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, billing: checked },
                    })
                  }
                />
              </div>
            </div>

            <Button onClick={saveSettings} disabled={isSaving} className="mt-4">
              Save Notification Settings
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Security Settings</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="2fa">Two-Factor Authentication</Label>
                  <p className="text-sm text-gray-500">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  id="2fa"
                  checked={settings.security.twoFactorEnabled}
                  onCheckedChange={(checked: boolean) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, twoFactorEnabled: checked },
                    })
                  }
                />
              </div>

              <Separator />

              <div>
                <Label htmlFor="key-expiration">API Key Expiration</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Automatically expire API keys after a certain period
                </p>
                <Select
                  value={settings.security.apiKeyExpiration.toString()}
                  onValueChange={(value: string) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, apiKeyExpiration: parseInt(value) },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={isSaving} className="mt-4">
              Save Security Settings
            </Button>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Current Session</p>
                  <p className="text-sm text-gray-500">Chrome on macOS • San Francisco, CA</p>
                </div>
                <Badge className="bg-green-100 text-green-800">Active</Badge>
              </div>
            </div>
            <Button variant="outline" className="mt-4">
              Sign Out All Other Sessions
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Preferences</h2>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.preferences.timezone}
                  onValueChange={(value: string) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, timezone: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dateFormat">Date Format</Label>
                <Select
                  value={settings.preferences.dateFormat}
                  onValueChange={(value: string) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, dateFormat: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.preferences.theme}
                  onValueChange={(value: string) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, theme: value },
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={saveSettings} disabled={isSaving} className="mt-4">
              Save Preferences
            </Button>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}