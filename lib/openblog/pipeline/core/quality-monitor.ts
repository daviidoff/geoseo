/**
 * Quality Monitor - Tracks and alerts on quality metrics.
 *
 * Monitors:
 * - AEO scores over time
 * - Quality degradation trends
 * - Critical issues frequency
 * - Regeneration rates
 *
 * Alerts:
 * - Low quality articles (AEO < 70)
 * - Quality degradation trends
 * - High critical issue rates
 */

const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string) => console.error(`[ERROR] ${msg}`),
  critical: (msg: string) => console.error(`[CRITICAL] ${msg}`),
};

/**
 * Quality alert record.
 */
export interface QualityAlert {
  jobId: string;
  alertType: 'low_aeo' | 'degradation' | 'high_critical_issues' | 'critical_low_aeo';
  severity: 'warning' | 'critical';
  message: string;
  aeoScore?: number;
  timestamp: string;
  context: Record<string, any>;
}

/**
 * Monitors quality metrics and generates alerts.
 *
 * Tracks:
 * - Recent AEO scores (rolling window)
 * - Quality trends
 * - Critical issues frequency
 */
export class QualityMonitor {
  // Alert thresholds
  private static LOW_AEO_THRESHOLD = 70; // Alert if AEO < 70
  private static CRITICAL_AEO_THRESHOLD = 50; // Critical alert if AEO < 50
  private static DEGRADATION_THRESHOLD = 10; // Alert if average drops by 10+ points
  private static HIGH_CRITICAL_ISSUES_THRESHOLD = 3; // Alert if >3 critical issues

  private recentScores: number[] = [];
  private recentTimestamps: Date[] = [];
  private alerts: QualityAlert[] = [];
  private maxAlerts = 1000;

  // Statistics
  private totalArticles = 0;
  private lowQualityCount = 0;
  private criticalQualityCount = 0;

  constructor(private windowSize: number = 100) {}

  /**
   * Record quality metrics and check for alerts.
   *
   * @param jobId - Job identifier
   * @param qualityReport - Quality report from Stage 8
   * @returns QualityAlert if threshold exceeded, null otherwise
   */
  recordQuality(
    jobId: string,
    qualityReport: Record<string, any>
  ): QualityAlert | null {
    this.totalArticles += 1;

    const metrics = qualityReport.metrics || {};
    const aeoScore = metrics.aeo_score || 0;
    const criticalIssues = qualityReport.critical_issues || [];

    // Record score (maintain window size)
    this.recentScores.push(aeoScore);
    this.recentTimestamps.push(new Date());
    if (this.recentScores.length > this.windowSize) {
      this.recentScores.shift();
      this.recentTimestamps.shift();
    }

    // Check for alerts
    let alert: QualityAlert | null = null;

    // 1. Low AEO score alert
    if (aeoScore < QualityMonitor.CRITICAL_AEO_THRESHOLD) {
      this.criticalQualityCount += 1;
      alert = {
        jobId,
        alertType: 'critical_low_aeo',
        severity: 'critical',
        message: `Critical: AEO score ${aeoScore}/100 is below critical threshold (${QualityMonitor.CRITICAL_AEO_THRESHOLD})`,
        aeoScore,
        timestamp: new Date().toISOString(),
        context: {
          critical_issues: criticalIssues.length,
          suggestions: (qualityReport.suggestions || []).length,
        },
      };
    } else if (aeoScore < QualityMonitor.LOW_AEO_THRESHOLD) {
      this.lowQualityCount += 1;
      alert = {
        jobId,
        alertType: 'low_aeo',
        severity: 'warning',
        message: `Warning: AEO score ${aeoScore}/100 is below target threshold (${QualityMonitor.LOW_AEO_THRESHOLD})`,
        aeoScore,
        timestamp: new Date().toISOString(),
        context: {
          critical_issues: criticalIssues.length,
          suggestions: (qualityReport.suggestions || []).length,
        },
      };
    }

    // 2. High critical issues alert
    if (criticalIssues.length >= QualityMonitor.HIGH_CRITICAL_ISSUES_THRESHOLD) {
      if (alert === null) {
        alert = {
          jobId,
          alertType: 'high_critical_issues',
          severity: 'warning',
          message: `Warning: ${criticalIssues.length} critical issues detected`,
          aeoScore,
          timestamp: new Date().toISOString(),
          context: {
            critical_issues_count: criticalIssues.length,
            critical_issues: criticalIssues.slice(0, 5), // First 5
          },
        };
      } else {
        // Add to existing alert
        alert.context.critical_issues_count = criticalIssues.length;
        alert.context.critical_issues = criticalIssues.slice(0, 5);
      }
    }

    // 3. Quality degradation alert (if we have enough data)
    if (this.recentScores.length >= 20) {
      const degradationAlert = this.checkDegradation(jobId, aeoScore);
      if (degradationAlert) {
        // Combine with existing alert if present
        if (alert) {
          alert.message += ` | ${degradationAlert.message}`;
          alert.context = { ...alert.context, ...degradationAlert.context };
        } else {
          alert = degradationAlert;
        }
      }
    }

    // Store alert
    if (alert) {
      this.alerts.push(alert);
      if (this.alerts.length > this.maxAlerts) {
        this.alerts.shift();
      }

      // Log alert
      this.logAlert(alert);
    }

    return alert;
  }

