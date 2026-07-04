# venue-capabilities.md — Phase 0 能力矩阵

> 生成日期：2026-07-04 ｜ 状态：**待用户确认后进入 Phase 1**
>
> **证据等级标注**（本环境 egress 封锁了全部五个源的 API/文档域名，见 `deviations.md`）：
> - `[SDK]` = 从官方 SDK 源码直接读出（PyPI/npm 实际下载解包，一手证据，可信度高）
> - `[检索]` = 网络检索多源交叉（含官方文档站的搜索摘要，可信度中）
> - `[待验证]` = 上线前必须现网实测；`deviations.md` 有逐项核对清单

---

## 1. Polymarket

证据基础：`py-clob-client` **v0.34.6**（2026-02-19 发布，活跃维护）源码解包 `[SDK]`。

### 鉴权
- 两级鉴权 `[SDK]`：**L1** = Polygon 私钥 EIP-712 签名（建/删 API key、签订单）；**L2** = API key + HMAC（`/auth/derive-api-key` 可从私钥确定性派生，无需人工申请流程）。
- 另有只读 API key 体系（`/auth/readonly-api-key`）`[SDK]`，监控进程可用只读 key，降低权限面。
- 签名身份三种 `[SDK]`：EOA / Poly Proxy / Gnosis Safe。我们用 EOA（用户直接提供私钥）。

### 行情
- REST `[SDK]`：`/book`、`/books`（批量）、`/price(s)`、`/midpoint(s)`、`/spread(s)`、`/last-trade-price(s)`、`/data/trades`。
- WebSocket `[检索]`：`wss://ws-subscriptions-clob.polymarket.com/ws/market`（公开：book 快照 + `price_change` + `tick_size_change` + `last_trade_price`，按 token_id 订阅）；`/ws/user`（鉴权：订单/成交回报，按 condition_id 订阅）。**PING 每 10s** 保活。另有 sports 频道（体育比赛状态）与 RTDS。`[待验证]`
- 限流 `[检索]`：Cloudflare 节流型（排队而非拒绝）；总体 ~15k/10s，CLOB ~9k/10s，Gamma ~4k/10s，data-api ~1k/10s。`[待验证]`

### 历史数据
- CLOB `/prices-history` `[SDK]`：单 token 价格序列，`interval`/`fidelity`（分钟粒度）或 `startTs`/`endTs`。
- **关键约束** `[检索]`（py-clob-client issue #216）：**已结算/关闭市场只返回 ≥12 小时粒度**，无论成交量多大。⇒ 回填数据只够 L1 粗评；L2/L3 只能靠自录，**录制开得越早可信回测区间越长**（与主提示词判断一致）。
- data-api（`data-api.polymarket.com`）`[检索]`：持仓/活动/持有人等账户维度数据。`[待验证]`

### 交易
- 订单类型 `[SDK]`：**GTC / GTD（限价）、FOK / FAK（市价，FAK≈IOC）**——主提示词要的"限价/市价(IOC/FOK)/TIF"全部覆盖。
- 端点 `[SDK]`：下单 `/order`（批量 `/orders`）、撤单 `/order`（批量 `/orders`、`/cancel-all`、`/cancel-market-orders`——**无改单，撤后重挂**）、`/data/orders`（挂单）、`/balance-allowance`（读+更新）、`/order-scoring`。
- 市场微结构 `[SDK]`：tick size 动态（`/tick-size` 端点 + WS `tick_size_change` 事件，SDK 内置 5 分钟 TTL 缓存）；`/neg-risk` 查询市场是否 neg-risk；`/fee-rate` 查费率。
- 最小下单约束 `[待验证]`：存在（市场元数据字段），具体数值（常见说法 $1/5 shares）需现网确认。
- 手续费 `[待验证]`：`/fee-rate` 端点存在；多数市场当前 0 maker/taker 的说法需现网确认。

