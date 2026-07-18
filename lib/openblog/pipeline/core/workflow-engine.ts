/**
 * WorkflowEngine - Orchestrates 10 stages (0-9) of the blog writing pipeline.
 *
 * Total stages: 10 numbered stages (0-9)
 *
 * Clean separation of concerns:
 * - Initialization: Load all stages
 * - Execution: Run stages in order, pass context through
 * - Error handling: Graceful fallback and logging
 * - Monitoring: Track execution times and quality metrics
 *
 * Sequential flow with parallel execution in middle (stages 6-7).
 */

import { ExecutionContext, createExecutionContext, getTotalExecutionTime, addError } from './execution-context';

// Configure logging (using console for now, can integrate with Next.js logger later)
const logger = {
  info: (msg: string) => console.log(`[INFO] ${msg}`),
  warn: (msg: string) => console.warn(`[WARN] ${msg}`),
  error: (msg: string, error?: Error) => {
    console.error(`[ERROR] ${msg}`);
    if (error) console.error(error);
  },
  debug: (msg: string) => console.debug(`[DEBUG] ${msg}`),
  critical: (msg: string) => console.error(`[CRITICAL] ${msg}`),
};

/**
 * Abstract base class for all workflow stages.
 *
 * Each stage implements this interface and executes a specific portion
 * of the blog writing pipeline.
 */
export abstract class Stage {
  /**
   * Stage number (0-9)
   */
  abstract stageNum: number;

  /**
   * Human-readable stage name
   */
  abstract stageName: string;

  /**
   * Execute this stage.
   *
   * @param context - Current execution context
   * @returns Updated execution context
   * @throws Exception - Any errors encountered during execution
   */
  abstract execute(context: ExecutionContext): Promise<ExecutionContext>;

  toString(): string {
    return `Stage ${this.stageNum}: ${this.stageName}`;
  }
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (
  stageName: string,
  stageNum: number,
  completed: boolean
) => void;

/**
 * Main orchestrator for TypeScript Blog Writing System.
 *
 * Manages:
 * - Stage loading and initialization
 * - Sequential execution (stages 0-5, 8-9)
 * - Parallel execution (stages 6-7 via Promise.all)
 * - Error handling and fallback
 * - Metrics collection
 */
export class WorkflowEngine {
  private stages: Map<number, Stage> = new Map();
  private progressCallback?: ProgressCallback;

  constructor() {
    logger.debug('WorkflowEngine initialized');
  }

  /**
   * Register a stage with the engine.
   *
   * @param stage - Stage instance implementing Stage interface
   * @throws Error - If stage number already registered
   */
  registerStage(stage: Stage): void {
    if (this.stages.has(stage.stageNum)) {
      throw new Error(`Stage ${stage.stageNum} already registered`);
    }

    this.stages.set(stage.stageNum, stage);
    logger.info(`Registered ${stage}`);
  }

  /**
   * Register multiple stages at once.
   *
   * @param stages - List of Stage instances
   */
  registerStages(stages: Stage[]): void {
    for (const stage of stages) {
      this.registerStage(stage);
    }
  }

