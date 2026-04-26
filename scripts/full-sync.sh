#!/usr/bin/env bash
#
# full-sync.sh — waga-scope 全同期ワンショットスクリプト
#
# やること:
#   1. ポート $PORT 空けてバックエンドを起動（ログは backend/.cache/backend.log）
#   2. /api/admin/status で起動待ち
#   3. /api/admin/sync を叩く（バックグラウンド）
#   4. 30秒おきに status をポーリングして進捗を表示
#   5. 完了したら結果を出して、オプションで静的JSON生成
#   6. 終了時に必ずバックエンドを kill
#
# 使い方:
#   bash scripts/full-sync.sh                       # デフォルト (jquants, 全銘柄)
#   MVP_STOCK_LIMIT=50 bash scripts/full-sync.sh    # 50銘柄だけ
#   DATA_PROVIDER=csv bash scripts/full-sync.sh     # CSV で動作確認
#   SKIP_STATIC=1 bash scripts/full-sync.sh         # 静的JSON生成をスキップ
#
# 中断:
#   Ctrl+C でバックエンドごと安全に停止（prefetch 後なら途中まで DB に入ってる）
#
set -euo pipefail

# リポジトリルートへ
cd "$(dirname "$0")/.."

PORT="${PORT:-8902}"
DATA_PROVIDER="${DATA_PROVIDER:-jquants}"
DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"
MVP_STOCK_LIMIT="${MVP_STOCK_LIMIT:-0}"
SKIP_STATIC="${SKIP_STATIC:-0}"
POLL_INTERVAL="${POLL_INTERVAL:-30}"

LOG_DIR="backend/.cache"
mkdir -p "$LOG_DIR"
BACKEND_LOG="$LOG_DIR/backend.log"
SYNC_LOG="$LOG_DIR/sync.log"

log() { echo "[full-sync] $*"; }

# ---- 既存バックエンド停止 ----
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  log "port $PORT is busy, killing existing process..."
  lsof -ti:"$PORT" | xargs kill -9 2>/dev/null || true
  sleep 2
fi

# ---- バックエンド起動 ----
log "starting backend (provider=$DATA_PROVIDER, limit=$MVP_STOCK_LIMIT, log=$BACKEND_LOG)..."
: > "$BACKEND_LOG"
PORT="$PORT" \
DATA_PROVIDER="$DATA_PROVIDER" \
DATABASE_URL="$DATABASE_URL" \
MVP_STOCK_LIMIT="$MVP_STOCK_LIMIT" \
  pnpm -C backend dev >>"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

cleanup() {
  local code=$?
  echo ""
  log "cleaning up..."
  if kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    sleep 1
  fi
  lsof -ti:"$PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
  exit "$code"
}
trap cleanup EXIT INT TERM

# ---- バックエンド起動待ち ----
log "waiting for backend on http://localhost:$PORT ..."
ready=0
for i in $(seq 1 60); do
  if curl -sSf "http://localhost:$PORT/api/admin/status" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [ "$ready" -ne 1 ]; then
  log "backend failed to start within 120s. tail of $BACKEND_LOG:"
  tail -n 80 "$BACKEND_LOG" || true
  exit 1
fi
log "backend ready."

# ---- 同期トリガ（非同期） ----
log "triggering POST /api/admin/sync ..."
: > "$SYNC_LOG"
(
  curl -sS --max-time 10800 -X POST "http://localhost:$PORT/api/admin/sync" \
    -H 'Content-Type: application/json' >>"$SYNC_LOG" 2>&1
) &
SYNC_PID=$!

# ---- 進捗ポーリング ----
log "polling status every ${POLL_INTERVAL}s (Ctrl+C to abort)..."
started=$(date +%s)

# JSON から数値を抜き出す node ヘルパ
extract() {
  # $1 = JSON文字列, $2 = path (例: "counts.stocks")
  node -e "
    let s='';
    process.stdin.on('data', d => s += d);
    process.stdin.on('end', () => {
      try {
        const o = JSON.parse(s);
        const v = '$2'.split('.').reduce((a,k)=>a?.[k], o);
        console.log(v ?? '-');
      } catch { console.log('-'); }
    });
  " <<< "$1"
}

while kill -0 "$SYNC_PID" 2>/dev/null; do
  status=$(curl -sS "http://localhost:$PORT/api/admin/status" 2>/dev/null || echo '{}')
  stocks=$(extract "$status" "counts.stocks")
  snaps=$(extract "$status" "counts.snapshots")
  in_prog=$(extract "$status" "syncInProgress")
  elapsed=$(( $(date +%s) - started ))
  printf "\r[full-sync] elapsed=%dm%02ds stocks=%s snapshots=%s syncInProgress=%s   " \
    $(( elapsed / 60 )) $(( elapsed % 60 )) "$stocks" "$snaps" "$in_prog"
  sleep "$POLL_INTERVAL"
done
echo ""

# ---- 結果確認 ----
log "sync curl exited. response:"
cat "$SYNC_LOG" || true
echo ""

final=$(curl -sS "http://localhost:$PORT/api/admin/status" 2>/dev/null || echo '{}')
log "final status: $final"

last_status=$(extract "$final" "lastLog.status")
if [ "$last_status" != "success" ]; then
  log "sync did NOT complete successfully (status=$last_status). aborting static JSON step."
  log "tail of $BACKEND_LOG:"
  tail -n 40 "$BACKEND_LOG" || true
  exit 1
fi

# ---- 静的JSON生成（任意） ----
if [ "$SKIP_STATIC" = "1" ]; then
  log "SKIP_STATIC=1 — skipping static JSON generation."
else
  log "generating static JSON (DATA_PROVIDER=csv)..."
  DATA_PROVIDER=csv pnpm exec tsx scripts/collect-static.ts
fi

log "done."
