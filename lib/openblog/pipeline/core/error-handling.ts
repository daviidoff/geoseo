/**
 * Comprehensive Error Handling and Resilience for Blog Generation Pipeline
 *
 * Provides:
 * - Error categorization and classification
 * - Circuit breaker patterns for external services
 * - Automatic retry logic with exponential backoff
 * - Graceful degradation strategies
 * - Error reporting and monitoring
 * - Recovery mechanisms
 *
 * Production-grade error handling for 5-30 minute generation processes.
 */

// Configure logging
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string, extra?: any) => {
    console.error(`[ERROR] ${msg}`);
    if (extra) console.error(extra);
  },
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
  critical: (msg: string) => console.error(`[CRITICAL] ${msg}`),
};

/**
 * Error categories for classification and handling.
 */
export enum ErrorCategory {
  TRANSIENT = 'transient', // Temporary issues, retry recommended
  PERMANENT = 'permanent', // Permanent failures, don't retry
  RATE_LIMIT = 'rate_limit', // Rate limiting, retry with backoff
  AUTHENTICATION = 'authentication', // Auth issues, manual intervention
  VALIDATION = 'validation', // Input validation errors
  TIMEOUT = 'timeout', // Request timeouts
  EXTERNAL_SERVICE = 'external_service', // External API failures
  INTERNAL = 'internal', // Internal system errors
  UNKNOWN = 'unknown', // Unclassified errors
}

/**
 * Error severity levels.
 */
export enum ErrorSeverity {
  LOW = 'low', // Non-critical, job can continue
  MEDIUM = 'medium', // Important but recoverable
  HIGH = 'high', // Serious issue, affects quality
  CRITICAL = 'critical', // Fatal error, job must fail
}

/**
 * Context information for error analysis.
 */
export interface ErrorContext {
  error: Error;
  category: ErrorCategory;
  severity: ErrorSeverity;
  stage?: string;
  jobId?: string;
  timestamp: Date;
  retryCount: number;
  recoverable: boolean;
  metadata: Record<string, any>;
}

/**
 * Convert ErrorContext to dictionary for logging/storage.
 */
export function errorContextToDict(ctx: ErrorContext): Record<string, any> {
  return {
    error_type: ctx.error.name,
    error_message: ctx.error.message,
    category: ctx.category,
    severity: ctx.severity,
    stage: ctx.stage,
    job_id: ctx.jobId,
    timestamp: ctx.timestamp.toISOString(),
    retry_count: ctx.retryCount,
    recoverable: ctx.recoverable,
    metadata: ctx.metadata,
    traceback: ctx.error.stack,
  };
}

/**
 * Classifies errors into categories and severity levels.
 */
export class ErrorClassifier {
  // Error patterns for classification
  private static TRANSIENT_PATTERNS = [
    'connection',
    'timeout',
    '503',
    '502',
    '504',
    'temporarily unavailable',
    'network',
    'dns',
  ];

  private static RATE_LIMIT_PATTERNS = [
    'rate limit',
    '429',
    'quota exceeded',
    'too many requests',
    'throttle',
  ];

  private static AUTH_PATTERNS = [
    '401',
    '403',
    'unauthorized',
    'forbidden',
    'authentication',
    'api key',
    'invalid key',
  ];

  private static VALIDATION_PATTERNS = [
    'validation',
    '400',
    'bad request',
    'invalid input',
    'malformed',
    'schema',
  ];

  /**
   * Classify an error into category and severity.
   */
  static classifyError(error: Error, stage?: string): ErrorContext {
    const errorStr = error.message.toLowerCase();
    const errorType = error.name.toLowerCase();

    // Determine category
    let category = ErrorCategory.UNKNOWN;
    let severity = ErrorSeverity.MEDIUM;
    let recoverable = true;

    // Authentication errors
    if (this.AUTH_PATTERNS.some((pattern) => errorStr.includes(pattern))) {
      category = ErrorCategory.AUTHENTICATION;
      severity = ErrorSeverity.CRITICAL;
      recoverable = false;
    }
    // Validation errors
    else if (
      this.VALIDATION_PATTERNS.some((pattern) => errorStr.includes(pattern))
    ) {
      category = ErrorCategory.VALIDATION;
      severity = ErrorSeverity.HIGH;
      recoverable = false;
    }
    // Rate limiting
    else if (
      this.RATE_LIMIT_PATTERNS.some((pattern) => errorStr.includes(pattern))
    ) {
      category = ErrorCategory.RATE_LIMIT;
      severity = ErrorSeverity.MEDIUM;
      recoverable = true;
    }
    // Transient errors
    else if (
      this.TRANSIENT_PATTERNS.some((pattern) => errorStr.includes(pattern))
    ) {
      category = ErrorCategory.TRANSIENT;
      severity = ErrorSeverity.LOW;
      recoverable = true;
    }
    // Timeout errors
    else if (errorType.includes('timeout')) {
      category = ErrorCategory.TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
      recoverable = true;
    }
    // External service errors
    else if (
      stage &&
      ['gemini', 'url_validator', 'image'].some((ext) => stage.includes(ext))
    ) {
      category = ErrorCategory.EXTERNAL_SERVICE;
      severity = ErrorSeverity.MEDIUM;
      recoverable = true;
    }
    // Internal errors
    else {
      category = ErrorCategory.INTERNAL;
      severity = ErrorSeverity.HIGH;
      recoverable = true;
    }

    // Adjust severity based on stage criticality
    if (stage) {
      const criticalStages = ['stage_00', 'stage_02', 'stage_08', 'stage_09'];
      if (
        criticalStages.includes(stage) &&
        category !== ErrorCategory.AUTHENTICATION &&
        category !== ErrorCategory.VALIDATION
      ) {
        severity = ErrorSeverity.HIGH;
      }
    }

    return {
      error,
      category,
      severity,
      stage,
      recoverable,
      timestamp: new Date(),
      retryCount: 0,
      metadata: {},
    };
  }
}

