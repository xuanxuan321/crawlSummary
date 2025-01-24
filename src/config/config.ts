import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || "gpt-3.5-turbo-16k",
  maxTokens: parseInt(process.env.MAX_TOKENS || "4000", 10),
  maxConcurrentCrawls: parseInt(process.env.MAX_CONCURRENT_CRAWLS || "5", 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || "3", 10),
  chunkSize: parseInt(process.env.CHUNK_SIZE || "2000", 10),
  crawlTimeout: parseInt(process.env.CRAWL_TIMEOUT || "30000", 10), // 30 seconds
  openaiBaseURL: process.env.OPENAI_BASE_URL || "https://api.deepseek.com",
};
