# pm-agent — 预测市场量化基础设施 · Claude Code 构建提示词

## 0. 使命
构建预测市场量化系统的基础设施层，三个交付物：
1. **执行层**：在 Polymarket 和 predict.fun 上执行任意策略所需的全部原子操作
2. **监控层**：统一监控 Polymarket / predict.fun / Kalshi / 传统博彩赔率 / X 等信息源
3. **回测层**：自然语言驱动、可回测策略的完整模块

本阶段**不写任何 alpha 策略**。唯一目标：所有操作可执行、所有信息可监控、回测管道端到端跑通。策略是之后往标准接口里插的插件。

## 1. 红线（不可协商）
- 默认 `DRY_RUN=true`。真实下单必须显式 `--live`，且经过风险闸门：单笔 ≤ $5、总敞口 ≤ $20、每分钟下单数上限、kill switch（`RUN/halt` 文件存在即全体撤单停机）。
- 代币授权一律限额 approve；若 SDK 强制无限 approve，停下来问用户。
- 禁止任何形式的自成交 / wash trading，包括测试场景。
- Secrets 只走 `.env`（提供 `.env.example`），永不入 git。
- **本文档中所有 API 细节都可能过时**。Phase 0 以现网官方文档为准；与本文冲突时以现网为准，差异记入 `docs/deviations.md`。
- 所有网络组件尊重 `HTTPS_PROXY` / `ALL_PROXY` 环境变量。
- 不可逆操作（真实成交、approve、资金转移）前必须停下来向用户确认。

## 2. 参数（用户未另行指定时按默认值执行）
| 参数 | 默认 | 备选 |
|---|---|---|
| `X_BACKEND` | `stub`（只建接口 + 本地 jsonl 模拟源） | `x_api`（付费官方 API）/ `third_party` |
| `ODDS_SOURCE` | `the_odds_api`（免费档） | `betfair_api` / 自定义 |
| `EXEC_TEST_MODE` | `dry_run` 全绿后申请 `live_micro` | `dry_run_only` |
| `NL_BT_MODE` | DSL 优先，代码生成兜底（需确认后运行） | — |
| `LANG` | Python 3.11+ 单语言 | predict.fun 无可行 Python 路径时允许 TS sidecar |

## 3. 用户需提供（开工前逐项索取）
- Polymarket：Polygon 钱包私钥、已入金 USDC（或已有 API credentials）
- predict.fun：对应链钱包私钥、已入金、API key（如需）
- Kalshi：API key（只读监控；若公开端点够用可免）
- The Odds API key（免费注册）
- Anthropic API key（NL 回测模块用）
- 一台常开机器/VPS 用于 7×24 行情录制（交付 systemd unit）

## 4. Phase 0 — 能力发现（先做，做完停下给用户看）
逐一拉取并精读现网文档，产出 `docs/venue-capabilities.md` 能力矩阵，维度：
- 鉴权方式与 key 获取流程
- 行情：REST / WebSocket 端点、订阅粒度（top-of-book / 深度 / 逐笔）、限流
- 历史数据：可回溯深度、粒度、获取方式（官方 API / subgraph / 第三方）
- 交易：订单类型（限价/市价/TIF）、撤单改单、**最小下单约束**、费用结构
- 结算：结算/赎回/claim 流程、保证金资产与所在链
- 市场元数据：新市场发现方式；**注意 Polymarket 多结果市场（neg-risk）与二元市场的结构差异**

覆盖对象：
1. **Polymarket**：CLOB API（REST+WS）、Gamma API（市场元数据）、data-api、`py-clob-client` 现状与版本
2. **predict.fun**：官方 docs 与 SDK（确认是否有 Python 路径；确认当前所在链与保证金币种）
3. **Kalshi**：Trade API 行情与历史 candles（只监控，不执行）
4. **The Odds API**：足球/World Cup 覆盖、免费档配额、赔率格式
5. **X API**：当前 search/stream 定价与配额（仅记录，默认不接）

**检查点：矩阵完成后暂停，等用户确认再进 Phase 1。**

