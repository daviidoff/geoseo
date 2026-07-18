/**
 * CTO-Level Debug Logger
 * Production-grade debugging system for critical service monitoring
 */

interface LogContext {
  service: string
  operation: string
  requestId?: string
  userId?: string
  timestamp: number
  environment: string
  platform: string
}

interface LogData {
  [key: string]: any
}

interface CriticalError {
  name: string
  message: string
  stack?: string[]
  code?: string
  cause?: any
  context: LogContext
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

class CTOLogger {
  public context: LogContext

  constructor(service: string, operation: string) {
    this.context = {
      service,
      operation,
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      environment: process.env.NODE_ENV || 'unknown',
      platform: process.env.RENDER ? 'render' : 'local'
    }
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private formatLog(level: string, message: string, data?: LogData): string {
    const logEntry = {
      level,
      message,
      context: this.context,
      data: data || {},
      iso_timestamp: new Date(this.context.timestamp).toISOString()
    }
    return JSON.stringify(logEntry, null, 2)
  }

  /**
   * Info level - operational data
   */
  info(message: string, data?: LogData): void {
    console.log(`[CTO:INFO] ${this.formatLog('INFO', message, data)}`)
  }

  /**
   * Warning level - potential issues
   */
  warn(message: string, data?: LogData): void {
    console.warn(`[CTO:WARN] ${this.formatLog('WARN', message, data)}`)
  }

  /**
   * Error level - service failures
   */
  error(message: string, error?: any, data?: LogData): void {
    const errorData = {
      ...data,
      error: error ? {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 10),
        cause: error.cause
      } : null
    }
    console.error(`[CTO:ERROR] ${this.formatLog('ERROR', message, errorData)}`)
  }

  /**
   * Critical level - system failures requiring immediate attention
   */
  critical(message: string, error?: any, data?: LogData): void {
    const criticalError: CriticalError = {
      name: error?.name || 'UnknownError',
      message: error?.message || message,
      stack: error?.stack?.split('\n'),
      code: error?.code,
      cause: error?.cause,
      context: this.context,
      severity: 'CRITICAL'
    }

    console.error(`[CTO:CRITICAL] ${this.formatLog('CRITICAL', message, { ...data, criticalError })}`)
    
    // TODO: In production, send to monitoring service (Sentry, DataDog, etc.)
    if (process.env.NODE_ENV === 'production') {
      // Send to monitoring service
      this.sendToMonitoring(criticalError)
    }
  }

  /**
   * Performance monitoring
   */
  perf(operation: string, startTime: number, data?: LogData): void {
    const duration = Date.now() - startTime
    const perfData = {
      operation,
      duration_ms: duration,
      duration_readable: `${duration}ms`,
      ...data
    }
    
    if (duration > 10000) { // > 10 seconds
      this.warn(`Slow operation detected: ${operation}`, perfData)
    } else {
      this.info(`Performance: ${operation}`, perfData)
    }
  }

  /**
   * Service health check
   */
  health(service: string, status: 'UP' | 'DOWN' | 'DEGRADED', data?: LogData): void {
    const healthData = {
      service,
      status,
      timestamp: new Date().toISOString(),
      ...data
    }

    if (status === 'DOWN') {
      this.critical(`Service down: ${service}`, null, healthData)
    } else if (status === 'DEGRADED') {
      this.warn(`Service degraded: ${service}`, healthData)
    } else {
      this.info(`Service healthy: ${service}`, healthData)
    }
  }

  /**
   * Track API calls
   */
  apiCall(method: string, url: string, status: number, duration: number, data?: LogData): void {
    const apiData = {
      method,
      url,
      status,
      duration_ms: duration,
      success: status >= 200 && status < 400,
      ...data
    }

    if (status >= 500) {
      this.error(`API call failed: ${method} ${url}`, null, apiData)
    } else if (status >= 400) {
      this.warn(`API call error: ${method} ${url}`, apiData)
    } else {
      this.info(`API call success: ${method} ${url}`, apiData)
    }
  }

  /**
   * Track business metrics
   */
  metric(name: string, value: number | string, unit?: string, data?: LogData): void {
    const metricData = {
      metric_name: name,
      metric_value: value,
      metric_unit: unit,
      ...data
    }
    this.info(`Metric: ${name}`, metricData)
  }

  private sendToMonitoring(error: CriticalError): void {
    // TODO: Implement monitoring service integration
    console.log('[CTO:MONITORING] Would send to monitoring service:', error)
  }

  /**
   * Create child logger for sub-operations
   */
  child(operation: string): CTOLogger {
    const childLogger = new CTOLogger(this.context.service, operation)
    childLogger.context.requestId = this.context.requestId // Inherit request ID
    return childLogger
  }
}

export default CTOLogger

/**
 * Factory function for creating loggers
 */
export function createLogger(service: string, operation: string): CTOLogger {
  return new CTOLogger(service, operation)
}

/**
 * Express middleware for request logging
 */
export function requestLoggingMiddleware(req: any, res: any, next: any) {
  const logger = createLogger('api', req.url)
  const startTime = Date.now()

  req.logger = logger
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  })

  res.on('finish', () => {
    logger.apiCall(req.method, req.url, res.statusCode, Date.now() - startTime)
  })

  next()
}