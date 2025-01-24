// 大纲节点类型
export interface OutlineNode {
  title: string;
  content?: string;
  children?: OutlineNode[];
  level: number;
}

// 网站信息类型
export interface Website {
  name: string;
  url: string;
  category: string;
  description?: string;
}

// 爬取结果类型
export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  timestamp: Date;
  error?: string;
}

// 文本块类型
export interface TextChunk {
  content: string;
  metadata: {
    source: string;
    section?: string;
    timestamp: Date;
  };
}

// 报告生成请求类型
export interface ReportGenerationRequest {
  outline: OutlineNode[];
  websites: Website[];
}

// 报告生成响应类型
export interface ReportGenerationResponse {
  status: "success" | "error";
  report?: string;
  error?: string;
  metadata?: {
    processedWebsites: number;
    totalChunks: number;
    generationTime: number;
  };
}