### 结算
- 合约 `[SDK]`：Polygon 137；抵押 = USDC `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`；CTF Exchange `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`；**neg-risk 市场走独立 Exchange** `0xC5d563A36AE78145C45a50134d48A1215220f80a` + NegRiskAdapter。
- 结算后经 ConditionalTokens `redeemPositions` 赎回（UMA oracle 裁决）`[检索]` `[待验证]`。
- **neg-risk（多结果市场）与二元市场在下单和合约层都是不同路径**——SDK 按市场自动选 exchange 地址 `[SDK]`。执行层必须显式处理这个分叉。

### 市场元数据 / 发现
- Gamma API（`gamma-api.polymarket.com`）`[检索]`：市场/事件列表、tag 过滤（World Cup 相关 tag 轮询发现新市场）、`outcomes`/`outcomePrices`/`clobTokenIds`（注意：数组字段是 JSON 字符串编码——已在现有 clay-quant-os 适配器中处理过）。

---

## 2. predict.fun

证据基础：`@predictdotfun/sdk` **v1.3.6**（npm，2026-06-12 发布，活跃）源码解包 `[SDK]`；`dev.predict.fun` 文档站检索 `[检索]`。

### 链与资产（与早期资料的关键差异）
- **当前在 BNB Chain**：chainId 56（主网）/ 97（测试网），SDK 常量硬编码 `[SDK]`。早期"Blast 链"资料已过时。
- 抵押 = **USDT**（SDK Constants 含各链 USDT 地址）`[SDK]`；含 YieldBearingConditionalTokens 合约（抵押生息变体）`[SDK]`。
- 合约架构是 Polymarket CTF 的同构 fork：CTFExchange + NegRiskCtfExchange + NegRiskAdapter `[SDK]` ⇒ 执行语义与 Polymarket 高度可复用。
- 钱包：EOA 或 Privy 智能钱包（SDK 含 Kernel/ECDSAValidator ABI）`[SDK]`。我们用 EOA。

### API
- REST `[检索]`：base `https://api.predict.fun/v1/`，`x-api-key` 头鉴权；markets / orderbook / orders（建/撤）。API 参考 UI：`api.predict.fun/docs`；文档站有 `llms.txt`。
- WebSocket 存在（文档站有 WS 章节）`[检索]` `[待验证]`。
- 订单 `[SDK]`：EIP-712 签名订单，`OrderStrategy = MARKET | LIMIT`。
- 限流 `[检索]`：默认 **240 req/min**（按 API key）。
- **⚠️ mainnet API key 需开 Discord 工单申请**（`[检索]`）——有等待周期，**建议立刻去申请**。

### Python 路径
- **PyPI 无任何官方/社区 SDK**（`predict-fun`/`predictfun` 等均不存在）`[SDK]`。
- ⇒ 触发主提示词预留分支：**TS sidecar**（薄封装 `@predictdotfun/sdk` 做签名+下单，Python 经本地 RPC 调用）或 Python 直接实现 REST + EIP-712 签名（订单结构与 Polymarket 同构，`py_order_utils` 思路可迁移）。**倾向后者**（少一个运行时），Phase 3 定案。

---

## 3. Kalshi（只读监控）

证据基础：`kalshi-python` **v2.1.4**（官方，PyPI）源码解包 `[SDK]`。

- Base `[SDK]`：`https://api.elections.kalshi.com/trade-api/v2`（另有 demo 环境）。
- 鉴权 `[SDK]`：RSA-PSS 私钥签名（`KALSHI-ACCESS-KEY/-SIGNATURE/-TIMESTAMP` 头）——**仅交易/账户需要；行情公开免鉴权** `[检索]`。
- 行情 `[SDK]`：markets / events / series / orderbook / trades / **candlesticks**（`get_market_candlesticks`，历史 K 线可回填）。
- WebSocket `[检索]`：只读行情流；基础档限流 ~30 rps（公开数据）。WS URL `[待验证]`。
- 美国 CFTC 监管场所，只做监控不执行（主提示词红线不变）。

---

## 4. The Odds API

证据基础：检索 `[检索]`（官方站被 egress 拦，未能直接核对）。

