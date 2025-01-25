import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/config";
import reportRoutes from "./routes/report";

// 打印配置信息（注意不要打印敏感信息）
console.log('Starting server with config:', {
  port: config.port,
  model: config.openaiModel,
  baseURL: config.openaiBaseURL,
  maxConcurrentCrawls: config.maxConcurrentCrawls,
  crawlTimeout: config.crawlTimeout
});

const app = express();

// 中间件
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// 添加请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// 路由
app.use("/api/report", reportRoutes);

// 错误处理中间件
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status
    });
    res.status(500).json({
      status: "error",
      error: err.message || "服务器内部错误",
    });
  }
);

// 添加未捕获异常处理
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 健康检查路由
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 启动服务器
app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
});
