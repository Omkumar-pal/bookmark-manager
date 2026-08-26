import { badUserInputError } from "./errors.js";

/**
 * Validates a bookmark or folder title/name.
 * Rejects empty or whitespace-only strings.
 */
export function validateTitle(title: string, fieldName = "Title"): string {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    throw badUserInputError(`${fieldName} cannot be empty or whitespace-only.`);
  }
  return trimmed;
}

/**
 * Validates a bookmark URL.
 * Rejects malformed strings and non-HTTP(S) protocols.
 */
export function validateUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw badUserInputError("URL cannot be empty.");
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw badUserInputError("URL must use http: or https: protocol.");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof Error && error.message.includes("protocol")) {
      throw error;
    }
    throw badUserInputError(`Invalid or malformed URL: "${rawUrl}".`);
  }
}
