**Node.js 后端实现方案**

整体框架和之前的思路类似，但技术栈切换到 Node.js：

1. **接收用户输入 (Node.js Express/Koa 或其他框架):**

   - 使用 Node.js 的 Web 框架 (如 Express 或 Koa) 构建 API 接口，接收用户的大纲和网站列表。
   - 可以使用 `body-parser` 中间件解析请求体中的 JSON 或文本数据。
   - 进行参数校验，确保大纲和网站列表的格式正确。

2. **网页内容爬取 (Node.js):**

   - **库选择:**
     - **`axios` 或 `node-fetch`:** 用于发送 HTTP 请求。 `axios` 功能更全面，`node-fetch` 是原生 `fetch` API 的 Node.js 实现。
     - **`cheerio`:** 轻量级、快速的 HTML 解析库，语法类似 jQuery，非常适合高效解析 HTML 文本。
     - **`puppeteer` 或 `playwright` (可选但推荐):** 用于处理 JavaScript 渲染的动态网页。 这两个库都允许你启动 Chromium 或 Firefox 浏览器实例，模拟用户操作，获取渲染后的 HTML 内容。 对于现代网站，`puppeteer` 或 `playwright` 更加可靠。
   - **爬取流程 (与 Python 类似):**
     - 循环遍历网站列表。
     - 使用 `axios` 或 `node-fetch` 发送请求。
     - 使用 `cheerio` 或 `puppeteer` 解析 HTML 内容。
     - 提取正文文本 (可以使用 CSS 选择器精确定位，例如 `querySelector` in `puppeteer` 或 `cheerio` 的选择器)。
     - 进行数据清洗 (去除 HTML 标签、空格、换行符等)。
     - 错误处理 (网络请求失败、解析错误等)。

3. **内容理解与结构化 (Node.js + 大模型 API):**

   - **大模型 API 客户端:** 选择 Node.js 的大模型 API 客户端库，例如：
     - **OpenAI API:** `openai` (官方 Node.js SDK)。
     - **其他模型 API:** 根据你选择的模型 (例如 Azure OpenAI, 百度文心, 智谱 AI 等) 查找相应的 Node.js SDK 或使用通用的 HTTP 请求库 (如 `axios`) 手动调用 API。
   - **Prompt 工程 (Node.js 中构建 Prompt):**
     - 在 Node.js 代码中动态构建 Prompt 字符串，将大纲节点和爬取到的网页内容拼接在一起。
     - 使用字符串模板或专门的模板库 (如 `mustache.js` 或 `handlebars.js`) 来更清晰地构建 Prompt。
   - **调用大模型 API:** 使用选定的 SDK 或 `axios` 发送请求到大模型 API，传入 Prompt。
   - **解析大模型响应:** 解析 API 返回的 JSON 响应，提取生成的文本信息。
   - **结构化存储:** 将提取的信息按照大纲结构存储在 JavaScript 对象或 JSON 数据结构中。

4. **报告生成 (Node.js + 大模型 API):**

   - **Prompt 工程 (报告生成 Prompt):** 构建 Prompt，指示大模型根据结构化数据生成报告。
   - **调用大模型 API:** 发送报告生成 Prompt 和结构化数据到大模型 API。
   - **获取报告文本:** 解析 API 响应，获取生成的报告文本。

5. **报告优化与润色 (可选, Node.js + 大模型 API):**

   - **润色 Prompt:** 构建 Prompt，指示大模型对已生成的报告进行润色和优化。
   - **调用大模型 API:** 发送润色 Prompt 和原始报告文本到 API。
   - **获取优化后的报告:** 解析 API 响应，获取润色后的报告文本。

6. **返回报告 (Node.js Express/Koa):**
   - 将生成的报告 (可以是纯文本、Markdown 或 HTML 格式) 作为 API 响应返回给用户。
   - 设置合适的 HTTP 状态码和 Content-Type。

**解决上下文长度限制的关键策略 (Node.js 中实现):**

由于 Node.js 是后端，更适合处理复杂的逻辑和数据处理，因此以下策略都可以在 Node.js 后端实现：

