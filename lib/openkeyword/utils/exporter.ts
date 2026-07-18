/**
 * ABOUTME: Export utilities for CSV/JSON with comprehensive metadata
 * ABOUTME: Exports keywords with all enrichment data in multiple formats
 *
 * TypeScript port of openkeywords/exporter.py
 */

import * as fs from "fs";
import * as path from "path";

export interface ExportOptions {
  format: "json" | "csv";
  outputPath?: string;
  includeMetadata?: boolean;
  includeClusters?: boolean;
  includeDeduplication?: boolean;
}

/**
 * Keyword export utility.
 *
 * Exports keywords with full metadata to CSV or JSON.
 */
export class KeywordExporter {
  /**
   * Export keywords to file
   */
  static async export(
    data: any,
    options: ExportOptions
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const { format, outputPath, includeMetadata = true } = options;

      let content: string;
      let defaultFileName: string;

      if (format === "json") {
        content = this.toJSON(data, options);
        defaultFileName = `keywords_${Date.now()}.json`;
      } else if (format === "csv") {
        content = this.toCSV(data, options);
        defaultFileName = `keywords_${Date.now()}.csv`;
      } else {
        return { success: false, error: `Unsupported format: ${format}` };
      }

      const filePath = outputPath || path.join(process.cwd(), defaultFileName);

      // Write to file
      fs.writeFileSync(filePath, content, "utf-8");

      console.log(`Keywords exported to ${filePath} (${format.toUpperCase()})`);

      return { success: true, filePath };
    } catch (error) {
      console.error("Export failed:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Convert to JSON format
   */
  private static toJSON(data: any, options: ExportOptions): string {
    const output: any = {
      keywords: data.keywords || [],
    };

    if (options.includeClusters && data.clusters) {
      output.clusters = data.clusters;
    }

    if (options.includeDeduplication && data.deduplication) {
      output.deduplication = data.deduplication;
    }

    if (options.includeMetadata && data.metadata) {
      output.metadata = data.metadata;
    }

    if (data.statistics) {
      output.statistics = data.statistics;
    }

    return JSON.stringify(output, null, 2);
  }

  /**
   * Convert to CSV format
   */
  private static toCSV(data: any, options: ExportOptions): string {
    const keywords = data.keywords || [];

    if (keywords.length === 0) {
      return "keyword,intent,source,is_question,score,aeo_opportunity,company_fit_score,recommended_priority\n";
    }

    // Determine columns based on first keyword
    const firstKeyword = keywords[0];
    const columns = [
      "keyword",
      "intent",
      "source",
      "is_question",
      "score",
      "context",
    ];

    // Add optional columns if they exist
    if ("aeo_opportunity" in firstKeyword) {
      columns.push("aeo_opportunity");
    }
    if ("has_featured_snippet" in firstKeyword) {
      columns.push("has_featured_snippet", "has_paa");
    }
    if ("company_fit_score" in firstKeyword) {
      columns.push("company_fit_score", "recommended_priority");
    }
    if ("serp_data" in firstKeyword) {
      columns.push("organic_results_count", "top_domains");
    }

    // Header row
    const rows: string[] = [columns.join(",")];

    // Data rows
    for (const kw of keywords) {
      const row = columns.map((col) => {
        let value = kw[col];

        // Handle special cases
        if (col === "top_domains" && kw.serp_data?.top_domains) {
          value = kw.serp_data.top_domains.slice(0, 3).join("|");
        } else if (col === "organic_results_count" && kw.serp_data) {
          value = kw.serp_data.organic_results_count;
        }

        // Escape commas and quotes in values
        if (value === undefined || value === null) {
          return "";
        }

        const str = String(value);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });

      rows.push(row.join(","));
    }

    // Add metadata as comment rows if requested
    if (options.includeMetadata && data.metadata) {
      rows.push("");
      rows.push("# Metadata");
      rows.push(`# Company: ${data.metadata.company_name || "N/A"}`);
      rows.push(`# Total Keywords: ${data.metadata.total_keywords || 0}`);
      rows.push(
        `# Generation Time: ${data.metadata.generation_time || 0}s`
      );
      rows.push(`# Model: ${data.metadata.model || "N/A"}`);
      if (data.metadata.phases) {
        rows.push(`# Research Duration: ${data.metadata.phases.research_duration || 0}s`);
        rows.push(`# SERP Duration: ${data.metadata.phases.serp_analysis_duration || 0}s`);
        if (data.metadata.phases.deduplication_duration) {
          rows.push(`# Deduplication Duration: ${data.metadata.phases.deduplication_duration}s`);
        }
        if (data.metadata.phases.scoring_duration) {
          rows.push(`# Scoring Duration: ${data.metadata.phases.scoring_duration}s`);
        }
        if (data.metadata.phases.clustering_duration) {
          rows.push(`# Clustering Duration: ${data.metadata.phases.clustering_duration}s`);
        }
      }
    }

    return rows.join("\n");
  }

  /**
   * Export clusters separately
   */
  static exportClusters(
    clusters: any[],
    format: "json" | "csv" = "json",
    outputPath?: string
  ): { success: boolean; filePath?: string; error?: string } {
    try {
      let content: string;
      let defaultFileName: string;

      if (format === "json") {
        content = JSON.stringify({ clusters }, null, 2);
        defaultFileName = `clusters_${Date.now()}.json`;
      } else {
        // CSV format for clusters
        const rows = ["cluster_name,keyword_count,primary_intent,keywords"];
        for (const cluster of clusters) {
          const keywords = (cluster.keywords || []).join("|");
          rows.push(
            `"${cluster.cluster_name}",${cluster.keyword_count},${cluster.primary_intent || ""},${keywords}`
          );
        }
        content = rows.join("\n");
        defaultFileName = `clusters_${Date.now()}.csv`;
      }

      const filePath = outputPath || path.join(process.cwd(), defaultFileName);
      fs.writeFileSync(filePath, content, "utf-8");

      console.log(`Clusters exported to ${filePath}`);

      return { success: true, filePath };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Quick export to tmp directory (for testing)
   */
  static async exportToTemp(
    data: any,
    format: "json" | "csv" = "json"
  ): Promise<string> {
    const fileName = `keywords_${Date.now()}.${format}`;
    const filePath = path.join("/tmp", fileName);

    const result = await this.export(data, {
      format,
      outputPath: filePath,
      includeMetadata: true,
      includeClusters: true,
      includeDeduplication: true,
    });

    if (!result.success) {
      throw new Error(`Export failed: ${result.error}`);
    }

    return result.filePath!;
  }
}
