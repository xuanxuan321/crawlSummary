import { Router, Request, Response, RequestHandler } from "express";
import { ReportService } from "../services/report";
import { ReportGenerationRequest, ReportGenerationResponse } from "../types";

const router = Router();
const reportService = new ReportService();

// 初始化报告服务
reportService.initialize().catch(console.error);

// 处理程序退出时的清理工作
process.on("exit", () => {
  reportService.cleanup().catch(console.error);
});

// 生成报告的路由
const generateReport: RequestHandler = async (req, res, next) => {
  try {
    const { outline, websites } = req.body as ReportGenerationRequest;

    if (!outline || !websites) {
      res.status(400).json({
        status: "error",
        error: "请提供大纲和网站列表",
      });
      return;
    }

    if (!Array.isArray(outline) || !Array.isArray(websites)) {
      res.status(400).json({
        status: "error",
        error: "大纲和网站列表必须是数组",
      });
      return;
    }

    const result = await reportService.generateReport(outline, websites);
    res.json(result);
    return;
  } catch (error: any) {
    res.status(500).json({
      status: "error",
      error: `生成报告失败: ${error.message}`,
    });
    return;
  }
};

router.post("/generate", generateReport);

export default router;