## 5. Phase 1 — 核心架构
```
pm-agent/
  core/          # 事件模型、EventBus、时钟、公共类型
  adapters/
    polymarket/  # market_data.py + execution.py
    predictfun/
    kalshi/      # 只读
    odds/        # the_odds_api
    social/      # 接口 + stub
  registry/      # 跨平台市场对齐
  store/         # parquet 写入、duckdb 查询、sqlite 状态
  oms/           # 订单状态机、风险闸门、kill switch
  backtest/      # 引擎 + 三态 runner
  nl/            # 自然语言 → 策略
  strategies/    # 空目录 + examples/noop.py
  scripts/       # record / tail / smoke_* / bt
  docs/
```

统一事件模型（所有 adapter 的唯一输出形态）：
```python
@dataclass
class MarketEvent:
    ts: float        # 交易所时间优先，缺失用本地时间并打标
    recv_ts: float   # 本地接收时间（延迟分析用）
    source: str      # polymarket | predictfun | kalshi | odds | social
    kind: str        # quote | book | trade | odds | post | market_meta
    market_key: str  # registry 全局键；未对齐则 source:native_id
    payload: dict    # 规范化后的内容
```

Adapter 接口（行情与执行严格分离）：
```python
class MarketDataAdapter(Protocol):
    async def stream(self) -> AsyncIterator[MarketEvent]: ...
    async def snapshot(self, market_key: str) -> MarketEvent: ...
    def health(self) -> Health: ...

class ExecutionAdapter(Protocol):
    async def place(self, o: OrderRequest) -> OrderAck: ...
    async def cancel(self, order_id: str) -> bool: ...
    async def cancel_all(self, market_key: str | None = None) -> int: ...
    async def open_orders(self) -> list[Order]: ...
    async def positions(self) -> list[Position]: ...
    async def balances(self) -> Balances: ...
    async def fills(self) -> AsyncIterator[Fill]: ...
```

Strategy 接口——**全系统最重要的不变量：同一份策略代码在 backtest / paper / live 三种 runner 下零修改运行**：
```python
class Strategy(Protocol):
    def on_event(self, evt: MarketEvent, ctx: Context) -> None: ...
# ctx 提供: ctx.book(mk) ctx.positions() ctx.buy(mk, px, qty, tif)
#          ctx.sell(...) ctx.cancel(id) ctx.now() ctx.log() ctx.metric()
```

存储：
- 全部 MarketEvent 追加写 Parquet，按 `source/date` 分区；DuckDB 即席查询
- 订单/持仓/运行状态在 SQLite
- **录制守护进程 `make record` 从 Phase 2 完成当天起 7×24 运行**——自录数据是未来高保真回测的唯一来源，晚开录一天就少一天可信回测区间

## 6. Phase 2 — 监控层
每个源的完成定义：连接 → 规范化为 MarketEvent → 落盘 → 断线自动重连（指数退避）→ 数据 gap 检测与记录 → `scripts/tail.py --source X` 可实时肉眼验证。

- **Polymarket**：WS 订阅 book/trades/price；Gamma 轮询发现新市场（World Cup 相关 tag 优先）
- **predict.fun**：同上；无 WS 则 REST 轮询，频率贴限流上限的 70%
- **Kalshi**：行情 + 市场列表
- **Odds**（the_odds_api）：轮询足球赔率，规范化为隐含概率，**去 vig 用 proportional 和 Shin 两种方法各存一列**
- **Social**：`SocialAdapter` 接口 + stub（读本地 jsonl 回放），真实 backend 按参数决定，不阻塞主线

**Registry（跨平台市场对齐）**：同一真实事件（如"法国 vs 巴西 7/10"）在各平台的 market id 映射。半自动：队名/日期规则粗筛 → LLM 复核 → 写入 `registry/mappings.yaml` 供人工修订。这是任何跨平台策略的前置依赖，监控期就要建好。

监控面板：terminal（rich）即可——每源心跳、延迟 p50/p99、事件计数、gap 列表。不做 web UI。

**验收**：连续录制 24h，gap 全部被检测并记录；每源事件计数 > 0；至少 3 场比赛在 ≥3 个源上对齐成功。

