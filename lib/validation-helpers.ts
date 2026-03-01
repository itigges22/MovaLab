import { z } from 'zod';

/** UUID regex that supports both RFC 4122 and simplified UUIDs (used by demo/seed data) */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Zod schema for UUID v4 validation */
export const uuidSchema = z.string().regex(UUID_REGEX, 'Invalid UUID format');

/** Validate a UUID string, returning null if invalid */
export function validateUUID(value: string): string | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

/** Check if a string is a valid UUID format */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/** Safe JSON body parser - returns parsed body or null with error message */
export async function safeParseBody<T>(
  request: Request,
  schema: z.ZodSchema<T>
): Promise<{ data: T; error?: never } | { data?: never; error: string }> {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return { error: result.error.issues.map((e: z.ZodIssue) => e.message).join(', ') };
    }
    return { data: result.data };
  } catch {
    return { error: 'Invalid JSON body' };
  }
}
