"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, format } from "date-fns";

interface ClientDateProps {
  date: Date | string | null;
  format?: 'relative' | 'absolute';
  formatString?: string;
  addSuffix?: boolean;
  fallback?: string;
}

export function ClientDate({ 
  date, 
  format: formatType = 'relative', 
  formatString = 'PPP',
  addSuffix = true,
  fallback = 'Never'
}: ClientDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!date) {
    return <span>{fallback}</span>;
  }

  // During SSR or before mount, show a placeholder
  if (!mounted) {
    return <span className="opacity-50">...</span>;
  }

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  if (formatType === 'relative') {
    return <span>{formatDistanceToNow(dateObj, { addSuffix })}</span>;
  }

  return <span>{format(dateObj, formatString)}</span>;
}