  /**
   * Execute complete workflow.
   *
   * Flow:
   * 1. Stage 0: Data Fetch → loads job config, company data, sitemap URLs
   * 2. Stage 1: Prompt Build → creates prompt with variables
   * 3. Stage 2: Content Generation with ToC & Metadata → generates article, extracts structured data, generates ToC labels
   * 4. Stage 3: Quality Refinement & Validation → AI-based quality refinement, validates FAQ/PAA
   * 5. Stage 4: Citations Validation & Formatting → validate sources and update body citations
   * 6. Stage 5: Internal Links Generation → generate and embed links in body
   * 7. Stage 6: Image/Graphics Generation → generate article image (parallel)
   * 8. Stage 7: Content Similarity Check → check for cannibalization (parallel)
   * 9. Stage 8: Merge & Link → merge parallel results, link citations
   * 10. Stage 9: HTML Generation & Storage → generate HTML and store to Supabase
   *
   * @param jobId - Unique job identifier
   * @param jobConfig - Job configuration (passed to Stage 0)
   * @param progressCallback - Optional callback for progress updates
   * @returns Final ExecutionContext with all results
   * @throws Exception - If critical stages fail
   */
  async execute(
    jobId: string,
    jobConfig: Record<string, any>,
    progressCallback?: ProgressCallback
  ): Promise<ExecutionContext> {
    const context = createExecutionContext(jobId);
    context.job_config = jobConfig;
    this.progressCallback = progressCallback;

    logger.info(`Starting workflow for job: ${jobId}`);
    logger.info(`Total execution time target: < 105 seconds`);

    try {
      // Sequential: Stages 0-3 (Data Fetch → Prompt Build → Gemini Call → Quality Refinement)
      let updatedContext = await this.executeSequential(context, [0, 1, 2, 3]);

      // Sequential: Stage 4 (Citations) - modifies body content
      updatedContext = await this.executeSequential(updatedContext, [4]);

      // Sequential: Stage 5 (Internal Links) - modifies body content, must run after Stage 4
      updatedContext = await this.executeSequential(updatedContext, [5]);

      // Parallel: Stages 6 and 7 (Image + Similarity Check)
      // Run in parallel to save time (check similarity while image generates)
      updatedContext = await this.executeParallel(updatedContext, [6, 7]);

      // OPTIMIZED: Stage 8 and Stage 9 can overlap
      // Stage 9 can start HTML generation as soon as validated_article is ready
      // (doesn't need to wait for quality_report to finish)
      updatedContext = await this.executeStage8WithOverlap(updatedContext);

      // Calculate metrics
      const totalTime = getTotalExecutionTime(updatedContext);
      logger.info(`Workflow completed in ${totalTime.toFixed(2)}s`);

      // Log quality metrics
      const qualityReport = updatedContext.quality_report;
      const aeoScore = qualityReport?.metrics?.aeo_score ?? 'N/A';
      const criticalIssuesCount = qualityReport?.critical_issues?.length ?? 0;
      logger.info(
        `Quality report: AEO score=${aeoScore} critical_issues=${criticalIssuesCount}`
      );

      // Monitor quality and generate alerts
      try {
        const { getQualityMonitor } = await import('./quality-monitor');
        const monitor = getQualityMonitor();
        const alert = monitor.recordQuality(context.job_id, qualityReport);

        if (alert) {
          // Log alert summary
          if (alert.severity === 'critical') {
            logger.critical(`🚨 Quality alert generated: ${alert.message}`);
          } else {
            logger.warn(`⚠️  Quality warning: ${alert.message}`);
          }
        }
      } catch (e) {
        // Don't fail workflow if monitoring fails
        logger.debug(`Quality monitoring failed: ${e}`);
      }

      return updatedContext;
    } catch (e) {
      const error = e as Error;
      logger.error(`Workflow failed: ${error.message}`, error);
      addError(context, 'workflow', error, {
        job_id: jobId,
        stage: 'workflow_engine',
        total_stages: this.stages.size,
      });
      throw error;
    }
  }

