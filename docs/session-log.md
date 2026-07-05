# session-log.md — 与 Claude Code 的完整会话记录（整理版）

> 本文件按时间顺序整理了本项目从零到当前状态的全部对话与产出，供后续任何
> AI 助手（Codex 等）或人类接手时快速还原上下文。逐条对应 git 提交。

## 会话 1（2026-06-19 ~ 06-20）：MVP 从零搭建

**用户请求**：仓库描述为"已搭好 MVP"的 C 端量化 SaaS（想法→策略→mock 回测→Paper
Trading），要求先读代码再干活。

**实际情况**：仓库是空的（只有 README 一行字）。于是按用户给的架构规格从零建出全套：

- `backtest/`（Python+FastAPI :8000）：`MarketDataSource` 抽象、mock Polymarket 数据
  （含"假突破"市场制造真实亏损）、阈值策略（YES≥70% 买入持有到结算）、事件驱动回测
  引擎（逐步 mark-to-market、单笔/单市场仓位上限、手续费、滑点）、规则版"想法→策略"
  解析器、`/strategy/generate` + `/backtest`
- `web/`（Next.js App Router+TS+Tailwind :3000）：完整闭环页面、无依赖 SVG 净值/回撤图、
  disabled 的"确认实盘"按钮、API 路由代理、Supabase 未配置时优雅降级
- `supabase/schema.sql`：ideas / strategies / backtests 三张表
- 全链路本地验证通过；开出 PR #1（draft）

→ commit `da0f07f`

**追加**："接入真实 Polymarket API"。实现 `PolymarketDataSource`（Gamma 元数据 +
CLOB prices-history，stdlib urllib，TTL 缓存，不可达时自动回退 mock，`/health` 报
live/fallback/error 模式）。**注意：本执行环境 egress 屏蔽 Polymarket 域名，代码按
文档形状盲写 + 离线单测验证，未经现网实测**。→ commit `b4c9edd`

## 会话 2（2026-07-04）：定位转向 pm-agent

**用户上传** `docs/pm-agent-prompt.md`（预测市场量化基础设施的完整构建提示词，
本仓库的主规格文件），要求对比现有项目分析取舍。

**分析结论**：两者定位不同（C 端 SaaS vs 个人量化基础设施）。用户随后拍板：
**"我要的就是个人预测市场量化系统：手机/网页随时回测想法，成功后一键实盘。
旧项目当页面部分，整体框架按文档做。"**

**四项决策（AskUserQuestion 确认）**：
1. **monorepo**：pm-agent 作为本仓库顶级目录（不另建仓库）
2. **范围**：严格按文档全量（Polymarket+predict.fun 执行；Kalshi/odds 监控；X stub）
3. **实盘风控**：保留全部红线，"一键"=一次风险摘要确认页；闸门先按 $5/$20 起步
4. **材料**：用户可提供 Polygon 钱包+USDC、Anthropic API key、The Odds API key、常开 VPS

## Phase 0：能力发现（已完成，commit `955d02b`）

egress 屏蔽全部五源的 API 与文档域名，改用 **PyPI/npm 下载官方 SDK 解包读源码**
（py-clob-client 0.34.6 / @predictdotfun/sdk 1.3.6 / kalshi-python 2.1.4）+ 网络检索
交叉验证。产出 `pm-agent/docs/venue-capabilities.md`（逐条标注 [SDK]/[检索]/[待验证]）
与 `pm-agent/docs/deviations.md`（D-1~D-9 偏差与复核清单）。

**关键发现**：
- Polymarket：订单类型 GTC/GTD/FOK/FAK、无改单；tick size 动态；neg-risk 走独立
  exchange 合约；**已结算市场价格历史仅 ≥12h 粒度 → 高保真回测只能靠自录**
- predict.fun：**已迁 BNB Chain（56）、抵押 USDT**；合约是 Polymarket CTF 同构 fork；
  **无 Python SDK**（倾向 Python 直连 REST+EIP-712 而非 TS sidecar）；
  **mainnet API key 需 Discord 工单（用户应尽早申请）**
