import { Crawler } from "./crawler";
import { AIService } from "./ai";
import {
  OutlineNode,
  Website,
  CrawlResult,
  TextChunk,
  ReportGenerationResponse,
} from "../types";
import { config } from "../config/config";

export class ReportService {
  private crawler: Crawler;
  private ai: AIService;

  constructor() {
    this.crawler = new Crawler();
    this.ai = new AIService();
  }

  async initialize() {
    await this.crawler.init();
  }

  async cleanup() {
    await this.crawler.close();
  }

  private splitIntoChunks(text: string): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentLength = 0;

    for (const word of words) {
      if (currentLength + word.length > config.chunkSize) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
        currentLength = 0;
      }
      currentChunk.push(word);
      currentLength += word.length + 1; // +1 for space
    }

    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));
    }

    return chunks;
  }

  private async processCrawlResult(
    result: CrawlResult,
    outlineNode: OutlineNode
  ): Promise<string[]> {
    const chunks = this.splitIntoChunks(result.content);
    const summaries: string[] = [];

    for (const chunk of chunks) {
      const textChunk: TextChunk = {
        content: chunk,
        metadata: {
          source: result.url,
          timestamp: result.timestamp,
        },
      };

      try {
        const summary = await this.ai.summarizeChunk(textChunk, outlineNode);
        if (summary && summary !== "无相关信息") {
          summaries.push(summary);
        }
      } catch (error) {
        console.error(`Error summarizing chunk from ${result.url}:`, error);
      }
    }

    return summaries;
  }

  private async generateSectionReport(
    outlineNode: OutlineNode,
    crawlResults: CrawlResult[]
  ): Promise<string> {
    const allSummaries: string[] = [];

    for (const result of crawlResults) {
      if (result.error) {
        console.warn(
          `Skipping failed crawl result for ${result.url}: ${result.error}`
        );
        continue;
      }

      const summaries = await this.processCrawlResult(result, outlineNode);
      allSummaries.push(...summaries);
    }

    if (allSummaries.length === 0) {
      return "该部分暂无相关信息";
    }

    return this.ai.generateSectionReport(outlineNode, allSummaries);
  }

  async generateReport(
    outline: OutlineNode[],
    websites: Website[]
  ): Promise<ReportGenerationResponse> {
    const startTime = Date.now();

    try {
      // 1. 爬取所有网站
      console.log("开始爬取网站...");
      const crawlResults = await this.crawler.crawlMultiple(websites);

      // 2. 为每个大纲节点生成报告段落
      console.log("开始生成各节报告...");
      const sectionReports = new Map<string, string>();

      for (const node of outline) {
        console.log(`正在处理节点: ${node.title}`);
        const sectionReport = await this.generateSectionReport(
          node,
          crawlResults
        );
        sectionReports.set(node.title, sectionReport);
      }
      // return {
      //   status: "success",
      //   report: "test",
      // };
      // 3. 生成完整报告
      return {
        status: "success",
        report: "test",
      };
      console.log("正在生成完整报告...");
      const report = await this.ai.generateFinalReport(outline, sectionReports);

      // 4. 优化报告
      console.log("正在优化报告...");
      const optimizedReport = await this.ai.optimizeReport(report);

      const endTime = Date.now();
      const generationTime = endTime - startTime;

      return {
        status: "success",
        report: optimizedReport,
        metadata: {
          processedWebsites: crawlResults.length,
          totalChunks: crawlResults.reduce(
            (acc, curr) => acc + this.splitIntoChunks(curr.content).length,
            0
          ),
          generationTime,
        },
      };
    } catch (error: any) {
      return {
        status: "error",
        error: `Report generation failed: ${error.message}`,
      };
    }
  }
}
