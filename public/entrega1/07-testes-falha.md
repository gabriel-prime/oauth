# 07 – Testes de falha

Projeto: `https://oauth-gabriel-fortunato.pages.dev`
Todos os testes foram executados na implantação de produção. Valores transitórios
(cookies, `state`, `code`, `nonce`, `code_challenge`, tokens) foram substituídos por
`[REMOVIDO]` ou omitidos.

## Caso 1: retorno sem cookie temporário

- **Preparação:** login iniciado em uma janela comum em `/oauth/login/google`, parado na
  tela do Google. A URL de autorização foi copiada para uma janela privativa, que não possui
  o cookie `__Host-oauth-tx`. O login foi concluído nessa segunda janela.
- **Pedido enviado:** `GET /oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]`
  sem o cabeçalho `Cookie`.
- **Resultado esperado:** a rota recusa a resposta (HTTP 400, `{"error":"missing_transaction"}`),
  nenhuma sessão é criada e `/api/me` continua respondendo 401.
- **Resultado observado:** [PREENCHER após executar]

## Caso 2: state alterado

- **Preparação:** novo login iniciado, parado na página do provedor antes das credenciais.
  Um único caractere do parâmetro `state` foi alterado na barra de endereço e o fluxo
  prosseguiu.
- **Pedido enviado:** `GET /oauth/callback/{provider}?code=[REMOVIDO]&state=[ALTERADO]`
  com o cookie `__Host-oauth-tx` válido.
- **Resultado esperado:** HTTP 400, `{"error":"invalid_state"}`, antes de qualquer troca
  do código. A transação é apagada e nenhuma sessão é criada.
- **Resultado observado:** [PREENCHER após executar]

## Caso 3: reutilização da transação

- **Preparação:** login concluído com sucesso. No painel Network, a requisição de retorno
  foi localizada e sua URL copiada (Copy URL).
- **Pedido enviado:** a mesma URL de retorno aberta novamente
  (`GET /oauth/callback/{provider}?code=[REMOVIDO]&state=[REMOVIDO]`).
- **Resultado esperado:** HTTP 400, `{"error":"invalid_transaction"}`. A transação já foi
  removida do D1 no primeiro uso e o cookie temporário já foi limpo.
- **Resultado observado:** [PREENCHER após executar]

## Caso 4: sessão expirada

- **Preparação:** sessão criada. No console D1 foi executado
  `UPDATE sessions SET expires_at = 0;`
- **Pedido enviado:** recarga da página inicial, que consulta `GET /api/me` com o cookie
  `__Host-session` ainda presente no navegador.
- **Resultado esperado:** HTTP 401, `{"error":"unauthenticated"}`; a página mostra
  "Nenhuma sessão neste navegador."
- **Resultado observado:** [PREENCHER após executar]

## Caso 5: origem inválida na saída

- **Preparação:** sessão válida aberta em `https://oauth-gabriel-fortunato.pages.dev`. Em outra aba, na origem
  `https://example.com`, foi executado no console:
  ```js
  fetch("https://oauth-gabriel-fortunato.pages.dev/oauth/logout", { method: "POST", credentials: "include" });
  ```
- **Pedido enviado:** `POST /oauth/logout` com `Origin: https://example.com`.
- **Resultado esperado:** a rota recusa (HTTP 403, `{"error":"invalid_origin"}`) e, ao
  voltar para a aba de `https://oauth-gabriel-fortunato.pages.dev`, a sessão original continua válida
  (`/api/me` responde 200).
- **Resultado observado:** [PREENCHER após executar]

## Caso 6: reutilização do cookie revogado

- **Preparação:** o valor do cookie `__Host-session` foi copiado temporariamente pelas
  ferramentas de desenvolvimento. O logout foi executado e o mesmo valor foi restaurado
  no navegador. A cópia foi apagada em seguida e não consta nesta evidência.
- **Pedido enviado:** `GET /api/me` com `Cookie: __Host-session=[REMOVIDO]`.
- **Resultado esperado:** HTTP 401, `{"error":"unauthenticated"}`, porque a linha da sessão
  foi removida do D1 e o resumo do cookie não corresponde a nenhuma sessão.
- **Resultado observado:** [PREENCHER após executar]
