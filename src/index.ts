import express from "express";
import cors from "cors";
import morgan from "morgan";
import { config } from "./config/config";
import reportRoutes from "./routes/report";

const app = express();

// 中间件
app.use(cors());
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
    console.error(err.stack);
    res.status(500).json({
      status: "error",
      error: "服务器内部错误",
    });
  }
);

// 启动服务器
app.listen(config.port, () => {
  console.log(`服务器运行在 http://localhost:${config.port}`);
});
