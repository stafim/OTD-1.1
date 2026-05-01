#!/usr/bin/env bash
# OTD Logistics — aplica migrations do Drizzle e sobe a aplicação.
# Uso:
#   ./start.sh           -> NODE_ENV=production (build + start)
#   ./start.sh dev       -> NODE_ENV=development (tsx)
#   SKIP_MIGRATIONS=1 ./start.sh   -> pula a etapa de migrations

set -euo pipefail

cd "$(dirname "$0")"

MODE="${1:-prod}"

echo "==> OTD Logistics :: inicialização"
echo "    Modo: ${MODE}"
echo

if [ ! -f ".env" ] && [ -z "${DATABASE_URL:-}" ]; then
  echo "!! DATABASE_URL não definida e .env ausente." >&2
  echo "   Defina DATABASE_URL no ambiente antes de continuar." >&2
  exit 1
fi

if [ -f ".env" ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ ! -d "node_modules" ]; then
  echo "==> Instalando dependências (npm ci)..."
  npm ci
fi

if [ "${SKIP_MIGRATIONS:-0}" != "1" ]; then
  echo "==> Aplicando migrations (drizzle-kit push --force)..."
  npx drizzle-kit push --force
else
  echo "==> SKIP_MIGRATIONS=1 -> pulando migrations."
fi

echo
case "${MODE}" in
  dev|development)
    echo "==> Subindo aplicação em modo desenvolvimento..."
    exec npm run dev
    ;;
  prod|production|*)
    if [ ! -f "dist/index.cjs" ]; then
      echo "==> Build de produção (npm run build)..."
      npm run build
    fi
    echo "==> Subindo aplicação em modo produção..."
    exec npm start
    ;;
esac
