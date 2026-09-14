#!/bin/sh
# Substitui o placeholder NOME-DO-PROJETO pela URL real atribuída pelo Pages.
# Uso: sh docs/definir-url.sh oauth-aula-gabriel
set -e
[ -n "$1" ] || { echo "uso: sh docs/definir-url.sh NOME-DO-PROJETO"; exit 1; }
cd "$(dirname "$0")/.."
grep -rl 'NOME-DO-PROJETO' public/entrega1 docs README.md | while read -r f; do
  sed -i '' "s/NOME-DO-PROJETO/$1/g" "$f"
  echo "atualizado $f"
done
sh docs/gerar-pdfs.sh