/**
 * Circuit breaker for external service calls.
 *
 * Prevents cascading failures by temporarily blocking calls to failing services.
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: number;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private failureThreshold: number = 5,
    private recoveryTimeout: number = 60, // seconds
    private expectedExceptionType: any = Error
  ) {}

  /**
   * Wrap an async function with circuit breaker logic.
   */
  wrap<T>(func: (...args: any[]) => Promise<T>): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      if (this.state === 'open') {
        // Check if enough time has passed to try again
        const now = Date.now() / 1000;
        if (
          this.lastFailureTime &&
          now - this.lastFailureTime < this.recoveryTimeout
        ) {
          throw new Error(`Circuit breaker open for ${func.name}`);
        } else {
          this.state = 'half-open';
        }
      }

      try {
        const result = await func(...args);

        // Success - reset circuit
        if (this.state === 'half-open') {
          this.state = 'closed';
          this.failureCount = 0;
          logger.info(`Circuit breaker closed for ${func.name}`);
        }

        return result;
      } catch (e) {
        const error = e as Error;

        if (error instanceof this.expectedExceptionType || this.expectedExceptionType === Error) {
          this.failureCount += 1;
          this.lastFailureTime = Date.now() / 1000;

          if (this.failureCount >= this.failureThreshold) {
            this.state = 'open';
            logger.warn(
              `Circuit breaker opened for ${func.name} after ${this.failureCount} failures`
            );
          }
        }

        throw error;
      }
    };
  }
}

/**
 * Configuration for retry logic.
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // seconds
  backoffMultiplier: number;
  maxDelay: number; // seconds
  jitter: boolean;
}

/**
 * Execute function with retry logic and exponential backoff.
 */
export async function retryWithBackoff<T>(
  func: () => Promise<T>,
  config: RetryConfig,
  errorClassifier: typeof ErrorClassifier,
  stage?: string
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        logger.info(`Retry attempt ${attempt}/${config.maxRetries}`);
      }

      return await func();
    } catch (e) {
      lastError = e as Error;
      const errorContext = errorClassifier.classifyError(lastError, stage);

      // Don't retry non-recoverable errors
      if (!errorContext.recoverable) {
        logger.error(`Non-recoverable error: ${lastError.message}`);
        throw lastError;
      }

      // Don't retry on last attempt
      if (attempt >= config.maxRetries) {
        logger.error(`All retries exhausted: ${lastError.message}`);
        break;
      }

      // Calculate delay with jitter
      let actualDelay = delay;
      if (config.jitter) {
        actualDelay *= 0.5 + Math.random() * 0.5; // 50-100% of delay
      }

      logger.warn(
        `Attempt ${attempt + 1} failed: ${lastError.message}. Retrying in ${actualDelay.toFixed(1)}s...`
      );

      await new Promise((resolve) => setTimeout(resolve, actualDelay * 1000));
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }

  // All retries failed
  throw lastError!;
}

/**
 * Centralized error reporting and monitoring.
 */
export class ErrorReporter {
  private errorCounts: Record<string, number> = {};
  private lastErrors: ErrorContext[] = [];
  private maxErrorHistory = 100;

  /**
   * Report an error for monitoring and analysis.
   */
  reportError(errorContext: ErrorContext): void {
    // Update error counts
    const errorKey = `${errorContext.category}:${errorContext.stage || 'unknown'}`;
    this.errorCounts[errorKey] = (this.errorCounts[errorKey] || 0) + 1;

    // Add to error history
    this.lastErrors.push(errorContext);
    if (this.lastErrors.length > this.maxErrorHistory) {
      this.lastErrors.shift();
    }

    // Log error with structured data
    logger.error(
      `Error reported: ${errorContext.category} (${errorContext.severity}) in ${errorContext.stage}: ${errorContext.error.message}`,
      { error_context: errorContextToDict(errorContext) }
    );

    // Alert on critical errors
    if (errorContext.severity === ErrorSeverity.CRITICAL) {
      this.sendAlert(errorContext);
    }
  }

