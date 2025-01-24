# 智能报告生成系统

这是一个基于 Node.js 的智能报告生成系统，能够自动爬取指定网站的内容，并根据用户提供的大纲生成结构化的报告。

## 主要功能

1. **网页内容爬取**

   - 支持现代网站的内容爬取
   - 使用 Playwright 处理动态渲染的内容
   - 支持并发爬取多个网站

2. **智能内容处理**

   - 使用 OpenAI API 进行内容理解和生成
   - 支持长文本分块处理
   - 智能提取与主题相关的内容

3. **报告生成**
   - 根据用户提供的大纲生成结构化报告
   - 自动优化和润色报告内容
   - 输出 Markdown 格式的报告

## 技术栈

- Node.js + TypeScript
- Express.js
- Playwright
- OpenAI API
- Cheerio

## 安装

1. 克隆项目：

   ```bash
   git clone [项目地址]
   cd [项目目录]
   ```

2. 安装依赖：

   ```bash
   yarn install
   ```

3. 配置环境变量：
   - 复制 `.env.example` 到 `.env`
   - 填写必要的配置信息（如 OpenAI API Key）

## 运行

开发模式：

```bash
yarn dev
```

生产模式：

```bash
yarn build
yarn start
```

## API 使用

### 生成报告

**请求：**

```http
POST /api/report/generate
Content-Type: application/json

{
  "outline": [
    {
      "title": "标题",
      "level": 1,
      "children": []
    }
  ],
  "websites": [
    {
      "name": "网站名称",
      "url": "https://example.com",
      "category": "分类"
    }
  ]
}
```

**响应：**

```json
{
  "status": "success",
  "report": "生成的报告内容（Markdown格式）",
  "metadata": {
    "processedWebsites": 1,
    "totalChunks": 10,
    "generationTime": 5000
  }
}
```

## 配置说明

环境变量配置（.env）：

- `PORT`: 服务器端口
- `OPENAI_API_KEY`: OpenAI API 密钥
- `OPENAI_MODEL`: 使用的模型（默认：gpt-3.5-turbo-16k）
- `MAX_TOKENS`: 单次生成的最大 token 数
- `MAX_CONCURRENT_CRAWLS`: 最大并发爬取数
- `MAX_RETRIES`: 最大重试次数
- `CHUNK_SIZE`: 文本分块大小
- `CRAWL_TIMEOUT`: 爬取超时时间（毫秒）

## 注意事项

1. 确保有足够的 OpenAI API 额度
2. 遵守网站的爬虫政策
3. 合理设置并发数和超时时间
4. 注意处理大文本时的内存使用

## 许可证

MIT