1. **分块处理 (Chunking and Summarization):** **这是最核心、最有效的方法。**

   - **网页内容分块:** 将每个爬取到的网页内容切分成更小的文本块 (例如按段落、章节或固定 token 数量)。
   - **逐块理解与提取:** 针对大纲的每个节点，**循环遍历**该节点相关的网站的所有文本块。 每次 Prompt 大模型时，只提供 **一个文本块** 和 **当前大纲节点** 的信息。 要求大模型针对 **当前文本块** 提取与大纲节点相关的信息，并进行 **简要总结**。
   - **汇总块级总结:** 将针对 **同一个大纲节点** 的 **所有文本块** 的 **简要总结** 汇总起来，形成针对该大纲节点的 **更全面的信息总结**。 可以再次利用大模型对这些块级总结进行 **更高层次的整合与概括**，或者在 Node.js 代码中进行简单的拼接和整理。
   - **优点:** 显著减小单次 Prompt 的文本长度，避免超出上下文限制。 允许处理非常长的网页内容。
   - **Node.js 实现思路:** 在 Node.js 中编写函数，实现文本分块、循环处理文本块、构建 Prompt、调用 API、解析响应、汇总总结等逻辑。 可以使用数组存储块级总结，最后将数组元素拼接成完整总结。

2. **信息检索与筛选 (Retrieval-Augmented Generation - RAG 的简化版):**

   - **关键词/主题提取:** 对于大纲的每个节点，先提取一些关键词或主题词。 可以手动定义，也可以使用简单的 NLP 库 (Node.js 中也有一些，如 `natural` 或 `wink-nlp-utils`) 或者再次利用大模型进行关键词提取。
   - **网页内容筛选:** 在爬取到的网页内容中，**只保留包含关键词或主题词的段落或句子**。 过滤掉与大纲节点不太相关的内容。
   - **处理筛选后的内容:** 将筛选后的内容作为输入，进行内容理解、提取和报告生成。
   - **优点:** 减少需要处理的文本量，让大模型更专注于相关信息。
   - **Node.js 实现思路:** 可以使用正则表达式或字符串匹配算法在 Node.js 中实现关键词搜索和内容筛选。

3. **逐步细化生成 (Iterative Generation):**

   - **粗略大纲生成:** 先使用大模型根据大纲和少量信息 (例如每个大纲节点只处理少量网站或少量文本块) 生成一个 **初步的、粗略的报告框架**。
   - **分节细化填充:** 针对报告框架的 **每个章节**，再使用更详细的信息 (例如处理更多网站、更多文本块，或者使用更精细的 Prompt) 进行 **内容填充和细化**。
   - **逐步完善:** 可以多次迭代，逐步增加报告的细节和深度。
   - **优点:** 将长报告生成任务分解为多个小任务，降低单次生成的文本长度。
   - **Node.js 实现思路:** 在 Node.js 中管理报告的生成流程，控制迭代次数，逐步调用大模型 API 进行内容填充。

4. **使用支持长上下文的模型 (如果可用且成本可接受):**
   - 某些大模型 (例如 OpenAI 的 `gpt-4-32k` 或 Claude 2 等) 提供了更长的上下文窗口 (例如 32k tokens 甚至更长)。 如果你的预算允许，并且模型效果满足需求，可以直接使用这些模型，可以 **一定程度上缓解上下文长度限制**。
   - **注意:** 长上下文模型通常费用更高，且处理速度可能稍慢。

**Node.js 代码示例 (网页爬取 + 分块处理 + 简易总结 - 核心思路演示):**

```javascript
const axios = require("axios");
const cheerio = require("cheerio");
const { OpenAI } = require("openai"); // 假设使用 OpenAI

// 初始化 OpenAI API 客户端 (需要配置 API 密钥)
const openai = new OpenAI({ apiKey: "YOUR_OPENAI_API_KEY" });

async function scrapeWebsite(url) {
  try {
    const response = await axios.get(url);
    response.data; // 返回 HTML 字符串
    return response.data;
  } catch (error) {
    console.error(`Error scraping ${url}: ${error}`);
    return null;
  }
}

function chunkText(text, chunkSize = 1500) {
  // 简单的按 token 数量分块 (实际中需要更精确的 token 计算)
  const words = text.split(/\s+/); // 按空格分割单词
  const chunks = [];
  let currentChunk = [];
  let currentChunkLength = 0;

  for (const word of words) {
    const wordLength = word.length; // 粗略估计单词长度 (实际 token 长度计算更复杂)
    if (
      currentChunkLength + wordLength + 1 > chunkSize &&
      currentChunk.length > 0
    ) {
      // +1 假设空格
      chunks.push(currentChunk.join(" "));
      currentChunk = [];
      currentChunkLength = 0;
    }
    currentChunk.push(word);
    currentChunkLength += wordLength + 1;
  }
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }
  return chunks;
}

async function summarizeChunk(chunk, outlineTopic) {
  if (!chunk) return null;

  const prompt = `请分析以下文本段落，并提取关于 "${outlineTopic}" 的信息，进行简要总结。\n\n文本段落:\n\`\`\`\n${chunk}\n\`\`\`\n总结:`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // 或者其他合适的模型
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150, // 控制总结长度
    });
    return completion.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error summarizing chunk:", error);
    return null;
  }
}