  private sendAlert(errorContext: ErrorContext): void {
    // In production, this would send to monitoring service
    logger.critical(
      `🚨 CRITICAL ERROR ALERT: ${errorContext.error.message} in job ${errorContext.jobId}`
    );
  }

  getErrorSummary(): Record<string, any> {
    return {
      total_errors: this.lastErrors.length,
      error_counts: this.errorCounts,
      recent_errors: this.lastErrors.slice(-10).map((err) => ({
        timestamp: err.timestamp.toISOString(),
        category: err.category,
        severity: err.severity,
        stage: err.stage,
        message: err.error.message.substring(0, 100),
      })),
    };
  }
}

/**
 * Strategies for graceful degradation when services fail.
 */
export class GracefulDegradation {
  static mockImageGeneration(): string {
    return 'https://via.placeholder.com/1200x630/2563eb/ffffff?text=Blog+Article+Image';
  }

  static fallbackCitation(title: string): string {
    return `https://www.google.com/search?q=${title.replace(/ /g, '+')}`;
  }

  static simpleInternalLinks(
    keywords: string[],
    baseUrl: string
  ): Array<{ url: string; text: string; description: string }> {
    return keywords.slice(0, 3).map((keyword) => ({
      url: `${baseUrl}/blog/${keyword.toLowerCase().replace(/ /g, '-')}`,
      text: keyword
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' '),
      description: `Learn more about ${keyword}`,
    }));
  }

  static basicMetaDescription(headline: string, content: string): string {
    // Extract first sentence from content
    const sentences = content.split('. ');
    const firstSentence = sentences[0] || headline;

    // Truncate to meta description length
    let metaDesc = firstSentence.substring(0, 150);
    if (firstSentence.length > 150) {
      metaDesc = metaDesc.substring(0, metaDesc.lastIndexOf(' ')) + '...';
    }

    return metaDesc;
  }
}

// Global error reporter instance
export const errorReporter = new ErrorReporter();
export const errorClassifier = ErrorClassifier;

// Predefined retry configurations
export const RETRY_CONFIGS: Record<string, RetryConfig> = {
  api_calls: {
    maxRetries: 3,
    initialDelay: 2.0,
    backoffMultiplier: 2.0,
    maxDelay: 30.0,
    jitter: true,
  },
  url_validation: {
    maxRetries: 2,
    initialDelay: 1.0,
    backoffMultiplier: 2.0,
    maxDelay: 10.0,
    jitter: true,
  },
  image_generation: {
    maxRetries: 2,
    initialDelay: 5.0,
    backoffMultiplier: 2.0,
    maxDelay: 60.0,
    jitter: true,
  },
  critical_operations: {
    maxRetries: 5,
    initialDelay: 1.0,
    backoffMultiplier: 2.0,
    maxDelay: 120.0,
    jitter: true,
  },
};

// Circuit breakers for external services
// NOTE: Short recovery timeouts for serverless deployments (containers get recycled)
export const circuitBreakers = {
  gemini_api: new CircuitBreaker(5, 30), // 30 seconds
  image_api: new CircuitBreaker(3, 30),
  url_validation: new CircuitBreaker(10, 15),
};

/**
 * Decorator-like function for comprehensive error handling.
 */
export function withErrorHandling<T>(
  stage: string,
  retryConfig?: RetryConfig,
  circuitBreaker?: CircuitBreaker,
  fallback?: (...args: any[]) => T
) {
  return (func: (...args: any[]) => Promise<T>) => {
    return async (...args: any[]): Promise<T> => {
      try {
        // Apply circuit breaker if provided
        const actualFunc = circuitBreaker ? circuitBreaker.wrap(func) : func;

        // Apply retry logic if provided
        if (retryConfig) {
          return await retryWithBackoff(
            () => actualFunc(...args),
            retryConfig,
            errorClassifier,
            stage
          );
        } else {
          return await actualFunc(...args);
        }
      } catch (e) {
        const error = e as Error;

        // Classify and report error
        const errorContext = errorClassifier.classifyError(error, stage);
        errorContext.jobId = args[0]?.jobId;
        errorReporter.reportError(errorContext);

        // Try fallback if available
        if (fallback && errorContext.recoverable) {
          logger.warn(`Using fallback after error: ${error.message}`);
          try {
            return fallback(...args);
          } catch (fallbackError) {
            logger.error(`Fallback also failed: ${(fallbackError as Error).message}`);
          }
        }

        // Re-raise the original error
        throw error;
      }
    };
  };
}

// Convenience functions for common patterns
export function withApiRetry<T>(stage: string) {
  return withErrorHandling<T>(
    stage,
    RETRY_CONFIGS.api_calls,
    circuitBreakers.gemini_api
  );
}

export function withUrlValidationRetry<T>(stage: string) {
  return withErrorHandling<T>(
    stage,
    RETRY_CONFIGS.url_validation,
    circuitBreakers.url_validation
  );
}

export function withImageFallback<T>(stage: string) {
  return withErrorHandling<T>(
    stage,
    RETRY_CONFIGS.image_generation,
    circuitBreakers.image_api,
    () => GracefulDegradation.mockImageGeneration() as T
  );
}
