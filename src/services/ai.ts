import OpenAI from "openai";
import { config } from "../config/config";
import { TextChunk, OutlineNode } from "../types";

export class AIService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.openaiBaseURL,
    });
  }

  private async generateCompletion(prompt: string): Promise<string> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: config.openaiModel,
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的文章撰写助手，擅长总结和组织信息，生成结构化的报告。请使用markdown格式输出内容。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: config.maxTokens,
        temperature: 0.7,
      });

      return completion.choices[0].message.content || "";
    } catch (error: any) {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
  }

  async summarizeChunk(
    chunk: TextChunk,
    outlineNode: OutlineNode
  ): Promise<string> {
    const prompt = `
请分析以下文本，提取与主题"${outlineNode.title}"相关的关键信息，并进行简要总结。

文本来源：${chunk.metadata.source}
文本内容：
${chunk.content}

请仅提取与主题相关的信息进行总结，忽略无关内容。总结要求：
1. 保持客观准确
2. 突出重要数据和关键点
3. 保持简洁，控制在300字以内
4. 如果文本中没有相关信息，请直接返回"无相关信息"

总结：`;

    return this.generateCompletion(prompt);
  }

  async generateSectionReport(
    outlineNode: OutlineNode,
    summaries: string[]
  ): Promise<string> {
    const prompt = `
请根据以下来自多个来源的信息总结，生成一份关于"${
      outlineNode.title
    }"的完整报告段落。

信息来源：
${summaries.join("\n\n---\n\n")}

要求：
1. 合并并整理所有信息，消除重复内容
2. 保持客观性，注重数据和事实
3. 按照重要性组织内容
4. 使用markdown格式
5. 如果信息不足，请说明"该部分信息有限"
6. 生成的内容要符合新闻报道的专业性和规范性

请生成报告段落：`;

    return this.generateCompletion(prompt);
  }

  async generateFinalReport(
    outline: OutlineNode[],
    sectionReports: Map<string, string>
  ): Promise<string> {
    const reportSections = outline.map((node) => {
      const sectionContent = sectionReports.get(node.title) || "暂无相关信息";
      return `## ${node.title}\n\n${sectionContent}`;
    });

    const prompt = `
请根据以下各节内容，生成一份完整的报告。报告需要整体连贯、结构清晰。

${reportSections.join("\n\n")}

要求：
1. 保持原有的结构和内容
2. 优化段落之间的过渡
3. 确保专业性和可读性
4. 使用markdown格式
5. 添加必要的标点符号和连接词
6. 如果某节信息不足，保持原样，不要编造内容

请生成最终报告：`;

    return this.generateCompletion(prompt);
  }

  async optimizeReport(report: string): Promise<string> {
    const prompt = `
请对以下报告进行优化和润色，提升其专业性和可读性：

${report}

优化要求：
1. 保持原有的结构和核心内容不变
2. 改善语言表达，使其更加流畅自然
3. 优化标点符号和段落格式
4. 确保专业术语使用准确
5. 保持markdown格式
6. 不要添加或删除重要信息

请输出优化后的报告：`;

    return this.generateCompletion(prompt);
  }
}
