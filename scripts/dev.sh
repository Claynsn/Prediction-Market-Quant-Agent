#!/usr/bin/env bash
# 一键启动本地开发环境：pm-agent(:8001) + backtest(:8000) + web(:3000)
# 用法：bash scripts/dev.sh   （Ctrl-C 一次性全部停止）
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)

command -v python3 >/dev/null || { echo "缺少 python3（需要 3.11+）"; exit 1; }
command -v npm >/dev/null || { echo "缺少 npm（需要 Node 18+）"; exit 1; }

# Python venv + 依赖（首次自动创建）
if [ ! -d backtest/.venv ]; then
  echo "▸ 创建 Python venv 并安装依赖…"
  python3 -m venv backtest/.venv
  backtest/.venv/bin/pip install -q -r backtest/requirements.txt
fi
PY_BIN="$ROOT/backtest/.venv/bin"

# web 依赖 + env（首次自动准备）
if [ ! -d web/node_modules ]; then
  echo "▸ 安装 web 依赖…"
  (cd web && npm install --no-audit --no-fund)
fi
[ -f web/.env.local ] || cp web/.env.example web/.env.local

cleanup() { echo; echo "▸ 停止全部服务…"; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▸ 启动 backtest 服务 :8000"
(cd backtest && "$PY_BIN/uvicorn" app.main:app --port 8000) &
echo "▸ 启动 pm-agent 服务 :8001"
(cd pm-agent && "$PY_BIN/uvicorn" pmagent.api:app --port 8001) &

# 等两个后端就绪
for port in 8000 8001; do
  for _ in $(seq 1 30); do
    curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1 && break
    sleep 0.5
  done
  curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1 \
    && echo "  ✓ :$port 就绪" || { echo "  ✗ :$port 启动失败"; exit 1; }
done

echo "▸ 启动 web :3000  →  打开 http://localhost:3000"
cd web && npm run dev
