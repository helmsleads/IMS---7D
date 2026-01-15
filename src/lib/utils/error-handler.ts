/**
 * Error handling utilities for API and application errors
 */

interface ApiErrorResponse {
  message?: string;
  error?: string;
  details?: string;
  code?: string;
}

/**
 * Extracts a meaningful error message from various error types
 * Logs the full error to console for debugging
 * Returns a user-friendly message
 */
export function handleApiError(error: unknown): string {
  // Log full error for debugging
  console.error("API Error:", error);

  // Handle null/undefined
  if (!error) {
    return "An unexpected error occurred. Please try again.";
  }

  // Handle Error instances
  if (error instanceof Error) {
    // Check for common error patterns
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes("fetch") || message.includes("network")) {
      return "Unable to connect to the server. Please check your internet connection.";
    }

    // Authentication errors
    if (message.includes("unauthorized") || message.includes("401")) {
      return "Your session has expired. Please log in again.";
    }

    // Permission errors
    if (message.includes("forbidden") || message.includes("403")) {
      return "You don't have permission to perform this action.";
    }

    // Not found errors
    if (message.includes("not found") || message.includes("404")) {
      return "The requested resource was not found.";
    }

    // Validation errors
    if (message.includes("invalid") || message.includes("validation")) {
      return error.message;
    }

    // Database/Supabase specific errors
    if (message.includes("duplicate") || message.includes("unique")) {
      return "This record already exists.";
    }

    if (message.includes("foreign key") || message.includes("reference")) {
      return "This item is referenced by other records and cannot be modified.";
    }

    // Return original message if it's user-friendly (not too technical)
    if (error.message.length < 100 && !message.includes("error:")) {
      return error.message;
    }

    return "An error occurred while processing your request.";
  }

  // Handle API response objects
  if (typeof error === "object") {
    const apiError = error as ApiErrorResponse;

    if (apiError.message) {
      return apiError.message;
    }

    if (apiError.error) {
      return apiError.error;
    }

    if (apiError.details) {
      return apiError.details;
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    return error;
  }

  // Default fallback
  return "An unexpected error occurred. Please try again.";
}

/**
 * Wraps an async function with error handling
 * Returns [result, error] tuple
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<[T | null, string | null]> {
  try {
    const result = await fn();
    return [result, null];
  } catch (error) {
    return [null, handleApiError(error)];
  }
}

/**
 * Creates a standardized error for throwing
 */
export function createError(message: string, code?: string): Error {
  const error = new Error(message);
  if (code) {
    (error as Error & { code: string }).code = code;
  }
  return error;
}
