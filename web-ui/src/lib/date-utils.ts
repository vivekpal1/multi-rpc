import { formatDistanceToNow as formatDistanceToNowOriginal, format as formatOriginal } from "date-fns";

/**
 * Safe wrapper for formatDistanceToNow that avoids hydration issues
 * Returns a placeholder during SSR and the actual value on client
 */
export function formatDistanceToNow(date: Date | string, options?: any): string {
  if (typeof window === 'undefined') {
    // During SSR, return a placeholder
    return 'Loading...';
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatDistanceToNowOriginal(dateObj, options);
}

/**
 * Safe wrapper for format that avoids hydration issues
 */
export function format(date: Date | string, formatStr: string): string {
  if (typeof window === 'undefined') {
    // During SSR, return a placeholder
    return 'Loading...';
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatOriginal(dateObj, formatStr);
}

/**
 * Hook to get properly formatted dates after hydration
 */
export function useFormattedDate(date: Date | string | null, formatter: (date: Date) => string): string {
  if (!date) return 'Never';
  
  if (typeof window === 'undefined') {
    return 'Loading...';
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatter(dateObj);
}