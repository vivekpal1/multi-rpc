"use client";

import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ClientDate } from "@/components/client-date";

const ApiKeyItem = memo(({ apiKey }: any) => (
  <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
    <div className="flex items-center gap-3">
      <Key className="h-4 w-4 text-gray-400" />
      <div>
        <p className="font-medium">{apiKey.name}</p>
        <p className="text-xs text-gray-500">
          Created <ClientDate date={apiKey.createdAt} />
        </p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      <Badge variant={apiKey.active ? "default" : "secondary"}>
        {apiKey.active ? "Active" : "Inactive"}
      </Badge>
      {apiKey.lastUsedAt && (
        <span className="text-xs text-gray-400">
          Used <ClientDate date={apiKey.lastUsedAt} />
        </span>
      )}
    </div>
  </div>
));

ApiKeyItem.displayName = "ApiKeyItem";

const ApiKeysList = memo(({ apiKeys = [] }: any) => (
  <Card className="border-0 shadow-lg">
    <CardHeader>
      <div className="flex items-center justify-between">
        <div>
          <CardTitle>API Keys</CardTitle>
          <CardDescription>Your active API keys</CardDescription>
        </div>
        <Link href="/dashboard/keys">
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </CardHeader>
    <CardContent>
      {apiKeys.length > 0 ? (
        <div className="space-y-3">
          {apiKeys.slice(0, 5).map((key: any) => (
            <ApiKeyItem key={key.id} apiKey={key} />
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Key className="h-12 w-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-3">No API keys yet</p>
          <Link href="/dashboard/keys">
            <Button>
              <Key className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </Link>
        </div>
      )}
    </CardContent>
  </Card>
));

ApiKeysList.displayName = "ApiKeysList";

export default ApiKeysList;