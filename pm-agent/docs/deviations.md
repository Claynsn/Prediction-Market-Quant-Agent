# deviations.md — 与主提示词/现网的偏差记录

按主提示词红线："本文档中所有 API 细节都可能过时，Phase 0 以现网官方文档为准；差异记入本文件。"

## D-1 ⚠️ Phase 0 未能完全"以现网为准"——egress 封锁（环境级，最重要）

当前云端环境的出站网络策略拦截了**全部五个源的 API 与文档域名**（CONNECT 403，直连与
WebFetch 均不通）。可用证据通道只有：PyPI / npm（下载官方 SDK 解包读源码）与网络检索。

**处理方式**：能力矩阵每条结论标注证据等级；`[SDK]` 级（订单类型、端点路径、合约地址、
鉴权机制、链与资产）可信度接近现网文档；`[检索]` 级需现网复核。

**需要用户操作**：在环境网络设置放行以下域名（Phase 2 开始的所有联调依赖）：
```
gamma-api.polymarket.com
clob.polymarket.com
data-api.polymarket.com
ws-subscriptions-clob.polymarket.com
api.predict.fun
api.elections.kalshi.com
api.the-odds-api.com
docs.polymarket.com          # 文档复核用（可选）
dev.predict.fun              # 文档复核用（可选）
docs.kalshi.com              # 文档复核用（可选）
```
7×24 录制反正跑在用户 VPS 上（不受此环境限制），但开发期联调需要上述放行。

## D-2 现网复核清单（放行后 / VPS 上第一时间跑）

- [ ] Polymarket `/prices-history`：确认已结算市场 12h 粒度限制、活跃市场最细粒度与最大回溯
- [ ] Polymarket 最小下单约束与 `/fee-rate` 实际值（矩阵 `[待验证]` 项）
- [ ] Polymarket WS：订阅格式、10s PING、`tick_size_change` 实际 payload
- [ ] predict.fun：REST /v1 全端点对照 `api.predict.fun/docs`、WS 有无、改单有无、最小下单
- [ ] Kalshi WS URL 与订阅格式；candlesticks 最大回溯与粒度
- [ ] The Odds API：`soccer_fifa_world_cup` 实际返回、credit 消耗公式验证
- [ ] 限流数值全部以实测/官方文档为准（检索值只做初始预算）

## D-3 predict.fun 无 Python SDK → 触发预留分支

PyPI 无任何 predict.fun 包；官方只有 TypeScript SDK（`@predictdotfun/sdk` v1.3.6，活跃）。
主提示词允许"无可行 Python 路径时 TS sidecar"。**当前倾向**：不起 sidecar，Python 直接实现
REST + EIP-712 订单签名——合约与订单结构和 Polymarket 同构（CTF fork），复用成本低。
Phase 3 开工时定案，若签名细节坑多再退回 sidecar 方案。

## D-4 predict.fun 已迁移至 BNB Chain（旧资料作废）

SDK v1.3.6 常量：chainId 56/97，抵押 USDT，RPC 指向 bsc-dataseed。任何提及 Blast 链/
USDB 的旧资料一律作废。风险闸门敞口按 venue×链分账（Polygon-USDC / BNB-USDT）。

## D-5 predict.fun mainnet API key 需 Discord 工单

有人工审核周期，是 Phase 2/3 的关键路径。**用户应立即申请**，不阻塞 Phase 1 开发。

## D-6 X API 免费档已取消（2026-02 起按量付费）

主提示词的 `X_BACKEND=stub` 默认维持；真接入的最低成本路径是按量付费小额充值
（读 $0.005/条），接口设计不变，接入与否随时可切。

## D-7 The Odds API 免费档预算不够世界杯密度

500 credits/月，计费 = markets × regions/次。世界杯期间 5 分钟级轮询需 ~8.6k credits/月
⇒ 需 $30/月 20K 档，或把免费档预算集中到比赛日窗口（比赛时段 5 分钟级、平时小时级）。
**待用户拍板**（Phase 2 前）。

## D-8 Polymarket 历史数据回填上限低于预期

已结算市场只有 ≥12h 粒度（py-clob-client issue #216，多方印证）。影响：
- 回填数据只支撑 L1（阈值/taker 型粗评）
- L2/L3 可信区间 = 自录起点之后 ⇒ 录制守护（Phase 2）是全项目最高优先级
- 距世界杯决赛 15 天，每晚一天开录少一天可信数据

## D-9 monorepo 决策（用户已拍板）

pm-agent 不建独立仓库，作为本仓库顶级目录 `pm-agent/` 与 `web/`（界面层）、
`backtest/`（旧 MVP 服务，Phase 4 后由 pm-agent 取代其职能）并存。
"一键实盘" = 一次确认页（风险摘要）+ 文档全部红线保留（DRY_RUN 默认、$5/$20 闸门起步、
kill switch、限额 approve）。
