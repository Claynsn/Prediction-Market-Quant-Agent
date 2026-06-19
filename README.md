# Clay Quant OS

面向 C 端的个人量化系统 SaaS（MVP）。

把一句模糊的策略想法 → 生成具体策略 → 在 mock Polymarket 数据上回测 →
展示收益 / 最大回撤 / 胜率 / 样本数 / 失败原因 + 净值与回撤图 → 保存 → Paper Trading。
"确认实盘" 目前 disabled（提示"实盘执行下一阶段开放"）。

## 架构

```
web/        Next.js (App Router) + TypeScript + Tailwind 前端
            app/page.tsx          主页面（编排整个闭环）
            components/           IdeaInput / StrategyCard / BacktestResult / 图表 / PaperTrading
            app/api/              调用 Python 服务、写 Supabase 的 route handlers
            lib/                  types.ts / supabase.ts / backtestClient.ts

backtest/   Python + FastAPI 回测服务
            app/main.py           /strategy/generate 与 /backtest
            app/data/base.py      数据源抽象接口 MarketDataSource（swap point #1）
            app/data/mock_polymarket.py
            app/strategies/threshold.py
            app/engine/backtester.py   事件驱动回测引擎
            app/nlp/parser.py     "想法→策略" 规则解析器（swap point #2）

supabase/   schema.sql：ideas / strategies / backtests 三张表
```

## 本地启动

需要 Node 18+ 与 Python 3.11+。两个服务分别启动。

### 1. 回测服务（端口 8000）

```bash
cd backtest
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

健康检查：`curl localhost:8000/health`

### 2. 前端（端口 3000）

```bash
cd web
npm install
cp .env.example .env.local   # 默认 BACKTEST_URL=http://127.0.0.1:8000
npm run dev
```

打开 http://localhost:3000 ，输入一句想法即可跑通整个闭环。

## 持久化（可选）

不配置 Supabase 也能完整运行，"保存" 会提示"未持久化"。要启用持久化：

1. 在 Supabase 项目里执行 `supabase/schema.sql`
2. 在 `web/.env.local` 填入 `SUPABASE_URL` 与 `SUPABASE_SERVICE_ROLE_KEY`

## 预留的扩展点（swap points）

1. **真实数据**：实现 `PolymarketDataSource(MarketDataSource)`（`backtest/app/data/base.py`），
   引擎、策略、API 都不用动。
2. **AI 生成策略**：把 `backtest/app/nlp/parser.py` 的规则解析换成 Claude 调用，
   返回结构（`StrategyConfig` + `assumptions` + `missing`）不变，`missing` 可驱动追问缺失参数。
3. **实盘执行**：`PaperTradingPanel` 是 stub，未来在同一接口后接 live executor，
   并加上线前风控确认流程（仓位上限、日亏损熔断、二次确认）。

## 第一版策略

买入概率 ≥ 70% 的 YES，持有到结算。默认：起始资金 1000 USDC、单笔 5%、阈值 70%、
单市场上限 10%、手续费 0、滑点 1%。YES 结算得 1 USDC/份，NO 归零。

数据为 mock Polymarket，仅供研究，非投资建议。