- 免费档 **500 credits/月**；计费 = `markets × regions` 每次调用，**不是每请求 1 credit**。
- World Cup：sport key `soccer_fifa_world_cup`；覆盖 ~40 主流博彩商（**不含 Pinnacle / Betfair 交易所**——尖锐价源缺失，去 vig 后的"真概率"质量受此限制）。
- 历史赔率为付费功能 ⇒ **免费档无法回填，odds 历史从自录起算**（与主提示词一致）。
- 预算现实 `[待验证]`：500 credits/月 ≈ 每天 16 次单 region 单 market 调用。世界杯期间要有意义的轮询密度（如 5 分钟一次 h2h，单 region）≈ 8,640 credits/月 ⇒ **需要 $30/月 的 20K 档**。→ 需要你拍板（见检查点问题）。

---

## 5. X API（仅记录，默认不接）

证据基础：检索 `[检索]`。

- **2026-02 起新开发者只有按量付费**：读 $0.005/条（月上限 2M 读），发 $0.015/条；旧 $200 Basic / $5k Pro 已停止新签；免费档已取消；Enterprise ~$42k/月起。
- ⇒ 主提示词默认 `X_BACKEND=stub` 维持正确：只建 `SocialAdapter` 接口 + 本地 jsonl 回放源，不接真实 X API。若未来要接，按量付费开个小额度即可起步，接口不变。

---

## 6. 跨源汇总表

| 维度 | Polymarket | predict.fun | Kalshi | Odds | X |
|---|---|---|---|---|---|
| 角色 | 执行+监控+回测 | 执行+监控 | 只读监控 | 只读监控 | stub |
| 鉴权 | 私钥 EIP-712 (L1) + 派生 API key (L2) | x-api-key（工单申请）+ EIP-712 签单 | 行情免鉴权；RSA 签名(不用) | apiKey 参数 | 按量付费 |
| 实时行情 | WS book/price/tick | WS `[待验证]` + REST 240/min | WS 只读 + REST ~30rps | REST 轮询 | — |
| 历史回填 | ⚠️ 已结算市场仅 ≥12h 粒度 | `[待验证]` 预计无 | candlesticks 可回填 | 付费才有→自录 | 无→stub |
| 订单类型 | GTC/GTD/FOK/FAK | MARKET/LIMIT | — | — | — |
| 撤单 | 单/批/全部/按市场 | 有 | — | — | — |
| 改单 | 无（撤后重挂） | `[待验证]` | — | — | — |
| 链/资产 | Polygon / USDC | BNB Chain / USDT | 法币（美） | — | — |
| 多结果市场 | neg-risk 独立 exchange | 同构 neg-risk 合约 | 事件下多市场 | — | — |
| 最小下单 | `[待验证]` | `[待验证]` | — | — | — |

**架构影响提炼**：
1. 两个执行 venue 合约同构（CTF fork）⇒ `ExecutionAdapter` 的订单签名/结算逻辑可大量复用，但**钱包按链隔离**（Polygon-USDC vs BNB-USDT），风险闸门的敞口按 venue 分别计。
2. 高保真数据只能自录 ⇒ Phase 2 录制守护是全项目最高优先级交付物。
3. neg-risk 市场在两个 venue 都是一等公民 ⇒ 事件模型与 OMS 从第一天就要带 `is_neg_risk` 与多结果分组字段，不能事后补。

## 参考来源（检索类）
- Polymarket WS: docs.polymarket.com/market-data/websocket/market-channel；agentbets.ai/guides/polymarket-websocket-guide
- prices-history 12h 限制: github.com/Polymarket/py-clob-client/issues/216
- 限流: agentbets.ai/guides/polymarket-rate-limits-guide；pm.wiki/learn/polymarket-api
- predict.fun: dev.predict.fun（getting started / create-an-order / orderbook / websocket）
- Kalshi: docs.kalshi.com/getting_started/rate_limits；pm.wiki/learn/kalshi-api
- Odds: the-odds-api.com；oddspapi.io/blog/odds-api-pricing-2026-comparison
- X: postproxy.dev/blog/x-api-pricing-2026；blotato.com/blog/twitter-api-pricing
