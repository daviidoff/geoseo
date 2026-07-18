/**
 * Fetch utilities with retry logic and enhanced error handling
 * Provides production-grade HTTP request handling for long-running operations
 */

export interface FetchWithRetryOptions extends RequestInit {
  /** Maximum number of retry attempts (default: 2) */
  maxRetries?: number
  /** Base delay in milliseconds for exponential backoff (default: 1000) */
  baseDelay?: number
  /** Timeout in milliseconds (default: 600000 = 10 minutes) */
  timeout?: number
  /** Callback for retry attempts */
  onRetry?: (attempt: number, error: Error) => void
}

export interface FetchError extends Error {
  status?: number
  statusText?: string
  isNetworkError: boolean
  isTimeoutError: boolean
  isServerError: boolean
  isAborted: boolean
  cause?: Error
}

/**
 * Creates a typed fetch error with categorization
 */
function createFetchError(
  message: string,
  options: {
    status?: number
    statusText?: string
    isNetworkError?: boolean
    isTimeoutError?: boolean
    isServerError?: boolean
    isAborted?: boolean
    cause?: Error
  }
): FetchError {
  const error = new Error(message) as FetchError
  error.status = options.status
  error.statusText = options.statusText
  error.isNetworkError = options.isNetworkError ?? false
  error.isTimeoutError = options.isTimeoutError ?? false
  error.isServerError = options.isServerError ?? false
  error.isAborted = options.isAborted ?? false
  if (options.cause) {
    error.cause = options.cause
  }
  return error
}

/**
 * Performs a fetch with automatic retry for transient failures
 * Uses exponential backoff between retries
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with retry configuration
 * @returns Response object if successful
 * @throws FetchError with categorized error type
 */
export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const {
    maxRetries = 2,
    baseDelay = 1000,
    timeout = 1800000, // 30 minutes default (matches API route maxDuration)
    onRetry,
    ...fetchOptions
  } = options

  let lastError: FetchError | null = null
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  // Merge abort signals if one was provided
  const signal = fetchOptions.signal
    ? mergeAbortSignals(fetchOptions.signal, controller.signal)
    : controller.signal

  try {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal,
        })

        // Success - return immediately
        if (response.ok) {
          return response
        }

        // Client error (4xx) - don't retry, return response for handling
        if (response.status >= 400 && response.status < 500) {
          return response
        }

        // Server error (5xx) - may be transient, worth retrying
        lastError = createFetchError(
          `Server error: ${response.status} ${response.statusText}`,
          {
            status: response.status,
            statusText: response.statusText,
            isServerError: true,
          }
        )
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            // Check if it was our timeout or user abort
            if (controller.signal.aborted) {
              throw createFetchError(
                `Request timeout after ${timeout / 1000} seconds`,
                { isTimeoutError: true, isAborted: true, cause: error }
              )
            }
            throw createFetchError('Request was cancelled', {
              isAborted: true,
              cause: error,
            })
          }

          // Network error - worth retrying
          lastError = createFetchError(
            `Network error: ${error.message}`,
            { isNetworkError: true, cause: error }
          )
        } else {
          lastError = createFetchError('Unknown fetch error', {
            isNetworkError: true,
          })
        }
      }

      // If we have more retries, wait with exponential backoff
      if (attempt < maxRetries && lastError) {
        const delay = baseDelay * Math.pow(2, attempt)
        onRetry?.(attempt + 1, lastError)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    // All retries exhausted
    throw lastError ?? createFetchError('All retry attempts failed', {})
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Checks if the server is healthy by calling the health endpoint
 *
 * @param baseUrl - Base URL of the server (default: same origin)
 * @returns true if server is responding, false otherwise
 */
export async function checkServerHealth(baseUrl = ''): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout for health check
    })
    return response.ok || response.status === 503 // 503 = degraded but alive
  } catch {
    return false
  }
}

/**
 * Merges multiple abort signals into one
 * Aborts when any of the input signals abort
 */
function mergeAbortSignals(
  signal1: AbortSignal,
  signal2: AbortSignal
): AbortSignal {
  const controller = new AbortController()

  const abort = () => controller.abort()

  if (signal1.aborted || signal2.aborted) {
    controller.abort()
  } else {
    signal1.addEventListener('abort', abort, { once: true })
    signal2.addEventListener('abort', abort, { once: true })
  }

  return controller.signal
}

/**
 * Gets a user-friendly error message from a FetchError
 */
export function getFriendlyErrorMessage(error: FetchError): string {
  if (error.isTimeoutError) {
    return 'The request timed out. Please try again with fewer items.'
  }
  if (error.isAborted) {
    return 'The request was cancelled.'
  }
  if (error.isNetworkError) {
    return 'Network connection failed. Please check your internet connection and try again.'
  }
  if (error.isServerError) {
    return `Server error (${error.status}). The server may be overloaded. Please try again in a moment.`
  }
  return error.message || 'An unexpected error occurred.'
}
