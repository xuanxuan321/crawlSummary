const axios = require("axios");
const fs = require("fs");

async function generateReport() {
  try {
    // 读取请求数据
    const requestData = JSON.parse(
      fs.readFileSync("./example-request.json", "utf8")
    );

    // 发送请求
    console.log("开始生成报告...");
    const response = await axios.post(
      "http://localhost:3000/api/report/generate",
      requestData
    );

    // 保存报告
    if (response.data.status === "success") {
      fs.writeFileSync("./generated-report.md", response.data.report);
      console.log("报告生成成功！已保存到 generated-report.md");
      console.log("元数据:", response.data.metadata);
    } else {
      console.error("生成报告失败:", response.data.error);
    }
  } catch (error) {
    console.error("请求失败:", error.message);
  }
}

generateReport();
