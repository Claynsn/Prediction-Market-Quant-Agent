#!/usr/bin/env bash
# 一键启动本地开发环境：pm-agent(:8001) + backtest(:8000) + web(:3000)
# 用法：bash scripts/dev.sh   （Ctrl-C 一次性全部停止）
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LOG_DIR="$ROOT/.dev-logs"; mkdir -p "$LOG_DIR"

# ---- 选择 Python：优先新版本，最低 3.9（Mac 系统自带常为 3.9）----
PY=""
for cand in python3.13 python3.12 python3.11 python3.10 python3; do
  if command -v "$cand" >/dev/null 2>&1; then
    if "$cand" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 9) else 1)'; then
      PY="$cand"; break
    fi
  fi
done
if [ -z "$PY" ]; then
  echo "✗ 未找到 Python 3.9+。Mac 安装：brew install python@3.12（或从 python.org 下载）"
  exit 1
fi
echo "▸ 使用 Python: $($PY --version) ($(command -v $PY))"

command -v npm >/dev/null || { echo "✗ 缺少 npm（Node 18+）。Mac 安装：brew install node"; exit 1; }

# ---- 端口占用检查 ----
for port in 8000 8001 3000; do
  if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "✗ 端口 $port 已被占用。查看并结束占用进程：lsof -i :$port  然后 kill <PID>"
    exit 1
  fi
done

# ---- Python venv + 依赖（首次自动创建；若 venv 是旧解释器建的也能重建）----
if [ ! -x backtest/.venv/bin/python ]; then
  echo "▸ 创建 Python venv 并安装依赖…"
  rm -rf backtest/.venv
  "$PY" -m venv backtest/.venv
  backtest/.venv/bin/pip install -q --upgrade pip
  backtest/.venv/bin/pip install -q -r backtest/requirements.txt
fi
PY_BIN="$ROOT/backtest/.venv/bin"

# ---- web 依赖 + env（首次自动准备）----
if [ ! -d web/node_modules ]; then
  echo "▸ 安装 web 依赖…"
  (cd web && npm install --no-audit --no-fund)
fi
[ -f web/.env.local ] || cp web/.env.example web/.env.local

cleanup() { echo; echo "▸ 停止全部服务…"; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

echo "▸ 启动 backtest 服务 :8000（日志 $LOG_DIR/backtest.log）"
(cd backtest && "$PY_BIN/uvicorn" app.main:app --port 8000 >"$LOG_DIR/backtest.log" 2>&1) &
echo "▸ 启动 pm-agent 服务 :8001（日志 $LOG_DIR/pmagent.log）"
(cd pm-agent && "$PY_BIN/uvicorn" pmagent.api:app --port 8001 >"$LOG_DIR/pmagent.log" 2>&1) &

# ---- 等两个后端就绪；失败时直接把日志打出来 ----
for port in 8000 8001; do
  ok=""
  for _ in $(seq 1 40); do
    if curl -sf "http://127.0.0.1:$port/health" >/dev/null 2>&1; then ok=1; break; fi
    sleep 0.5
  done
  if [ -n "$ok" ]; then
    echo "  ✓ :$port 就绪"
  else
    name=$([ "$port" = 8000 ] && echo backtest || echo pmagent)
    echo "  ✗ :$port 启动失败，最近日志："
    echo "  ----------------------------------------"
    tail -20 "$LOG_DIR/$name.log" | sed 's/^/  /'
    echo "  ----------------------------------------"
    exit 1
  fi
done

echo "▸ 启动 web :3000  →  打开 http://localhost:3000"
cd web && npm run dev
