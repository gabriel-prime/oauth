# oauth-pages-lab

Login com Google e GitHub em um site estático no Cloudflare Pages, com Pages
Functions e sessões opacas em um banco D1. Sem Node.js, npm, npx ou Wrangler:
o GitHub entrega o código ao Pages e todo o resto é feito no painel.

```
oauth-pages-lab/
├── public/                  conteúdo público (Build output directory)
│   ├── index.html           página de login (index)
│   ├── app.js               consulta /api/me e mostra a sessão
│   ├── styles.css
│   └── entrega1/            evidências (avaliadas automaticamente)
├── functions/               Pages Functions (irmã de public, nunca dentro dela)
│   ├── _shared/             crypto, cookies, providers, oidc, session, http
│   ├── api/health.js        GET /api/health
│   ├── api/me.js            GET /api/me
│   └── oauth/
│       ├── login/[provider].js     GET /oauth/login/{google|github}
│       ├── callback/[provider].js  GET /oauth/callback/{google|github}
│       └── logout.js               POST /oauth/logout
└── docs/                    esquema SQL, modelos de evidência e scripts
```

Se a professora pedir o dashboard da disciplina dentro de `public/`, copie os
arquivos dele para lá; o `index.html` continua sendo a página de login.

## O que já está pronto

- Todas as Functions do roteiro, apenas com JavaScript e APIs Web (Web Crypto,
  `fetch`, D1 via `context.env.DB`).
- Cookies `__Host-oauth-tx` (Lax, 10 min) e `__Host-session` (Strict, 8 h).
- O D1 guarda só os resumos SHA-256 do cookie de transação, do `state` e do
  cookie de sessão. A transação é apagada antes da troca do código.
- Google: validação do `id_token` (JWT em 3 partes, RS256, JWKS do documento
  de descoberta, assinatura RSASSA-PKCS1-v1_5, `iss`, `aud`, `exp`, `iat`,
  `nonce`).
- GitHub: `access_token` usado apenas em `GET /user`, depois
  `DELETE /applications/{client_id}/grant` (exige 204) antes de criar a sessão.
- `/oauth/logout` só aceita `POST` com `Origin` igual a `PUBLIC_BASE_URL`.
- Toda resposta dinâmica usa `Cache-Control: no-store`.

## O que você precisa fazer no navegador

### 0. Repositório

1. Crie um repositório no GitHub (`main` como padrão) e dê acesso à dupla.
2. Envie este conteúdo. Sem `gh`, use o git normal:
   ```sh
   cd ~/Projects/college/oauth-pages-lab
   git remote add origin git@github.com:SEU-USUARIO/NOME-DO-PROJETO.git
   git push -u origin main
   ```

### 1. Cloudflare Pages

Workers & Pages → Create application → Pages → Connect to Git → selecione o
repositório → ramificação de produção `main`.

| Campo                  | Valor  |
|------------------------|--------|
| Framework preset       | None   |
| Build command          | vazio  |
| Build output directory | public |
| Root directory         | vazio  |

Save and Deploy. Copie a URL `https://NOME-DO-PROJETO.pages.dev` (sem barra
final): é a `URL_BASE`. Confira `URL_BASE/api/health` → `{"status":"ok"}`.

### 2. Banco D1

Storage & Databases → D1 SQL Database → Create database →
`oauth-sessions-EQUIPE` → Console → cole e execute `docs/schema.sql`.

Depois: Workers & Pages → projeto → Settings → Bindings → Add → D1 database →
Variable name `DB` → banco `oauth-sessions-EQUIPE` (produção e prévia).
Faça um novo deploy (Deployments → Retry/Redeploy).

### 3. Google

Google Cloud Console (janela privativa) → projeto → tela de consentimento
(app em teste, contas da dupla como usuárias de teste) → Credentials →
Create OAuth client ID → **Web application** → Authorized redirect URI:

```
URL_BASE/oauth/callback/google
```

Escopos: apenas `openid email profile`. Guarde Client ID e Client Secret
para a etapa 5.

