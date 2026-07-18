/**
 * ABOUTME: Retry utility for robust async operations
 * ABOUTME: Handles transient failures with exponential backoff
 *
 * TypeScript port of openkeywords/retry.py
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number; // ms
  maxDelay?: number; // ms
  exponentialBase?: number;
  onRetry?: (error: Error, attempt: number) => void;
}

/**
 * Retry utility with exponential backoff.
 *
 * Automatically retries failed async operations with increasing delays.
 */
export class RetryHandler {
  /**
   * Execute function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = 3,
      initialDelay = 1000,
      maxDelay = 30000,
      exponentialBase = 2,
      onRetry,
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxAttempts) {
          // Last attempt failed, throw error
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          initialDelay * Math.pow(exponentialBase, attempt - 1),
          maxDelay
        );

        console.warn(
          `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${delay}ms...`
        );

        if (onRetry) {
          onRetry(lastError, attempt);
        }

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Unknown error");
  }

  /**
   * Execute multiple functions in parallel with retry
   */
  static async allWithRetry<T>(
    fns: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<T[]> {
    return Promise.all(fns.map((fn) => this.withRetry(fn, options)));
  }

  /**
   * Execute functions with retry, allowing some to fail
   */
  static async allSettledWithRetry<T>(
    fns: Array<() => Promise<T>>,
    options: RetryOptions = {}
  ): Promise<PromiseSettledResult<T>[]> {
    return Promise.allSettled(
      fns.map((fn) => this.withRetry(fn, options))
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    const retryableErrors = [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "ECONNRESET",
      "EPIPE",
      "429", // Rate limit
      "500", // Server error
      "502", // Bad gateway
      "503", // Service unavailable
      "504", // Gateway timeout
    ];

    const errorStr = error.message.toLowerCase();

    return retryableErrors.some((retryable) =>
      errorStr.includes(retryable.toLowerCase())
    );
  }

  /**
   * Retry only if error is retryable
   */
  static async withSmartRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    return this.withRetry(async () => {
      try {
        return await fn();
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));

        // If not retryable, throw immediately
        if (!this.isRetryable(err)) {
          throw err;
        }

        // Otherwise let retry logic handle it
        throw err;
      }
    }, options);
  }
}

/**
 * Rate limiter for API calls
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private running = 0;

  constructor(
    private maxConcurrent: number = 5,
    private delayBetween: number = 100
  ) {}

  /**
   * Execute function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Wait for slot
    await this.waitForSlot();

    this.running++;

    try {
      const result = await fn();
      return result;
    } finally {
      this.running--;

      // Wait before allowing next request
      await RetryHandler["sleep"](this.delayBetween);

      // Process next in queue
      const next = this.queue.shift();
      if (next) {
        next();
      }
    }
  }

  /**
   * Wait for available slot
   */
  private waitForSlot(): Promise<void> {
    if (this.running < this.maxConcurrent) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  /**
   * Execute multiple functions with rate limiting
   */
  async executeAll<T>(fns: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(fns.map((fn) => this.execute(fn)));
  }
}
