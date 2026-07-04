# HANDOFF.md — 项目交接（给下一个 AI 助手 / 人类维护者）

> 最后更新：2026-07-04。前任助手：Claude Code。
> 三份必读：**本文件**（当前状态与下一步）→ `docs/pm-agent-prompt.md`（主规格，
> 一切 Phase 定义以它为准）→ `docs/session-log.md`（完整历史）。

## 一句话定位

**个人预测市场量化系统**：用户（单人）在手机/网页输入一句策略想法 → 回测 →
成功后经风控确认一键实盘（Polymarket / predict.fun）。不是多租户 SaaS。

## 当前可运行状态

```bash
bash scripts/dev.sh        # 一键起三个服务（首次自动装依赖）
# backtest :8000  旧通用阈值引擎（mock 数据）
# pm-agent :8001  新架构核心（世界杯策略已可回测）
# web      :3000  仪表盘（回测/数据/系统 三标签页）
```

零依赖预览：`web/public/snapshot.html` 浏览器直接打开。

已验证的端到端示例：输入"2026世界杯开赛前1分钟每场买入胜率高的一方获胜，每笔10刀"
→ 报告 +25.64%（L0-DEMO 保真度，估算入场价，敏感性 +17%~+36%）。

## 代码地图

| 路径 | 内容 | 状态 |
|---|---|---|
| `pm-agent/pmagent/` | 新架构核心：models(StrategySpec/Fidelity)、data(WC 数据集)、engine(favorite)、nl(规则解析)、api(:8001) | 演示切片完成 |
| `pm-agent/docs/` | venue-capabilities.md（五源能力矩阵）、deviations.md（偏差+复核清单 D-1~D-9） | Phase 0 交付物 |
| `backtest/` | 旧阈值引擎(:8000)：MarketDataSource 抽象、mock + PolymarketDataSource(未实测) | 可用，将被 pm-agent 吸收 |
| `web/` | Next.js 仪表盘 + `/api/pm/*` 代理 + snapshot.html | 可用 |
| `scripts/dev.sh` | 一键启动 | 可用 |
| `.github/workflows/pages.yml` | 快照发布到 Pages（需仓库 Public+启用 Pages；触发限 main+手动） | 待用户启用 |
| `supabase/schema.sql` | 三表 schema | 未接（可选） |

## 不可协商的红线（来自主规格 §1，已向用户确认保留）

- 默认 DRY_RUN；真实下单必须显式 + 风险闸门：**单笔 ≤$5、总敞口 ≤$20（起步值）、
  每分钟下单上限、kill switch（halt 文件即全体撤单停机）**
- "一键实盘" = 一次风险摘要确认页（策略、限额、当前敞口），不是无确认
- 代币限额 approve；secrets 只进 .env 永不入 git；不可逆操作前停下问用户
- 回测保真度硬约束：数据不满足策略所需保真度 → **拒跑**，禁止降级出数；
  每份报告头部强制声明保真度/区间/撮合假设（`pmagent/models.py` 已实现该结构）
- 禁止自成交/wash trading（含测试）

## 用户已拍板的决策

1. monorepo（pm-agent 在本仓库，不另建）
2. 范围严格按主规格全量（PM+PF 执行，Kalshi/odds 监控，X stub）
3. 风控红线全保留，一键=一次确认
4. 用户能提供：Polygon 钱包+USDC、Anthropic API key、The Odds API key、常开 VPS

## 下一步（按主规格 Phase 顺序，Phase 0 已完成）

1. **Phase 1**：core 事件模型 MarketEvent、MarketDataAdapter/ExecutionAdapter/Strategy
   协议（三态 runner 零修改是全系统最重要不变量）、parquet+duckdb+sqlite、工程规范
2. **Phase 2**：五源监控 + registry + **录制守护（最高优先级——Polymarket 已结算市场
   历史仅 ≥12h 粒度，高保真回测只能靠自录；世界杯决赛 2026-07-19）**
3. **Phase 3**：执行层 + OMS + 风险闸门 + 冒烟（DRY_RUN 全绿后停下向用户申请 live_micro）
4. **Phase 4**：LLM→StrategySpec 两段式 NL 回测（替换 `pmagent/nl/parser.py` 的规则版，
   返回结构不变）
5. Web 对接真实链路 + 实盘确认页

## 阻塞项 / 用户侧行动（截至交接时未完成）

- [ ] 执行环境 egress 放行（清单见 `pm-agent/docs/deviations.md` D-1）——
      所有 `[待验证]` 标注的 API 结论放行后必须现网复核（D-2 清单）
- [ ] predict.fun mainnet API key（Discord 工单，有审核周期）
- [ ] The Odds API 预算拍板（免费 500 credits/月 vs $30/月 20K）
- [ ] VPS 就绪（录制守护 + 完整应用 + Tailscale 私有移动访问）
- [ ] 快照页公网发布二选一：公开小仓库+jsDelivr（推荐）或本仓库 Public+启用 Pages

## 重要技术事实（踩过的坑，别再踩）

- 本项目曾在 Claude 云端容器开发：egress 白名单极窄（pypi/npm/github 可用，
  五源 API 全 403）。**PolymarketDataSource 与能力矩阵中标 [待验证] 的结论未经现网实测**。
- predict.fun 在 BNB Chain（56）/USDT，不是旧资料说的 Blast；无 Python SDK。
- 世界杯赛果数据（`pmagent/data/worldcup2026.json`）：赛果真实、
  **favorite_price_est 是估算值**——接真实价格源之前，任何基于它的结论都只是管道验证。
- PR #1 是从 `claude/clay-quant-os-setup-psq4ii` 分支开的 draft；main 分支落后。
