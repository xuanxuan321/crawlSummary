import { chromium } from "playwright";
import { CrawlResult, Website } from "../types";
import { config } from "../config/config";
import * as fs from "fs";
import * as path from "path";

const JINA_API_KEY = "jina_ae41e771c472420193006ec3972e5cbf260pT3t7p_nHdBCvTV8Hiiff347q";

export class Crawler {
  private browser: any;
  private crawlingUrls: Set<string> = new Set();
  private crawledUrls: Set<string> = new Set();
  private maxDepth: number = 1; // 最大递归深度
  private baseUrl: string = ""; // 基础URL，用于限制爬取范围

  async init() {
    this.browser = await chromium.launch({
      headless: true,
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async processWithJina(url: string): Promise<string> {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${JINA_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Jina API request failed with status ${response.status}`);
      }

      return await response.text();
    } catch (error: any) {
      console.error("Error processing with Jina:", error);
      throw error;
    }
  }

  private async saveToDocument(result: CrawlResult): Promise<void> {
    try {
      const urlObj = new URL(result.url);
      const sanitizedHostname = urlObj.hostname.replace(/[^a-z0-9]/gi, "_");
      const timestamp = result.timestamp.toISOString().replace(/[^0-9]/g, "");
      const filename = `${sanitizedHostname}_${timestamp}.md`;

      const processedContent = await this.processWithJina(result.url);
      
      const content = `# ${result.title}\n\n` +
                     `URL: ${result.url}\n` +
                     `Crawled at: ${result.timestamp.toISOString()}\n\n` +
                     `## Content\n\n${processedContent}\n`;

      const documentDir = path.join(process.cwd(), "document");
      if (!fs.existsSync(documentDir)) {
        fs.mkdirSync(documentDir, { recursive: true });
      }

      const filePath = path.join(documentDir, filename);
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Saved content to ${filePath}`);
    } catch (error: any) {
      console.error(`Failed to save content for ${result.url}:`, error);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const baseUrlObj = new URL(this.baseUrl);
      // 只爬取同域名下的链接
      return urlObj.hostname === baseUrlObj.hostname;
    } catch {
      return false;
    }
  }

  private async extractLinks(page: any): Promise<string[]> {
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a"))
        .map(a => a.href)
        .filter(href => href && href.startsWith("http"));
    });
    return links.filter((url: string) => this.isValidUrl(url));
  }

  private async crawlPage(url: string, depth: number = 0): Promise<CrawlResult[]> {
    if (depth >= this.maxDepth || this.crawledUrls.has(url)) {
      return [];
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    const results: CrawlResult[] = [];

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: config.crawlTimeout,
      });

      const title = await page.title();
      
      const result = {
        url,
        title,
        content: "", // 内容将由Jina处理
        timestamp: new Date(),
      };

      await this.saveToDocument(result);
      results.push(result);
      this.crawledUrls.add(url);

      const links = await this.extractLinks(page);
      for (const link of links) {
        if (!this.crawledUrls.has(link)) {
          const subResults = await this.crawlPage(link, depth + 1);
          results.push(...subResults);
        }
      }

      return results;
    } catch (error: any) {
      console.error(`Failed to crawl ${url}: ${error.message}`);
      return results;
    } finally {
      await context.close();
    }
  }

  async crawl(website: Website): Promise<CrawlResult[]> {
    const { url } = website;
    this.baseUrl = url;

    if (this.crawlingUrls.has(url)) {
      throw new Error(`URL ${url} is already being crawled`);
    }

    this.crawlingUrls.add(url);

    try {
      return await this.crawlPage(url);
    } finally {
      this.crawlingUrls.delete(url);
    }
  }

  async crawlMultiple(websites: Website[]): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];
    const chunks: Website[][] = [];

    for (let i = 0; i < websites.length; i += config.maxConcurrentCrawls) {
      chunks.push(websites.slice(i, i + config.maxConcurrentCrawls));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (website) => {
        try {
          const crawlResults = await this.crawl(website);
          return crawlResults;
        } catch (error: any) {
          console.error(`Error crawling ${website.url}:`, error);
          return [{
            url: website.url,
            title: website.name,
            content: "",
            timestamp: new Date(),
            error: error.message,
          }] as CrawlResult[];
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults.flat());
    }

    return results;
  }
}