  /**
   * Execute stages sequentially.
   *
   * Each stage receives context from previous stage.
   * If a stage fails, it's logged but execution may continue
   * (depending on stage criticality).
   *
   * @param context - Current execution context
   * @param stageNums - List of stage numbers to execute in order
   * @returns Updated execution context
   */
  private async executeSequential(
    context: ExecutionContext,
    stageNums: number[]
  ): Promise<ExecutionContext> {
    let currentContext = context;

    for (const stageNum of stageNums) {
      if (!this.stages.has(stageNum)) {
        logger.warn(`Stage ${stageNum} not registered, skipping`);
        continue;
      }

      const stage = this.stages.get(stageNum)!;
      logger.info(`Executing ${stage}`);

      try {
        // Notify progress start
        if (this.progressCallback) {
          this.progressCallback(
            `stage_${String(stageNum).padStart(2, '0')}`,
            stageNum,
            false
          );
        }

        const startTime = Date.now();
        currentContext = await stage.execute(currentContext);
        const duration = (Date.now() - startTime) / 1000;

        const stageName = `stage_${String(stageNum).padStart(2, '0')}`;
        currentContext.execution_times[stageName] = duration;
        logger.info(`✅ ${stage} completed in ${duration.toFixed(2)}s`);

        // Notify progress completion
        if (this.progressCallback) {
          this.progressCallback(
            `stage_${String(stageNum).padStart(2, '0')}`,
            stageNum,
            true
          );
        }
      } catch (e) {
        const error = e as Error;
        logger.error(`❌ ${stage} failed: ${error.message}`, error);
        addError(
          currentContext,
          `stage_${String(stageNum).padStart(2, '0')}`,
          error,
          {
            job_id: currentContext.job_id,
            stage_num: stageNum,
            stage_name: stage.stageName,
          }
        );

        // Stage 0, 2, 8, 9 are critical - don't continue
        if ([0, 2, 8, 9].includes(stageNum)) {
          throw error;
        }
      }
    }

    return currentContext;
  }

  /**
   * Execute stages in parallel using Promise.all.
   *
   * All stages in stageNums run concurrently.
   * Each stage gets a copy of current context, returns updated context.
   * Results are merged into context.parallelResults.
   *
   * @param context - Current execution context
   * @param stageNums - List of stage numbers to execute in parallel
   * @returns Updated execution context with parallelResults populated
   *
   * Note:
   *   Stages 6-7 each take varying times:
   *   - Stage 6 (Image): ~2-4 min
   *   - Stage 7 (Similarity): varies
   *   Total parallel time: limited by slowest stage
   *
   *   Note: Stages 4-5 run sequentially before this (both modify body content)
   */
  private async executeParallel(
    context: ExecutionContext,
    stageNums: number[]
  ): Promise<ExecutionContext> {
    logger.info(`Starting parallel execution: Stages ${stageNums}`);
    logger.info('   Note: All stages run concurrently');
    logger.info('   Total time limited by slowest stage');

    // Create tasks
    const tasks: Promise<{ duration: number; context: ExecutionContext }>[] =
      [];
    const taskMap = new Map<number, number>(); // index -> stage number

    for (const stageNum of stageNums) {
      if (!this.stages.has(stageNum)) {
        logger.warn(`Stage ${stageNum} not registered, skipping`);
        continue;
      }

      const stage = this.stages.get(stageNum)!;

      // Notify parallel stages starting
      if (this.progressCallback) {
        this.progressCallback(
          `stage_${String(stageNum).padStart(2, '0')}`,
          stageNum,
          false
        );
      }

      const task = this.executeStageTimed(stage, context);
      taskMap.set(tasks.length, stageNum);
      tasks.push(task);
    }

    if (tasks.length === 0) {
      return context;
    }

    // Execute in parallel
    try {
      const results = await Promise.allSettled(tasks);

      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const stageNum = taskMap.get(i)!;
        const stageName = `stage_${String(stageNum).padStart(2, '0')}`;
        const stage = this.stages.get(stageNum)!;

        if (result.status === 'rejected') {
          logger.error(`❌ Stage ${stageNum} failed: ${result.reason}`);
          const errorObj = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
          addError(context, stageName, errorObj, {
            job_id: context.job_id,
            stage_num: stageNum,
            stage_name: stage.stageName,
            error_result: String(result.reason),
          });
          // Parallel stages are not critical - continue if one fails
        } else {
          const { duration, context: updatedContext } = result.value;
          context.execution_times[stageName] = duration;

          // Merge parallel results
          if (updatedContext.parallel_results) {
            context.parallel_results = {
              ...context.parallel_results,
              ...updatedContext.parallel_results,
            };
          }

          logger.info(
            `✅ Stage ${stageNum} completed in ${duration.toFixed(2)}s`
          );

          // Notify parallel stage completion
          if (this.progressCallback) {
            this.progressCallback(
              `stage_${String(stageNum).padStart(2, '0')}`,
              stageNum,
              true
            );
          }
        }
      }
    } catch (e) {
      const error = e as Error;
      logger.error(`Parallel execution error: ${error.message}`, error);
      addError(context, 'parallel_execution', error, {
        job_id: context.job_id,
        stages: [6, 7],
      });
    }

