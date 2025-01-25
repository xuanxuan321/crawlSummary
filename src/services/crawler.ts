import { chromium } from "playwright";
import { CrawlResult, Website } from "../types";
import { config } from "../config/config";
import * as fs from "fs";
import * as path from "path";
import axios from 'axios';

const JINA_API_KEY = "jina_ae41e771c472420193006ec3972e5cbf260pT3t7p_nHdBCvTV8Hiiff347q";

export class Crawler {
  private browser: any;
  private crawlingUrls: Set<string> = new Set();
  private crawledUrls: Set<string> = new Set();
  private maxDepth: number = 2; // 最大递归深度，改为2以处理一级子页面
  private baseUrl: string = ""; // 基础URL，用于限制爬取范围

  async init() {
    this.browser = await chromium.launch({
      headless: true,
    });
    
    // 清空 document 目录
    const documentDir = path.join(process.cwd(), "document");
    if (fs.existsSync(documentDir)) {
      console.log('清空已存在的 document 目录');
      fs.rmSync(documentDir, { recursive: true, force: true });
    }
    fs.mkdirSync(documentDir, { recursive: true });
    console.log('创建新的 document 目录:', documentDir);
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  private async processWithJina(url: string): Promise<string> {
    try {
      console.log(`开始调用 Jina API 处理 URL: ${url}`);
      const response = await axios.get(`https://r.jina.ai/${url}`, {
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${JINA_API_KEY}`,
        },
      });

      if (response.status !== 200) {
        console.error(`Jina API 请求失败，状态码: ${response.status}`);
        throw new Error(`Jina API request failed with status ${response.status}`);
      }

      const text = response.data;
      console.log(`Jina API 处理成功，返回内容长度: ${text.length}`);
      return text;
    } catch (error: any) {
      console.error("Jina API 处理错误:", error.message);
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
      const filePath = path.join(documentDir, filename);
      fs.writeFileSync(filePath, content, "utf-8");
      console.log(`Successfully saved content to ${filePath}`);
    } catch (error: any) {
      console.error(`Failed to save content for ${result.url}:`, error);
      throw error;
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
    console.log(`开始爬取页面: ${url}, 深度: ${depth}`);
    
    if (depth >= this.maxDepth || this.crawledUrls.has(url)) {
      console.log(`跳过页面: ${url} (达到最大深度或已爬取)`);
      return [];
    }

    const context = await this.browser.newContext();
    const page = await context.newPage();
    const results: CrawlResult[] = [];

    try {
      console.log(`正在访问页面: ${url}`);
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: config.crawlTimeout,
      });

      const title = await page.title();
      console.log(`获取到页面标题: ${title}`);
      
      const result = {
        url,
        title,
        content: "", // 内容将由Jina处理
        timestamp: new Date(),
      };

      try {
        console.log(`准备保存文档: ${url}`);
        await this.saveToDocument(result);
        console.log(`文档保存完成: ${url}`);
        results.push(result);
        this.crawledUrls.add(url);
      } catch (error) {
        console.error(`保存文档失败: ${url}`, error);
        // 即使保存失败，也继续爬取子页面
      }

      const links = await this.extractLinks(page);
      console.log(`提取到 ${links.length} 个链接，当前深度: ${depth}`);
      
      // 并行处理所有子链接
      const subResultsPromises = links
        .filter(link => !this.crawledUrls.has(link))
        .map(link => this.crawlPage(link, depth + 1));
      
      const subResults = await Promise.all(subResultsPromises);
      results.push(...subResults.flat());

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
