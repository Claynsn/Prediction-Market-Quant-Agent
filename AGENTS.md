# AGENTS.md — Clay Quant OS / pm-agent

个人预测市场量化系统（单用户）：一句话策略想法 → 回测 → 风控确认后一键实盘
（Polymarket / predict.fun）。

## 接手必读（按顺序）

1. `docs/HANDOFF.md` — 当前状态、已拍板决策、下一步、阻塞项
2. `docs/pm-agent-prompt.md` — **主规格**：Phase 0-4 定义、红线、验收标准，一切以它为准
3. `docs/session-log.md` — 完整开发历史
4. `pm-agent/docs/venue-capabilities.md` + `deviations.md` — 五平台 API 能力矩阵与待验证项

## 运行

```bash
bash scripts/dev.sh   # 一键启动；或分别：
# cd backtest && .venv/bin/uvicorn app.main:app --port 8000
# cd pm-agent && ../backtest/.venv/bin/uvicorn pmagent.api:app --port 8001
# cd web && npm run dev            # :3000，.env.local 由 dev.sh 自动生成
```

零依赖预览：直接用浏览器打开 `web/public/snapshot.html`。

## 目录

- `pm-agent/pmagent/` — 新架构核心（models / data / engine / nl / api）。**新功能写这里**
- `backtest/` — 旧通用阈值引擎，将被 pm-agent 逐步吸收，别扩展它
- `web/` — Next.js 仪表盘；`app/api/pm/[...path]` 代理到 :8001
- `docs/` — 交接文档与主规格；`pm-agent/docs/` — Phase 0 交付物

## 硬性约束（改代码前先读）

- **风控红线**（主规格 §1，用户已确认保留）：默认 DRY_RUN；实盘需一次风险摘要确认；
  闸门单笔 ≤$5、总敞口 ≤$20 起步、频控、kill switch；闸门实现在 OMS 内部，任何策略绕不过；
  secrets 只进 `.env`（永不入 git）；不可逆操作前停下问用户；禁止 wash trading（含测试）。
- **回测诚实性**：策略声明所需保真度（L0_DEMO/L1/L2/L3，见 `pmagent/models.py`），
  数据不满足 → 拒跑不降级；报告头强制声明保真度/区间/撮合假设。
  当前世界杯数据集的入场价是**估算值**（provenance 字段有标注），别当真实价用。
- **同一策略代码在 backtest / paper / live 三种 runner 下零修改运行**——
  这是全系统最重要的架构不变量（主规格 §5）。
- 保持 `web/lib/types.ts` ↔ `backtest/app/models.py`、`web/lib/pmTypes.ts` ↔
  `pmagent/models.py` 同步。
- 提交信息用英文；UI 与文档中文。

## 已知环境坑

- 曾用的云开发环境 egress 屏蔽全部交易所/数据源 API（能力矩阵中 `[待验证]` 项
  未经现网实测，放行后先跑 `deviations.md` D-2 复核清单）。
- predict.fun：BNB Chain(56)/USDT、无 Python SDK（计划 Python 直连 REST+EIP-712）、
  mainnet API key 需 Discord 工单。
- Polymarket 已结算市场历史仅 ≥12h 粒度 → 高保真回测数据只能自录（Phase 2 录制守护
  是最高优先级，跑在用户 VPS）。