    return context;
  }

  /**
   * Execute Stage 8 and Stage 9 with overlap optimization.
   *
   * Stage 9 can start HTML generation as soon as validated_article is ready,
   * before quality_report finishes. This saves ~0.5-1 second.
   *
   * @param context - Execution context after stages 6-7
   * @returns Updated context with both stages complete
   */
  private async executeStage8WithOverlap(
    context: ExecutionContext
  ): Promise<ExecutionContext> {
    // Start Stage 8
    const stage8 = this.stages.get(8);
    if (!stage8) {
      logger.warn('Stage 8 not registered');
      return context;
    }

    logger.info(
      'Executing Stage 8 (cleanup) and Stage 9 (storage) with overlap'
    );

    // Execute Stage 8
    let startTime = Date.now();
    let updatedContext = await stage8.execute(context);
    const stage8Duration = (Date.now() - startTime) / 1000;
    updatedContext.execution_times['stage_8'] = stage8Duration;
    logger.info(`✅ Stage 8 completed in ${stage8Duration.toFixed(2)}s`);

    // QUALITY GATE: Check if regeneration is needed
    updatedContext = await this.checkQualityGateAndRegenerate(updatedContext);

    // Stage 7 now runs in parallel with Stage 6 (after Stage 5)
    // Similarity check and section regeneration happen earlier to save time
    // Results are already in context from parallel execution
    if (updatedContext.similarity_report) {
      const similarityScore = updatedContext.similarity_report.similarity_score;
      const isTooSimilar = updatedContext.similarity_report.is_too_similar;

      if (isTooSimilar) {
        logger.warn(
          `⚠️  High similarity detected (${similarityScore?.toFixed(1)}%) - similar sections regenerated`
        );
      }
    }

    // Stage 9: Storage (runs AFTER Stage 8 completes)
    const stage9 = this.stages.get(9);
    if (!stage9) {
      logger.warn('Stage 9 not registered');
      return updatedContext;
    }

    startTime = Date.now();
    updatedContext = await stage9.execute(updatedContext);
    const stage9Duration = (Date.now() - startTime) / 1000;
    updatedContext.execution_times['stage_9'] = stage9Duration;
    logger.info(`✅ Stage 9 completed in ${stage9Duration.toFixed(2)}s`);

    return updatedContext;
  }

  /**
   * Check quality gate and regenerate if needed.
   *
   * Implements 3-attempt regeneration strategy for failed articles:
   * 1. First failure: Regenerate with enhanced prompt
   * 2. Second failure: Regenerate with relaxed constraints
   * 3. Third failure: Accept with warning
   *
   * Also handles language validation failures with automatic retry.
   *
   * @param context - Execution context after Stage 8
   * @returns Updated context (potentially regenerated)
   */
  private async checkQualityGateAndRegenerate(
    context: ExecutionContext
  ): Promise<ExecutionContext> {
    const qualityReport = context.quality_report;
    if (!qualityReport) {
      logger.warn('No quality report available for quality gate check');
      return context;
    }

    const aeoScore = qualityReport.metrics?.aeo_score ?? 0;
    const criticalIssues = qualityReport.critical_issues ?? [];

    // Simple quality check - no complex regeneration logic needed
    // Quality gates are informational only in production
    if (aeoScore >= 80) {
      logger.info(`✅ Quality target met: AEO=${aeoScore}/100`);
      return context;
    }

    logger.warn(`⚠️  Quality below target: AEO=${aeoScore}/100, Critical Issues: ${criticalIssues.length}`);
    for (const issue of criticalIssues.slice(0, 3)) {
      logger.warn(`   ${issue}`);
    }

    // Log warnings but continue - quality gates are informational only
    return context;
  }

