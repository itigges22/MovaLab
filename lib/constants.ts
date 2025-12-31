/**
 * Global constants used throughout the application
 */

/**
 * Default weekly hours for users without explicit availability records
 * Used in capacity calculations to prevent zero-division and show meaningful data
 */
export const DEFAULT_WEEKLY_HOURS = 40;

/**
 * Default daily hours (DEFAULT_WEEKLY_HOURS / 5 work days)
 */
export const DEFAULT_DAILY_HOURS = 8;