async function processWebsiteForOutline(url, outlineTopic) {
  const htmlContent = await scrapeWebsite(url);
  if (!htmlContent) return null;

  const $ = cheerio.load(htmlContent);
  const articleText = $("body").text(); // 提取整个 body 的文本，实际中需要更精确的选择器

  const chunks = chunkText(articleText);
  const chunkSummaries = [];

  for (const chunk of chunks) {
    const summary = await summarizeChunk(chunk, outlineTopic);
    if (summary) {
      chunkSummaries.push(summary);
    }
  }

  return chunkSummaries.join("\n---\n"); // 使用分隔符连接块级总结
}

async function main() {
  const websiteUrls = [
    "https://www.example.com/report1",
    "https://www.example.com/report2",
  ]; // 替换成实际网址
  const outlineTopic = "市场规模"; // 示例大纲主题

  let allWebsiteSummaries = [];
  for (const url of websiteUrls) {
    const websiteSummary = await processWebsiteForOutline(url, outlineTopic);
    if (websiteSummary) {
      allWebsiteSummaries.push(`网站: ${url}\n${websiteSummary}`);
    }
  }

  const finalSummaryPrompt = `请根据以下来自多个网站的关于 "${outlineTopic}" 的信息总结，整合成一份更全面、更流畅的总结报告。\n\n信息总结:\n\`\`\`\n${allWebsiteSummaries.join(
    "\n\n"
  )}\n\`\`\`\n最终报告:`;

  const finalReportCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo", // 或更强大的模型
    messages: [{ role: "user", content: finalSummaryPrompt }],
    max_tokens: 300, // 控制最终报告长度
  });
  const finalReport = finalReportCompletion.choices[0].message.content.trim();

  console.log("最终报告:\n", finalReport);
}

main();
```

**代码说明:**

- **`scrapeWebsite`:** 使用 `axios` 和 `cheerio` 爬取和解析网页，提取文本内容。
- **`chunkText`:** 一个简单的文本分块函数 (需要更精确的 token 计算)。
- **`summarizeChunk`:** 针对每个文本块，调用 OpenAI API 进行简要总结，提取与指定大纲主题相关的信息。
- **`processWebsiteForOutline`:** 处理单个网站，分块网页内容，并逐块进行总结。
- **`main`:** 主函数，遍历网站列表，针对每个网站和指定大纲主题进行处理，最后将所有网站的总结汇总，并再次调用 API 生成最终的整合报告。

**重要提示:**

- **错误处理:** 示例代码中只包含了简单的 `try-catch` 错误处理，实际项目中需要更完善的错误处理机制。
- **API 密钥:** 请替换 `YOUR_OPENAI_API_KEY` 为你自己的 OpenAI API 密钥。
- **Token 计算和分块策略:** 示例代码中的分块是简单的按单词数量分块，实际中需要使用更精确的 token 计数库 (例如 `gpt-tokenizer`)，并根据模型的上下文窗口大小和 Prompt 结构，设计更合理的分块策略。
- **Prompt 优化:** 示例 Prompt 只是一个基础版本，需要根据实际效果不断优化 Prompt，以提高信息提取和报告生成的质量。
- **模型选择:** `gpt-3.5-turbo` 只是一个示例模型，可以根据需求选择更强大的模型 (如 `gpt-4` 系列) 或其他合适的模型。
- **更完善的 RAG:** 示例代码中没有实现复杂的 RAG 流程，如果需要更精准的信息检索，可以考虑使用向量数据库 (例如 Pinecone, Weaviate) 和 Embedding 模型，构建更强大的 RAG 系统。

**总结与建议:**

- Node.js 完全可以胜任后端任务，并且在处理异步操作和构建 API 方面有优势。
- 解决上下文长度限制的核心是 **分块处理** 和 **逐步细化生成**。 示例代码已经演示了分块处理的核心思路。
- **Prompt 工程** 仍然至关重要，需要不断优化 Prompt 来提高信息提取和报告生成的质量。
- 考虑使用 **`puppeteer` 或 `playwright`** 来更可靠地爬取现代网站。
- 如果预算允许，可以考虑使用 **长上下文模型** 或构建更复杂的 **RAG 系统**。

希望这个更贴合 Node.js 和上下文长度挑战的方案对你有所帮助！ 祝你的项目顺利进行！