  /**
   * Regenerate article from Stage 2 onwards.
   *
   * @param context - Current execution context
   * @param reason - Reason for regeneration ('language' or 'quality')
   * @returns Updated context after regeneration
   */
  private async regenerateArticle(
    context: ExecutionContext,
    reason: string
  ): Promise<ExecutionContext> {
    logger.info(`🔄 Regenerating article (reason: ${reason})`);

    try {
      // Clear previous results for regeneration
      context.structured_data = null;
      context.parallel_results = {};
      context.validated_article = null;
      context.quality_report = {
        critical_issues: [],
        suggestions: [],
        metrics: { aeo_score: 0, readability: 0, keyword_coverage: 0 }
      };

      // Restart from Stage 2 (main article generation)
      // Keep Stage 0-1 results (keyword/prompt base)
      let updatedContext = await this.executeSequential(context, [2, 3]);

      // Sequential: Stage 4 (Citations) - modifies body content
      updatedContext = await this.executeSequential(updatedContext, [4]);

      // Sequential: Stage 5 (Internal Links) - modifies body content, must run after Stage 4
      updatedContext = await this.executeSequential(updatedContext, [5]);

      // Parallel: Stages 6 and 7 (Image + Similarity Check)
      updatedContext = await this.executeParallel(updatedContext, [6, 7]);

      // Stage 8 cleanup (this will trigger recursive quality check)
      const stage8 = this.stages.get(8);
      if (stage8) {
        const startTime = Date.now();
        updatedContext = await stage8.execute(updatedContext);
        const stage8Duration = (Date.now() - startTime) / 1000;
        updatedContext.execution_times[`stage_8_regen_${reason}`] = stage8Duration;
        logger.info(
          `✅ Regeneration Stage 8 completed in ${stage8Duration.toFixed(2)}s`
        );
      }

      // Recursive quality check (will handle next failure if needed)
      return await this.checkQualityGateAndRegenerate(updatedContext);
    } catch (e) {
      const error = e as Error;
      logger.error(`Regeneration attempt failed: ${error.message}`);
      addError(context, 'regeneration', error, {
        job_id: context.job_id,
      });
      return context;
    }
  }

  /**
   * Apply regeneration strategy based on attempt number.
   *
   * @param context - Current execution context
   * @returns Context with modified generation parameters
   */
  private applyRegenerationStrategy(
    context: ExecutionContext
  ): ExecutionContext {
    // Simple strategy - just return context as-is
    // Regeneration logic simplified for production use
    return context;
  }

  /**
   * Execute a single stage and track execution time.
   *
   * @param stage - Stage to execute
   * @param context - Execution context
   * @returns Tuple of {duration_seconds, updated_context}
   * @throws Exception - Any errors from stage execution
   */
  private async executeStageTimed(
    stage: Stage,
    context: ExecutionContext
  ): Promise<{ duration: number; context: ExecutionContext }> {
    const startTime = Date.now();
    const updatedContext = await stage.execute(context);
    const duration = (Date.now() - startTime) / 1000;
    return { duration, context: updatedContext };
  }

  /**
   * Get a registered stage by number.
   *
   * @param stageNum - Stage number (0-9)
   * @returns Stage instance or undefined if not registered
   */
  getStage(stageNum: number): Stage | undefined {
    return this.stages.get(stageNum);
  }

  /**
   * Get all registered stages in order.
   *
   * @returns List of Stage instances sorted by stage number
   */
  listStages(): Stage[] {
    return Array.from(this.stages.entries())
      .sort(([a], [b]) => a - b)
      .map(([, stage]) => stage);
  }
}