## 7. Phase 3 — 执行层（两个 venue 全量原子操作）
操作全集：place_limit / place_market(IOC/FOK) / cancel / cancel_all / open_orders / positions / balances / allowance 管理（限额）/ fills 流 /（若平台支持）结算 claim。

OMS：
- 客户端订单 id，幂等提交
- 状态机 `NEW → ACKED → PARTIAL → FILLED | CANCELED | REJECTED`，WS 回报 + REST 定期对账双通道
- 风险闸门实现在 OMS 内部，任何策略/脚本都绕不过

冒烟测试（每 venue 一份 `scripts/smoke_exec_<venue>.py`，先 DRY_RUN 后 live）：
1. 读余额、持仓、allowance
2. 挂深度价外限价单（在满足最小下单约束前提下选离成交最远的合法价格）→ `open_orders` 确认存在 → cancel → 确认消失
3. 异常路径：无效市场被拒、超风险闸门被拦截、kill switch 生效即撤单停机
4. （可选，**逐笔经用户确认**）$1 级真实成交一次，验证 fills 回报与持仓更新；建议选临近结算、价格 ≈0.99 的市场，结算后顺带测 claim 流程

**检查点：DRY_RUN 全绿后暂停，向用户申请 live_micro。**

## 8. Phase 4 — 自然语言回测模块
### 数据
- 回填：Polymarket 历史价格序列（Phase 0 查明粒度与来源）、Kalshi candles；odds 与 social 历史无法回填，从自录起算
- **保真度分级（硬约束，写进引擎）**：
  - **L1** = mid/last 价格序列（可回填）：只适用 taker 型 / 阈值型策略的粗评
  - **L2** = top-of-book（自录数据起）
  - **L3** = 深度数据（自录数据起）：maker 策略、滑点敏感策略仅在 L3 下结论可信
  - 策略声明所需保真度；数据不满足时**直接报错拒跑**，禁止降级出数——宁可没有结论，不要假结论
- 每份回测报告头部强制打印：数据保真度、时间区间、撮合假设

### 引擎
- 事件回放驱动，与 live 完全相同的 Strategy 接口
- 撮合假设从保守：taker 按对手价吃可见深度；maker 需价格穿越才算成交且按最坏排队位置；手续费/gas 按 venue 参数表
- 输出：PnL 曲线、逐笔明细、最大回撤、滑点敏感性（±扰动）

### NL 层
- CLI：`pm bt "<自然语言策略描述>" --from --to --venues --fidelity`
- 两段式：
  1. LLM（Claude API）解析为 **StrategySpec**（受限 JSON schema：触发条件 / 腿 / 定价规则 / 退出 / 风控），schema 校验通过直接编译执行——覆盖阈值、价差、收敛、事件触发等常见模式
  2. 超出 DSL 表达力 → 生成 `Strategy` 子类代码，打印代码 + 静态检查 + 受限沙箱，**经用户确认后**才运行
- 执行前回显："我理解你要回测的是：……"，防误译

**验收**：三条内置冒烟回测在样例数据上端到端跑通并出报告：
1. 阈值买入持有到结算（L1）
2. 双 venue 价差收敛纸面套利（L2，自录数据）
3. odds 隐含概率 vs 市场价偏离触发（L1 + odds 自录）

## 9. 工程规范
- Python 3.11+，uv 管理，ruff + mypy strict，pytest（重点覆盖：adapter 规范化、OMS 状态机、风险闸门、去 vig 计算）
- `Makefile`：`record / tail / smoke / bt / test / halt`
- README = runbook：从零到跑通的每条命令
- 每个 Phase 结束写 `docs/phaseN-report.md`（半页：做了什么 / 偏差 / 下阶段风险）并暂停等用户确认
- 遇到收费墙、文档矛盾、平台风控/合规限制：停下来问用户，不要自行绕过

## 10. 顺序与时间
Phase 0 → 1 → 2（录制立刻开跑）→ 3 → 4。2026 World Cup 决赛 7/19：Phase 0–2 目标 2 天内完成并上线录制，Phase 3 随后 1–2 天，Phase 4 可在录制积累数据的同时并行开发。
