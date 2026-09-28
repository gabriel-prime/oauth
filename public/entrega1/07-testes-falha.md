# 07 – Testes de falha

Projeto: `https://oauth-gabriel-fortunato.pages.dev`
Todos os testes foram executados na implantação de produção. Valores transitórios
(cookies, `state`, `code`, `nonce`, `code_challenge`, tokens) foram substituídos por
`[REMOVIDO]` ou omitidos.

## Caso 1: retorno sem cookie temporário

- **Preparação:** login iniciado na janela normal em `/oauth/login/google`, parado na tela
  "Escolha uma conta" do Google. Em vez de levar a URL de autorização para uma janela
  privativa, o cookie `__Host-oauth-tx` foi apagado pelo DevTools
  (Application > Storage > Cookies > https://oauth-gabriel-fortunato.pages.dev) antes de
  concluir o login. A condição testada é a mesma do roteiro: o retorno chega com `code` e
  `state` válidos e sem o cookie temporário. A variante foi necessária porque, assim que o
  Google redireciona para a tela de escolha de conta, a URL da barra de endereço deixa de
  ser a URL de autorização e não pode ser reaproveitada em outra janela.
- **Pedido enviado:** `GET /oauth/callback/google?code=[REMOVIDO]&state=[REMOVIDO]`
  sem o cabeçalho `Cookie`.
- **Resultado esperado:** a rota recusa a resposta (HTTP 400, `{"error":"missing_transaction"}`),
  nenhuma sessão é criada e `/api/me` continua respondendo 401.
- **Resultado observado:** HTTP 400 com o corpo `{"error":"missing_transaction"}`. Nenhum
  cookie `__Host-session` foi criado e a lista de cookies do domínio permaneceu vazia. A
  troca do código nem chegou a ser tentada: a Function para no passo 2 da seção 13.4.

## Caso 2: state alterado

- **Preparação:** login iniciado em `/oauth/login/google`, parado na tela do Google. Com a
  transação já gravada no D1 e o cookie `__Host-oauth-tx` presente no navegador, o retorno
  foi montado manualmente com um `state` que não corresponde ao da transação. O roteiro
  sugere alterar um caractere do `state` na barra de endereço; como a URL exibida pelo
  Google deixa de ser a URL de autorização assim que ele redireciona para a escolha de
  conta, o `state` foi substituído por outro valor. A verificação é equivalente: a
  comparação é feita entre resumos SHA-256, e um caractere diferente ou um valor inteiro
  diferente produzem resumos igualmente incompatíveis.
- **Pedido enviado:** `GET /oauth/callback/google?code=[REMOVIDO]&state=[ALTERADO]`
  com o cookie `__Host-oauth-tx` válido.
- **Resultado esperado:** HTTP 400, `{"error":"invalid_state"}`, antes de qualquer troca
  do código. A transação é apagada e nenhuma sessão é criada.
- **Resultado observado:** HTTP 400 com o corpo `{"error":"invalid_state"}`. O `code`
  enviado era inventado e nunca chegou a ser apresentado ao ponto de terminação de tokens
  do Google: a Function para no passo 4 da seção 13.4, na comparação do resumo do `state`.
  A transação foi removida do D1 no mesmo passo, de modo que nem uma segunda tentativa com
  o `state` correto funcionaria.

## Caso 3: reutilização da transação

- **Preparação:** login com Google concluído com sucesso, criando a sessão. No painel
  Network do navegador, com Preserve log ativado, a requisição de retorno
  (`/oauth/callback/google`, status 302) foi localizada e sua URL copiada com Copy URL.
- **Pedido enviado:** a mesma URL de retorno aberta novamente em outra aba
  (`GET /oauth/callback/google?state=[REMOVIDO]&code=[REMOVIDO]&...`), com o mesmo
  navegador e a mesma sessão.
- **Resultado esperado:** a repetição falha. A transação já foi removida do D1 antes da
  conclusão do primeiro retorno.
- **Resultado observado:** HTTP 400 com o corpo `{"error":"missing_transaction"}`. A recusa
  veio do passo 2 da seção 13.4, e não do passo 3: o retorno bem-sucedido expira o cookie
  `__Host-oauth-tx` junto com a criação da sessão, então na repetição o cookie não é mais
  enviado e a Function recusa antes mesmo de consultar o banco. Existem portanto duas
  barreiras independentes contra a repetição: o cookie temporário expirado e a linha da
  transação apagada. A sessão criada no primeiro retorno permaneceu válida e intacta.

## Caso 4: sessão expirada

- **Preparação:** nova sessão do Google criada e confirmada na página (`/api/me` respondendo
  200 com o perfil). No console D1 do banco `oauth-sessions-gabriel` foi executado:
  ```sql
  UPDATE sessions SET expires_at = 0;
  ```
- **Pedido enviado:** recarga da página inicial, que consulta `GET /api/me` com o cookie
  `__Host-session` ainda presente e inalterado no navegador.
- **Resultado esperado:** HTTP 401 e a página exibindo "Nenhuma sessão neste navegador."
- **Resultado observado:** HTTP **401**, corpo `{"error":"unauthenticated"}`. A página voltou
  a exibir "Nenhuma sessão neste navegador." e os botões de login. Nada mudou no navegador:
  o cookie continuava lá, com o mesmo valor, e a linha da sessão continuava no D1. O que
  mudou foi apenas o campo `expires_at`, e a consulta de `/api/me` exige `expires_at > agora`.
  A validade é decidida no servidor a cada requisição, e não por qualquer informação que o
  navegador carregue ou possa alterar.

## Caso 5: origem inválida na saída

- **Preparação:** sessão do Google válida aberta em `https://oauth-gabriel-fortunato.pages.dev`.
  Em outra aba, na origem `https://example.com`, o console do navegador foi usado para
  disparar a saída a partir de um site de terceiros.
- **Pedido enviado:**
  ```js
  fetch("https://oauth-gabriel-fortunato.pages.dev/oauth/logout", {
    method: "POST",
    credentials: "include"
  });
  ```
  resultando em `POST /oauth/logout` com `Origin: https://example.com`.
- **Resultado esperado:** a rota recusa a operação e a sessão original continua válida.
- **Resultado observado:** HTTP **403 Forbidden**, corpo `{"error":"invalid_origin"}`,
  com `Cache-Control: no-store` e `Content-Type: application/json; charset=utf-8`.
  Ao voltar para a aba de `https://oauth-gabriel-fortunato.pages.dev` e recarregar, a
  sessão permaneceu válida e `/api/me` continuou respondendo 200 com o perfil.

  Duas camadas independentes recusaram a operação. A primeira é a da aplicação: a Function
  comparou o cabeçalho `Origin` com `PUBLIC_BASE_URL`, não houve correspondência e ela
  respondeu 403 sem tocar no D1. A segunda é a do navegador: como a resposta 403 não traz
  cabeçalhos de CORS, o JavaScript de `example.com` não conseguiu nem ler o que voltou, e
  o cookie `__Host-session` (SameSite=Strict) também não seria enviado numa requisição de
  outra origem. O teste comprova a conferência de origem feita pela aplicação, que é a
  única que não depende do comportamento do navegador.

## Caso 6: reutilização do cookie revogado

- **Preparação:** sessão do Google válida. O valor do cookie `__Host-session` foi copiado
  temporariamente pelo DevTools (Application > Storage > Cookies). Em seguida o logout foi
  executado pelo botão Sair da página, e o mesmo valor foi recolocado no navegador pelo
  console:
  ```js
  document.cookie = "__Host-session=[REMOVIDO]; Path=/; Secure; SameSite=Strict";
  ```
  A cópia do valor foi descartada imediatamente após o teste e não consta desta evidência.
- **Pedido enviado:** `GET /api/me` com `Cookie: __Host-session=[REMOVIDO]` — o mesmo valor
  que minutos antes devolvia 200 com o perfil.
- **Resultado esperado:** HTTP 401, porque a linha da sessão foi removida do D1 e o resumo
  do cookie não corresponde a nenhuma sessão.
- **Resultado observado:** HTTP **401**, corpo `{"error":"unauthenticated"}`. O cookie é
  opaco: seu valor não carrega nenhuma informação de identidade, serve apenas como chave de
  busca. O D1 guarda o resumo SHA-256 desse valor, e a linha correspondente foi apagada pelo
  `DELETE` do logout. Restaurar o cookie no navegador, portanto, não restaura a sessão —
  a autoridade é o banco, não o navegador.

---

## Verificação complementar: transação expirada

O critério de aceitação exige que o retorno recuse uma transação "ausente, expirada,
alterada ou reutilizada". Os Casos 1, 2 e 3 cobrem ausente, alterada e reutilizada. A
condição "expirada" foi verificada separadamente.

- **Preparação:** login iniciado em `/oauth/login/google`, parado na tela do Google, com a
  transação já gravada e o cookie `__Host-oauth-tx` presente. No console D1 foi executado:
  ```sql
  UPDATE oauth_transactions SET expires_at = 0;
  ```
  A linha não foi apagada, apenas envelhecida.
- **Pedido enviado:** o login foi então concluído normalmente, produzindo
  `GET /oauth/callback/google?state=[REMOVIDO]&code=[REMOVIDO]&...` com o cookie correto.
- **Resultado esperado:** recusa por transação expirada, sem troca do código.
- **Resultado observado:** HTTP 400, corpo `{"error":"invalid_transaction"}`. Diferente do
  Caso 1, aqui o cookie estava presente e correto e a linha existia no banco; a consulta do
  passo 3 da seção 13.4 exige `expires_at > agora` e não encontrou a transação. O cookie
  temporário tem `Max-Age=600`, de modo que uma transação abandonada deixa de valer dez
  minutos depois de criada.

## Resumo dos códigos de recusa observados

| Condição testada | Código devolvido | HTTP |
|---|---|---|
| cookie de transação ausente (Caso 1) | `missing_transaction` | 400 |
| `state` incompatível (Caso 2) | `invalid_state` | 400 |
| retorno repetido (Caso 3) | `missing_transaction` | 400 |
| transação expirada (complementar) | `invalid_transaction` | 400 |
| sessão vencida (Caso 4) | `unauthenticated` | 401 |
| origem inválida na saída (Caso 5) | `invalid_origin` | 403 |
| cookie de sessão revogado (Caso 6) | `unauthenticated` | 401 |

Nenhuma das respostas de erro revelou detalhes internos, valores de transação, tokens ou
segredos, e todas usaram `Cache-Control: no-store`.
