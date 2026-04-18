import { createHash } from 'crypto';

/**
 * Generate a cache key for LLM classification
 * Uses hash of title + description
 */
export function generateCacheKey(title: string, description?: string): string {
  const content = `${title}|${description || ''}`;
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Format duration from ISO 8601 to seconds
 */
export function parseDuration(duration: string): number {
  // Simplified parsing of PT1H2M3S format
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  const seconds = parseInt(match[3] || '0');
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toISOString().split('T')[0];
}

/**
 * Calculate pagination offset
 */
export function getPagination(page: number, pageSize: number): { skip: number; take: number } {
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize };
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error = new Error('Unknown error');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt === maxAttempts) break;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError;
}