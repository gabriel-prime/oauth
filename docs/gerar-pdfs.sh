#!/bin/sh
# Converte os modelos de texto de docs/ em PDF dentro de public/entrega1/
# usando apenas o cupsfilter do macOS (sem Node, npm ou Wrangler).
set -e
cd "$(dirname "$0")/.."
for n in 01-pages-configuracao 05-inicio-login-google 06-inicio-login-github; do
  cupsfilter -i text/plain -m application/pdf "docs/$n.txt" > "public/entrega1/$n.pdf" 2>/dev/null
  echo "gerado public/entrega1/$n.pdf"
done