  /**
   * Check for quality degradation trend.
   *
   * Compares recent average to older average to detect degradation.
   */
  private checkDegradation(
    jobId: string,
    currentScore: number
  ): QualityAlert | null {
    if (this.recentScores.length < 20) {
      return null;
    }

    // Split into two halves
    const midpoint = Math.floor(this.recentScores.length / 2);
    const olderScores = this.recentScores.slice(0, midpoint);
    const recentScores = this.recentScores.slice(midpoint);

    const olderAvg =
      olderScores.length > 0
        ? olderScores.reduce((a, b) => a + b, 0) / olderScores.length
        : 0;
    const recentAvg =
      recentScores.length > 0
        ? recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        : 0;

    const degradation = olderAvg - recentAvg;

    if (degradation >= QualityMonitor.DEGRADATION_THRESHOLD) {
      return {
        jobId,
        alertType: 'degradation',
        severity: 'warning',
        message: `Quality degradation detected: Average dropped from ${olderAvg.toFixed(1)} to ${recentAvg.toFixed(1)} (${degradation.toFixed(1)} points)`,
        aeoScore: currentScore,
        timestamp: new Date().toISOString(),
        context: {
          older_average: olderAvg,
          recent_average: recentAvg,
          degradation,
          sample_size: this.recentScores.length,
        },
      };
    }

    return null;
  }

  /**
   * Log quality alert.
   */
  private logAlert(alert: QualityAlert): void {
    if (alert.severity === 'critical') {
      logger.critical(
        `🚨 QUALITY ALERT [${alert.alertType}]: ${alert.message} (Job: ${alert.jobId}, AEO: ${alert.aeoScore})`
      );
    } else {
      logger.warn(
        `⚠️  QUALITY WARNING [${alert.alertType}]: ${alert.message} (Job: ${alert.jobId}, AEO: ${alert.aeoScore})`
      );
    }
  }

  /**
   * Get quality monitoring statistics.
   */
  getStatistics(): Record<string, any> {
    if (this.recentScores.length === 0) {
      return {
        total_articles: this.totalArticles,
        average_aeo: 0,
        low_quality_rate: 0,
        critical_quality_rate: 0,
        recent_alerts: this.alerts.length,
      };
    }

    const recentAvg =
      this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length;
    const lowQualityRate =
      (this.lowQualityCount / Math.max(this.totalArticles, 1)) * 100;
    const criticalQualityRate =
      (this.criticalQualityCount / Math.max(this.totalArticles, 1)) * 100;

    return {
      total_articles: this.totalArticles,
      recent_articles: this.recentScores.length,
      average_aeo: recentAvg,
      min_aeo: Math.min(...this.recentScores),
      max_aeo: Math.max(...this.recentScores),
      low_quality_count: this.lowQualityCount,
      critical_quality_count: this.criticalQualityCount,
      low_quality_rate: lowQualityRate,
      critical_quality_rate: criticalQualityRate,
      recent_alerts: this.alerts.filter((a) => this.isRecent(a, 24)).length,
      total_alerts: this.alerts.length,
    };
  }

  /**
   * Check if alert is within recent time window.
   */
  private isRecent(alert: QualityAlert, hours: number = 24): boolean {
    try {
      const alertTime = new Date(alert.timestamp);
      const now = new Date();
      const diff = now.getTime() - alertTime.getTime();
      return diff < hours * 60 * 60 * 1000;
    } catch {
      return false;
    }
  }

  /**
   * Get alerts from recent time window.
   */
  getRecentAlerts(hours: number = 24): QualityAlert[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter((alert) => {
      const alertTime = new Date(alert.timestamp);
      return alertTime >= cutoff;
    });
  }
}

// Global monitor instance
let qualityMonitorInstance: QualityMonitor | null = null;

export function getQualityMonitor(): QualityMonitor {
  if (qualityMonitorInstance === null) {
    qualityMonitorInstance = new QualityMonitor();
  }
  return qualityMonitorInstance;
}

export function resetQualityMonitor(): void {
  qualityMonitorInstance = null;
}