### 4. GitHub OAuth App

GitHub → Settings → Developer settings → OAuth apps → New OAuth App:

- Application name: nome da equipe
- Homepage URL: `URL_BASE`
- Authorization callback URL: `URL_BASE/oauth/callback/github`
- Device Flow: desativado

Register → Generate a new client secret.

### 5. Variáveis e segredos no Pages

Settings → Variables and Secrets → Add:

| Nome                   | Tipo          | Valor                      |
|------------------------|---------------|----------------------------|
| `PUBLIC_BASE_URL`      | texto         | `URL_BASE` sem barra final |
| `GOOGLE_CLIENT_ID`     | texto         | Client ID do Google        |
| `GITHUB_CLIENT_ID`     | texto         | Client ID do GitHub        |
| `GOOGLE_CLIENT_SECRET` | **Encrypt**   | Client Secret do Google    |
| `GITHUB_CLIENT_SECRET` | **Encrypt**   | Client Secret do GitHub    |

Configure para produção e faça um novo deploy.

### 6. Testes

Abra `URL_BASE`, entre com Google, confira `/api/me`, saia, repita com
GitHub. Depois execute os seis casos de falha da seção 16 do roteiro e
preencha o campo **Resultado observado** em
`public/entrega1/07-testes-falha.md`.

## Evidências (`public/entrega1/`)

A pasta precisa conter exatamente estes 8 arquivos:

| Arquivo                     | Origem                                              |
|-----------------------------|-----------------------------------------------------|
| `01-pages-configuracao.pdf` | gerado de `docs/01-pages-configuracao.txt`          |
| `02-google-retorno.txt`     | URL de retorno do Google                            |
| `03-github-retorno.txt`     | Homepage + URL de retorno do GitHub                 |
| `04-d1-esquema.txt`         | resultado da consulta em `sqlite_schema`            |
| `05-inicio-login-google.pdf`| gerado de `docs/05-inicio-login-google.txt`         |
| `06-inicio-login-github.pdf`| gerado de `docs/06-inicio-login-github.txt`         |
| `07-testes-falha.md`        | casos de falha com resultado observado              |
| `08-aceitacao.md`           | lista de aceitação assinada                         |

Fluxo sugerido:

1. Quando souber o nome do projeto no Pages, rode
   `sh docs/definir-url.sh NOME-DO-PROJETO` — troca o placeholder em todos os
   arquivos e regenera os PDFs (usa só o `cupsfilter` do macOS).
2. Ajuste `docs/01-pages-configuracao.txt` (nome do repositório) e os
   cabeçalhos em `docs/05-*.txt` / `docs/06-*.txt` com o que aparecer no
   painel Network, mantendo `[REMOVIDO]` em cookie, `state`, `code_challenge`,
   `nonce` e Client ID. Rode `sh docs/gerar-pdfs.sh` de novo.
3. Confirme o conteúdo de `04-d1-esquema.txt` com o que o console D1 mostrou.
4. Preencha `07-testes-falha.md` e marque/assine `08-aceitacao.md`.
5. Faça commit e push. A avaliação automática lê `public/entrega1/`.

Nunca coloque Client Secret, cookies, tokens, `state`, `nonce` ou
`code_challenge` reais nas evidências nem no repositório.

## Diagnóstico rápido

| Sintoma                    | Conferir                                              |
|----------------------------|-------------------------------------------------------|
| `redirect_uri_mismatch`    | URL de retorno exata no provedor, sem barra final     |
| `invalid_client`           | Client ID/Secret no Pages, novo deploy                |
| `{"error":"misconfigured"}`| variável faltando (`PUBLIC_BASE_URL`, IDs, `DB`)      |
| `/api/health` 404          | pasta `functions` na raiz; deploy mais recente        |
| `DB` indefinido            | binding chamado exatamente `DB`; novo deploy          |
| `github_user_failed` 401   | GitHub rejeitou `X-GitHub-Api-Version` — ajuste a     |
|                            | constante em `functions/oauth/callback/[provider].js` |