- Kalshi：行情完全免鉴权（含 candlesticks 历史回填）
- The Odds API：免费 500 credits/月撑不起世界杯轮询密度（预算待用户拍板）
- X API：免费档已取消（2026-02 起按量付费）→ 维持 stub

## 端到端演示切片（已完成，commits `5b90469`~`285c44e`）

**用户请求**："先做出能查看一切信息、能输入策略想法的网页，跑通一个回测：
2026 世界杯开赛前 1 分钟每场买胜率高的一方，每笔 $10，总收益率如何"

**产出**：
- `pm-agent/pmagent/`：StrategySpec 模型 + 保真度分级（L0_DEMO/L1/L2/L3）+
  世界杯 R32 数据集（16 场，逐字段 provenance）+ favorite 引擎（含入场价敏感性扫描、
  强制报告头）+ 规则 NL 解析（含回显）+ FastAPI :8001
- web 仪表盘三标签页：策略回测 / 数据 / 系统；`/api/pm/*` 代理
- `web/public/snapshot.html`：零依赖自包含快照（数据+引擎内嵌，手机适配已验证）
- `scripts/dev.sh`：一键启动三服务
- `.github/workflows/pages.yml`：Pages 发布（触发限 main+手动，因仓库私有未启用 Pages
  会 404——已处理过一次相应的 CI 红叉）

**回测结果（重要：注意保真度）**：
- **总收益率 +25.64%**（总投入 $160，盈亏 +$41.03），胜率 14/16，爆冷 2 场
  （巴拉圭点球淘汰德国、摩洛哥点球淘汰荷兰）
- **赛果真实**（多源新闻核验）；**入场价为估算收盘概率**（真实 T-1min 价不可回补）
  → 保真度 L0-DEMO，结果应读作敏感性区间 **+17.1% ~ +35.7%**（±5¢ 扰动）
- 3 场热门认定低置信（Côte d'Ivoire/Norway、Mexico/Ecuador、Australia/Egypt）

## 移动访问与账号迁移（2026-07-04 尾声）

- 曾发布 claude.ai Artifact 链接 → **用户 Claude 账号被封、会员将到期，该链接失效**
- 通用路线（待用户完成其一）：
  - **方案 A（推荐）**：GitHub 建公开小仓库 `clay-quant-dashboard`，上传
    `web/public/snapshot.html` 改名 `index.html`；直链
    `https://cdn.jsdelivr.net/gh/Claynsn/clay-quant-dashboard@main/index.html`，
    可选再开 Pages
  - **方案 B**：本仓库设 Public + Settings→Pages→Source: GitHub Actions，
    工作流已就绪，发布到 `https://claynsn.github.io/Prediction-Market-Quant-Agent/`
    （仓库已两次更名：clay-quant-os- → clay-quant-os → Prediction-Market-Quant-Agent）
- 长期方案：完整应用跑用户 VPS + Tailscale 私有访问（涉及私钥后绝不走公开页面）
- 本次会话最后：应用户要求把全部成果与记录整理进仓库（本文件 + HANDOFF.md +
  AGENTS.md），交接给 Codex

## 遗留任务（按主规格 docs/pm-agent-prompt.md 的 Phase 顺序）

- [ ] Phase 1 核心架构：MarketEvent 事件模型、Adapter/Strategy 协议、
      Parquet+DuckDB+SQLite 存储、Makefile、uv+ruff+mypy+pytest
- [ ] Phase 2 监控层：五源接入、断线重连、gap 检测、registry 跨平台对齐、
      录制守护（systemd，跑在用户 VPS，**越早开录越好，决赛 7/19**）
- [ ] Phase 3 执行层：两 venue 原子操作全集、OMS 状态机、风险闸门（$5/$20/频控/
      kill switch）、冒烟脚本；DRY_RUN 全绿后向用户申请 live_micro
- [ ] Phase 4 NL 回测：Claude/LLM → StrategySpec 两段式（用户提供 API key）、
      L1-L3 保真度硬约束、三条内置冒烟回测
- [ ] Web 对接：真实数据回测、实盘一次确认页、持仓/kill switch 状态页
- [ ] 用户侧行动项：egress 放行域名清单（deviations.md D-1）、predict.fun Discord
      工单、Odds API 预算拍板、VPS 就绪通知
