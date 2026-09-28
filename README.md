# oauth-pages-lab

Login com Google e GitHub em um site estático, com sessões opacas revogáveis.
Página e rotas dinâmicas vivem na mesma origem de um projeto Cloudflare Pages.

**Produção:** https://oauth-gabriel-fortunato.pages.dev

Só JavaScript e APIs Web do ambiente da Cloudflare — sem Node.js, npm, Wrangler
ou qualquer dependência externa.

## Estrutura

```
public/       conteúdo público (Build output directory)
  index.html  página de login
  app.js      consulta /api/me e mostra a sessão
  entrega1/   evidências da avaliação
functions/    Pages Functions (irmã de public, nunca dentro dela)
  _shared/    crypto, cookies, providers, oidc, session, http
  api/        health.js, me.js
  oauth/      login/[provider].js, callback/[provider].js, logout.js
docs/         esquema SQL, fontes das evidências em PDF e scripts
```

## Rotas

| Método | Caminho | O que faz |
|---|---|---|
| GET | `/api/health` | sinal de vida |
| GET | `/api/me` | perfil mínimo da sessão, ou 401 |
| GET | `/oauth/login/{google\|github}` | cria a transação e redireciona ao provedor |
| GET | `/oauth/callback/{google\|github}` | valida a identidade e cria a sessão |
| POST | `/oauth/logout` | revoga a sessão local |

Qualquer provedor diferente de `google` ou `github` responde 404.

## Como funciona

O navegador nunca recebe `access_token`, `refresh_token` nem Client Secret —
só um identificador aleatório de sessão.

1. **Início** — 32 bytes aleatórios viram id da transação, `state`, `nonce` e
   `code_verifier`. O D1 guarda os resumos SHA-256; o cookie `__Host-oauth-tx`
   dura 10 minutos.
2. **Retorno** — a Function exige o cookie, confere o resumo do `state` e
   **apaga a transação antes de continuar**. Só então troca o código, usando o
   `code_verifier` e o Client Secret.
3. **Identidade** — o `id_token` do Google é validado no servidor: JWT em três
   partes, `RS256`, JWKS obtido pelo documento de descoberta e assinatura
   verificada com `crypto.subtle`. No GitHub, o `access_token` serve para uma
   única chamada a `GET /user` e a autorização é revogada em seguida, exigindo
   204 antes de a sessão existir.
4. **Sessão** — cookie `__Host-session` opaco, `HttpOnly`, `SameSite=Strict`,
   8 horas. O D1 guarda o resumo do cookie, nunca seu valor.

O logout exige `POST` e `Origin` igual a `PUBLIC_BASE_URL`, remove a linha do
banco e expira o cookie. Toda resposta dinâmica usa `Cache-Control: no-store`.

## Configuração no painel do Pages

Build output directory `public`, sem build command. Binding D1 chamado `DB`.

| Variável | Tipo |
|---|---|
| `PUBLIC_BASE_URL` | texto, sem barra final |
| `GOOGLE_CLIENT_ID` · `GITHUB_CLIENT_ID` | texto |
| `GOOGLE_CLIENT_SECRET` · `GITHUB_CLIENT_SECRET` | **secret** |

URLs de retorno cadastradas nos provedores: `{URL}/oauth/callback/google` e
`{URL}/oauth/callback/github`, exatas e sem barra final.

Esquema do banco em `docs/schema.sql`.

## Verificar

```sh
curl -i https://oauth-gabriel-fortunato.pages.dev/api/health
curl -i https://oauth-gabriel-fortunato.pages.dev/oauth/login/google
```

O primeiro responde 200. O segundo responde 302 com `__Host-oauth-tx` e um
`Location` contendo `code_challenge_method=S256`, sem Client Secret nem
`code_verifier`.

## Evidências

`public/entrega1/` — configuração, URLs de retorno, esquema do D1, cabeçalhos
saneados dos dois logins, os seis testes de falha e a lista de aceitação.

Os arquivos de `public/` são públicos por definição: o Pages os entrega antes de
qualquer código rodar. A sessão protege apenas as rotas dinâmicas. Por isso as
evidências estão saneadas, com todo valor sensível substituído por `[REMOVIDO]`.

## Nota

`X-GitHub-Api-Version` está no topo de `functions/oauth/callback/[provider].js`.
Se a consulta ao perfil passar a falhar, é a primeira linha a conferir.
