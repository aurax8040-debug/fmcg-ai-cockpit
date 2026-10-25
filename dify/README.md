# 快消智析·KA活动研判（Dify Workflow）

这是本地 Demo 的专用 Dify 工作流，不修改已有聊天助手。浏览器不会持有 Dify 密钥；`mock-bi` 服务通过 Dify Workflow API 调用它。

## 导入与发布

1. 登录本地 Dify，进入“工作室”，选择“导入 DSL”。
2. 导入 `ka-activity-analysis.yml`，确认模型节点选择已安装的 DeepSeek `deepseek-chat`。
3. 检查输入变量：`activity_id`、`question`、`role`、`evidence_json`、`data_version`。
4. 用匿名样例运行一次。输出必须是 JSON，并且引用只能来自输入中的 `trace_ids`。
5. 发布工作流，在“访问 API”页创建工作流 API 密钥。
6. 复制 `.env.demo.example` 为未跟踪的 `.env.demo`，只在本机填写 `DIFY_API_KEY`。不要把密钥粘贴到网页、DSL、截图、Git 或项目记忆。
7. 运行 `./scripts/demo-stack.sh up`；轮换密钥时先在 Dify 撤销旧密钥，再更新本机 `.env.demo` 并重启 `mock-bi`。

## 安全边界

- 经营数字由 Mock BI 代码计算，模型只做归纳、缺口识别和核查建议。
- 模型不能判断门店缺货，除非输入中真的存在库存证据。
- 没有有效对照组时只能说“变化观察”，不能声称活动带来因果增量。
- AI 建议不能自动下发任务、审批费用或调整资源，必须人工确认。
- 输出缺字段、不是合法 JSON 或引用未知 `trace_id` 时，服务会拒绝该结果并保留确定性指标。

## 当前状态

DSL、输出 Schema、Mock BI 网关和失败保护已经准备好。首次导入、模型节点确认、发布和 API 密钥创建必须在登录本地 Dify 后完成。
