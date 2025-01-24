import { chromium } from "playwright";
import { CrawlResult, Website } from "../types";
import { config } from "../config/config";
import * as cheerio from "cheerio";
import * as fs from "fs";
import * as path from "path";

const JINA_API_KEY =
  "jina_ae41e771c472420193006ec3972e5cbf260pT3t7p_nHdBCvTV8Hiiff347q";

export class Crawler {
  private browser: any;
  private crawlingUrls: Set<string> = new Set();
  private crawledUrls: Set<string> = new Set();
  private maxDepth: number = 5; // 最大递归深度
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

  private async convertToMarkdown(
    url: string,
    content: string
  ): Promise<string> {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        method: "GET",
        headers: {
          "Content-Type": "text/plain",
          Authorization: `Bearer ${JINA_API_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Jina API request failed with status ${response.status}`
        );
      }

      return await response.text();
    } catch (error: any) {
      console.error("Error converting to markdown:", error);
      // 如果转换失败，返回原始内容
      return content;
    }
  }

  private async saveToDocument(result: CrawlResult): Promise<void> {
    try {
      // 从 URL 中提取一个有效的文件名
      const urlObj = new URL(result.url);
      const sanitizedHostname = urlObj.hostname.replace(/[^a-z0-9]/gi, "_");
      const timestamp = result.timestamp.toISOString().replace(/[^0-9]/g, "");
      const filename = `${sanitizedHostname}_${timestamp}.md`;

      // 使用 Jina 转换内容为 Markdown
      const markdownContent = await this.convertToMarkdown(
        result.url,
        result.content
      );

      // 构建文件内容
      const content =
        `# ${result.title}\n\n` +
        `URL: ${result.url}\n` +
        `Crawled at: ${result.timestamp.toISOString()}\n\n` +
        `## Content\n\n${markdownContent}\n`;

      // 确保 document 目录存在
      const documentDir = path.join(process.cwd(), "document");
      if (!fs.existsSync(documentDir)) {
        fs.mkdirSync(documentDir, { recursive: true });
      }

      // 写入文件
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
      const anchors = Array.from(document.querySelectorAll("a"));
      return anchors
        .map((a) => a.href)
        .filter((href) => href && href.startsWith("http"));
    });

    // 过滤出有效的URL
    return links.filter((url) => this.isValidUrl(url));
  }

  private async crawlWithPlaywright(
    url: string,
    depth: number = 0
  ): Promise<CrawlResult[]> {
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

      await page.waitForLoadState("domcontentloaded");

      const title = await page.title();
      const content = await page.evaluate(() => {
        const elementsToRemove = document.querySelectorAll(
          "script, style, iframe, nav, footer, header, .advertisement"
        );
        elementsToRemove.forEach((el) => el.remove());

        const mainContent = document.querySelector(
          "main, article, .content, #content, .main"
        );
        return mainContent
          ? mainContent.textContent
          : document.body.textContent;
      });

      const result = {
        url,
        title,
        content: content?.trim() || "",
        timestamp: new Date(),
      };

      await this.saveToDocument(result);
      results.push(result);
      this.crawledUrls.add(url);

      // 提取并递归爬取链接
      const links = await this.extractLinks(page);
      for (const link of links) {
        if (!this.crawledUrls.has(link)) {
          const subResults = await this.crawlWithPlaywright(link, depth + 1);
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

  private async crawlWithCheerio(
    url: string,
    depth: number = 0
  ): Promise<CrawlResult[]> {
    if (depth >= this.maxDepth || this.crawledUrls.has(url)) {
      return [];
    }

    const results: CrawlResult[] = [];

    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      $("script, style, iframe, nav, footer, header, .advertisement").remove();

      const content =
        $("main, article, .content, #content, .main").text() ||
        $("body").text();

      const result = {
        url,
        title: $("title").text(),
        content: content.trim(),
        timestamp: new Date(),
      };

      await this.saveToDocument(result);
      results.push(result);
      this.crawledUrls.add(url);

      // 提取并递归爬取链接
      const links = $("a")
        .map((_, el) => $(el).attr("href"))
        .get()
        .filter((href) => href && this.isValidUrl(href));

      for (const link of links) {
        if (!this.crawledUrls.has(link)) {
          const subResults = await this.crawlWithCheerio(link, depth + 1);
          results.push(...subResults);
        }
      }

      return results;
    } catch (error: any) {
      console.error(`Failed to crawl ${url}: ${error.message}`);
      return results;
    }
  }

  async crawl(website: Website): Promise<CrawlResult[]> {
    const { url } = website;
    this.baseUrl = url; // 设置基础URL

    if (this.crawlingUrls.has(url)) {
      throw new Error(`URL ${url} is already being crawled`);
    }

    this.crawlingUrls.add(url);

    try {
      try {
        return await this.crawlWithPlaywright(url);
      } catch (playwrightError) {
        console.warn(
          `Playwright crawling failed for ${url}, falling back to Cheerio`
        );
        return await this.crawlWithCheerio(url);
      }
    } finally {
      this.crawlingUrls.delete(url);
    }
  }

  async crawlMultiple(websites: Website[]): Promise<CrawlResult[]> {
    const results: CrawlResult[] = [];
    const chunks: Website[][] = [];

    // 将网站列表分成多个块，每块最多包含 maxConcurrentCrawls 个网站
    for (let i = 0; i < websites.length; i += config.maxConcurrentCrawls) {
      chunks.push(websites.slice(i, i + config.maxConcurrentCrawls));
    }

    // 逐块处理网站
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (website) => {
          try {
            return await this.crawl(website);
          } catch (error: any) {
            console.error(`Error crawling ${website.url}:`, error);
            return {
              url: website.url,
              title: website.name,
              content: "",
              timestamp: new Date(),
              error: error.message,
            };
          }
        })
      );
      results.push(...chunkResults);
    }

    return results;
  }
}
