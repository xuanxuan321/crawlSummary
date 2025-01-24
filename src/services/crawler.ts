import { chromium } from "playwright";
import { CrawlResult, Website } from "../types";
import { config } from "../config/config";
import * as cheerio from "cheerio";

export class Crawler {
  private browser: any;
  private crawlingUrls: Set<string> = new Set();

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

  private async crawlWithPlaywright(url: string): Promise<CrawlResult> {
    const context = await this.browser.newContext();
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: config.crawlTimeout,
      });

      // 等待页面加载完成
      await page.waitForLoadState("domcontentloaded");

      // 获取页面标题
      const title = await page.title();

      // 获取主要内容
      const content = await page.evaluate(() => {
        // 移除不需要的元素
        const elementsToRemove = document.querySelectorAll(
          "script, style, iframe, nav, footer, header, .advertisement"
        );
        elementsToRemove.forEach((el) => el.remove());

        // 获取主要内容区域
        const mainContent = document.querySelector(
          "main, article, .content, #content, .main"
        );
        return mainContent
          ? mainContent.textContent
          : document.body.textContent;
      });

      await context.close();

      return {
        url,
        title,
        content: content?.trim() || "",
        timestamp: new Date(),
      };
    } catch (error: any) {
      await context.close();
      throw new Error(`Failed to crawl ${url}: ${error.message}`);
    }
  }

  private async crawlWithCheerio(url: string): Promise<CrawlResult> {
    try {
      const response = await fetch(url);
      const html = await response.text();
      const $ = cheerio.load(html);

      // 移除不需要的元素
      $("script, style, iframe, nav, footer, header, .advertisement").remove();

      // 获取主要内容
      const content =
        $("main, article, .content, #content, .main").text() ||
        $("body").text();

      return {
        url,
        title: $("title").text(),
        content: content.trim(),
        timestamp: new Date(),
      };
    } catch (error: any) {
      throw new Error(`Failed to crawl ${url}: ${error.message}`);
    }
  }

  async crawl(website: Website): Promise<CrawlResult> {
    const { url } = website;

    if (this.crawlingUrls.has(url)) {
      throw new Error(`URL ${url} is already being crawled`);
    }

    this.crawlingUrls.add(url);

    try {
      // 首先尝试使用 Playwright
      try {
        const result = await this.crawlWithPlaywright(url);
        return result;
      } catch (playwrightError) {
        console.warn(
          `Playwright crawling failed for ${url}, falling back to Cheerio`
        );
        // 如果 Playwright 失败，尝试使用 Cheerio
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
