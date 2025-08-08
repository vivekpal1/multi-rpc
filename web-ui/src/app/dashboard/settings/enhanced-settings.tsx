"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bell,
  Globe,
  Lock,
  Mail,
  Moon,
  Sun,
  Shield,
  Webhook,
  Key,
  Database,
  Zap,
  AlertCircle,
  CheckCircle,
  Save,
  Loader2,
  RefreshCw,
  Info,
  Code,
  Terminal,
  Palette,
  Volume2,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTheme } from "next-themes";

interface UserSettings {
  notifications: {
    email: boolean;
    apiErrors: boolean;
    usageAlerts: boolean;
    weeklyReports: boolean;
    productUpdates: boolean;
  };
  security: {
    twoFactorEnabled: boolean;
    apiKeyExpiry: string;
    ipWhitelist: string[];
  };
  preferences: {
    theme: string;
    language: string;
    timezone: string;
    dateFormat: string;
  };
  webhooks: {
    enabled: boolean;
    url: string;
    events: string[];
  };
}

export default function EnhancedSettingsPage() {
  const { user: privyUser, getAccessToken } = usePrivy();
  const themeResult = useTheme();
  const theme = themeResult?.theme || 'system';
  const setTheme = themeResult?.setTheme || (() => {});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      email: true,
      apiErrors: true,
      usageAlerts: true,
      weeklyReports: false,
      productUpdates: true,
    },
    security: {
      twoFactorEnabled: false,
      apiKeyExpiry: "90",
      ipWhitelist: [],
    },
    preferences: {
      theme: "system",
      language: "en",
      timezone: "UTC",
      dateFormat: "MM/DD/YYYY",
    },
    webhooks: {
      enabled: false,
      url: "",
      events: [],
    },
  });

  const [newIpAddress, setNewIpAddress] = useState("");
  const [showWebhookSecret, setShowWebhookSecret] = useState(false);
  const [webhookSecret, setWebhookSecret] = useState("whsec_" + Math.random().toString(36).substring(2, 15));

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      const response = await fetch("/api/user/settings", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (privyUser) {
      fetchSettings();
    }
  }, [privyUser]);

  useEffect(() => {
    if (settings.preferences.theme !== "system") {
      setTheme(settings.preferences.theme);
    }
  }, [settings.preferences.theme, setTheme]);

  const saveSettings = async () => {
    try {
      setSaving(true);
      const token = await getAccessToken();
      const response = await fetch("/api/user/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings }),
      });

      if (response.ok) {
        // Show success message
        console.log("Settings saved successfully");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const addIpAddress = () => {
    if (newIpAddress && !settings.security.ipWhitelist.includes(newIpAddress)) {
      setSettings({
        ...settings,
        security: {
          ...settings.security,
          ipWhitelist: [...settings.security.ipWhitelist, newIpAddress],
        },
      });
      setNewIpAddress("");
    }
  };

  const removeIpAddress = (ip: string) => {
    setSettings({
      ...settings,
      security: {
        ...settings.security,
        ipWhitelist: settings.security.ipWhitelist.filter(addr => addr !== ip),
      },
    });
  };

  const regenerateWebhookSecret = () => {
    setWebhookSecret("whsec_" + Math.random().toString(36).substring(2, 15));
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-500 mt-1">Manage your account preferences and configuration</p>
        </div>
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="notifications" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full lg:w-auto">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure which notifications you receive via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="email-notifications" className="text-base">
                    Email Notifications
                  </Label>
                  <p className="text-sm text-gray-500">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  id="email-notifications"
                  checked={settings.notifications.email}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      notifications: { ...settings.notifications, email: checked },
                    })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      API Errors
                    </Label>
                    <p className="text-sm text-gray-500">
                      Get notified when API errors exceed threshold
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.apiErrors}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, apiErrors: checked },
                      })
                    }
                    disabled={!settings.notifications.email}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      Usage Alerts
                    </Label>
                    <p className="text-sm text-gray-500">
                      Alerts when approaching usage limits
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.usageAlerts}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, usageAlerts: checked },
                      })
                    }
                    disabled={!settings.notifications.email}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4 text-blue-500" />
                      Weekly Reports
                    </Label>
                    <p className="text-sm text-gray-500">
                      Receive weekly usage summary reports
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.weeklyReports}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, weeklyReports: checked },
                      })
                    }
                    disabled={!settings.notifications.email}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base flex items-center gap-2">
                      <Bell className="h-4 w-4 text-purple-500" />
                      Product Updates
                    </Label>
                    <p className="text-sm text-gray-500">
                      New features and product announcements
                    </p>
                  </div>
                  <Switch
                    checked={settings.notifications.productUpdates}
                    onCheckedChange={(checked) =>
                      setSettings({
                        ...settings,
                        notifications: { ...settings.notifications, productUpdates: checked },
                      })
                    }
                    disabled={!settings.notifications.email}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Manage your account security and API access</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    Two-Factor Authentication
                  </Label>
                  <p className="text-sm text-gray-500">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={settings.security.twoFactorEnabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, twoFactorEnabled: checked },
                    })
                  }
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="api-key-expiry">API Key Expiry</Label>
                <Select
                  value={settings.security.apiKeyExpiry}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      security: { ...settings.security, apiKeyExpiry: value },
                    })
                  }
                >
                  <SelectTrigger id="api-key-expiry">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 days</SelectItem>
                    <SelectItem value="60">60 days</SelectItem>
                    <SelectItem value="90">90 days</SelectItem>
                    <SelectItem value="180">180 days</SelectItem>
                    <SelectItem value="365">1 year</SelectItem>
                    <SelectItem value="never">Never expire</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-gray-500">
                  Automatically expire API keys after this period
                </p>
              </div>

              <div className="space-y-2">
                <Label>IP Whitelist</Label>
                <p className="text-sm text-gray-500 mb-2">
                  Restrict API access to specific IP addresses
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter IP address (e.g., 192.168.1.1)"
                    value={newIpAddress}
                    onChange={(e) => setNewIpAddress(e.target.value)}
                  />
                  <Button onClick={addIpAddress} variant="outline">
                    Add IP
                  </Button>
                </div>
                {settings.security.ipWhitelist.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {settings.security.ipWhitelist.map((ip) => (
                      <div key={ip} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded">
                        <code className="text-sm">{ip}</code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeIpAddress(ip)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Display Preferences</CardTitle>
              <CardDescription>Customize your dashboard experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select
                  value={settings.preferences.theme}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, theme: value },
                    })
                  }
                >
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select
                  value={settings.preferences.language}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, language: value },
                    })
                  }
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="zh">中文</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={settings.preferences.timezone}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, timezone: value },
                    })
                  }
                >
                  <SelectTrigger id="timezone">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date-format">Date Format</Label>
                <Select
                  value={settings.preferences.dateFormat}
                  onValueChange={(value) =>
                    setSettings({
                      ...settings,
                      preferences: { ...settings.preferences, dateFormat: value },
                    })
                  }
                >
                  <SelectTrigger id="date-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Webhook Configuration</CardTitle>
              <CardDescription>Configure webhooks to receive real-time events</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Enable Webhooks</Label>
                  <p className="text-sm text-gray-500">
                    Receive real-time notifications via HTTP POST
                  </p>
                </div>
                <Switch
                  checked={settings.webhooks.enabled}
                  onCheckedChange={(checked) =>
                    setSettings({
                      ...settings,
                      webhooks: { ...settings.webhooks, enabled: checked },
                    })
                  }
                />
              </div>

              {settings.webhooks.enabled && (
                <>
                  <Separator />

                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      type="url"
                      placeholder="https://your-domain.com/webhook"
                      value={settings.webhooks.url}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          webhooks: { ...settings.webhooks, url: e.target.value },
                        })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook Secret</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showWebhookSecret ? "text" : "password"}
                          value={webhookSecret}
                          readOnly
                          className="pr-10"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowWebhookSecret(!showWebhookSecret)}
                        >
                          {showWebhookSecret ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button variant="outline" onClick={regenerateWebhookSecret}>
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Regenerate
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Use this secret to verify webhook payloads
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Events</Label>
                    <p className="text-sm text-gray-500 mb-2">
                      Select which events trigger webhooks
                    </p>
                    <div className="space-y-2">
                      {[
                        { id: "api_key.created", label: "API Key Created" },
                        { id: "api_key.deleted", label: "API Key Deleted" },
                        { id: "usage.limit_reached", label: "Usage Limit Reached" },
                        { id: "error.threshold", label: "Error Threshold Exceeded" },
                        { id: "endpoint.down", label: "Endpoint Down" },
                        { id: "endpoint.recovered", label: "Endpoint Recovered" },
                      ].map((event) => (
                        <div key={event.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={event.id}
                            checked={settings.webhooks.events.includes(event.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSettings({
                                  ...settings,
                                  webhooks: {
                                    ...settings.webhooks,
                                    events: [...settings.webhooks.events, event.id],
                                  },
                                });
                              } else {
                                setSettings({
                                  ...settings,
                                  webhooks: {
                                    ...settings.webhooks,
                                    events: settings.webhooks.events.filter(e => e !== event.id),
                                  },
                                });
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <Label htmlFor={event.id} className="text-sm font-normal cursor-pointer">
                            {event.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Webhooks will be sent as POST requests with a JSON payload.
                      Verify the signature using the webhook secret in the <code>X-Webhook-Signature</code> header.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}