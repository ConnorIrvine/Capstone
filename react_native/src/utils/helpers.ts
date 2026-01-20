/**
 * UTILITY FUNCTIONS
 * =================
 * Helper functions used throughout the app
 */

/**
 * Format timestamp to readable date string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Jan 14, 2026")
 */
export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format timestamp to time string
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time string (e.g., "10:30 AM")
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Format duration in seconds to readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "5 min" or "1:23:45")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  } else if (minutes > 0) {
    return `${minutes} min ${secs} sec`;
  } else {
    return `${secs} sec`;
  }
}

/**
 * Generate unique ID
 * @returns Unique identifier string
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Delay execution
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate average of array
 * @param values - Array of numbers
 * @returns Average value
 */
export function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculate standard deviation
 * @param values - Array of numbers
 * @returns Standard deviation
 */
export function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = average(values);
  const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Validate that a value is within physiological range
 * @param value - Value to check
 * @param min - Minimum valid value
 * @param max - Maximum valid value
 * @returns True if valid
 */
export function isPhysiologicallyValid(
  value: number,
  min: number,
  max: number
): boolean {
  return value >= min && value <= max;
}
