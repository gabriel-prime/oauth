# 08 – Critérios de aceitação

**Projeto:** `https://oauth-gabriel-fortunato.pages.dev`
**Repositório:** `github.com/gabriel-prime/oauth` (ramificação `main`)
**Banco D1:** `oauth-sessions-gabriel` (binding `DB`, produção)
**Aluno:** Gabriel Fortunato
**Data:** 28/09/2026

O trabalho foi realizado individualmente, conforme a seção 1 do roteiro: "O trabalho é
individual, trabalhamos em dupla para facilitar a aprendizagem."

---

- [x] o site é servido pelo endereço `pages.dev` atribuído à equipe;
- [x] os arquivos estáticos e as Functions compartilham a mesma origem;
- [x] o projeto foi publicado por integração com GitHub;
- [x] a equipe não instalou nem executou Node.js, `npm`, `npx` ou Wrangler;
- [x] cada provedor usa uma URL de retorno própria e exata;
- [x] os pedidos de autorização usam código e PKCE `S256`;
- [x] a Function apresenta o Client Secret correto somente na troca de tokens;
- [x] o retorno recusa uma transação ausente, expirada, alterada ou reutilizada;
- [x] o `id_token` do Google só produz uma sessão depois da validação criptográfica e semântica;
- [x] o `access_token` do GitHub é usado somente para consultar `/user` e a autorização é revogada antes da criação da sessão;
- [x] o cookie de sessão é opaco, `Secure`, `HttpOnly`, `SameSite=Strict` e não possui `Domain`;
- [x] o D1 guarda o resumo do cookie, não seu valor bruto;
- [x] `/api/me` devolve somente o perfil necessário;
- [x] o logout confere `Origin`, remove a sessão e expira o cookie;
- [x] um cookie revogado não restaura a sessão;
- [x] tokens e segredos não aparecem no HTML, nas URLs salvas, no armazenamento Web ou nos registros;
- [x] o aluno consegue explicar por que os arquivos estáticos permanecem públicos;
- [x] as sessões administrativas foram encerradas no computador compartilhado.

> Encerramento realizado conforme a seção 19: a janela privativa com a sessão do Google
> Cloud foi fechada, a sessão local do laboratório foi encerrada pelo `/oauth/logout` e
> foi confirmado no painel do Pages que `GOOGLE_CLIENT_SECRET` e `GITHUB_CLIENT_SECRET`
> continuam marcados como criptografados. O projeto Pages, o banco D1, o cliente Web do
> Google e a OAuth App do GitHub foram mantidos, conforme a instrução de não apagar os
> recursos antes da autorização da professora.

---

## Como cada item foi verificado

| Item | Verificação |
|---|---|
| endereço `pages.dev` | `https://oauth-gabriel-fortunato.pages.dev` responde 200 por HTTPS |
| mesma origem | estáticos e `/api/*`, `/oauth/*` no mesmo projeto Pages, sem CORS |
| integração GitHub | projeto criado por Connect to Git; cada commit em `main` implanta |
| sem Node/npm/npx/Wrangler | log do deploy: "No build command specified", "No Wrangler configuration file found"; nenhuma dependência no repositório |
| URLs de retorno | `02-google-retorno.txt` e `03-github-retorno.txt`; uma única URI por provedor, sem barra final e sem curinga |
| código + PKCE S256 | `05` e `06`: `response_type=code` e `code_challenge_method=S256` nos dois provedores |
| Client Secret só na troca | ausente das URLs de autorização (`05` e `06`); usado apenas no `POST` ao ponto de terminação de tokens |
| transação ausente/expirada/alterada/reutilizada | `07`, Casos 1, 2 e 3 mais a verificação complementar de expiração |
| validação do `id_token` | JWT em três partes, `alg=RS256`, JWKS obtido pelo documento de descoberta, assinatura RSASSA-PKCS1-v1_5 e conferência de `iss`, `aud`, `exp`, `iat` e `nonce` antes de criar a sessão |
| revogação no GitHub | após `GET /user`, `DELETE /applications/{client_id}/grant` exigindo 204; confirmado em `github.com/settings/applications`, onde a aplicação não aparece mesmo após autorização recente |
| cookie de sessão | prefixo `__Host-` (o navegador recusaria o cookie sem `Secure`, sem `Path=/` ou com `Domain`), `SameSite=Strict`, `Max-Age=28800`; `HttpOnly` confirmado por `document.cookie` vazio com sessão ativa |
| resumo no D1 | consulta no console: `length(id_hash)` = 43, o tamanho de um SHA-256 em Base64URL |
| perfil mínimo | `/api/me` devolve apenas provedor, e-mail, nome de exibição e expiração |
| logout | `07`, Caso 5 (403 em origem inválida) e Caso 6 (sessão removida do D1) |
| cookie revogado | `07`, Caso 6: 401 com o mesmo valor de cookie restaurado |
| sem tokens expostos | `localStorage`, `sessionStorage` e `document.cookie` vazios com sessão ativa; nenhum segredo no repositório; Client Secrets marcados como criptografados no Pages |
| estáticos públicos | ver explicação abaixo |

## Por que os arquivos estáticos permanecem públicos

O Cloudflare Pages serve tudo o que está em `public/` como arquivo estático, entregue pela
rede antes de qualquer código da aplicação ser executado. Não existe ponto onde a sessão
possa ser consultada para decidir se aquele arquivo deve ou não ser entregue.

A sessão protege apenas as rotas dinâmicas, que são as Pages Functions: `/api/me` consulta
o cookie e o D1 antes de responder. Esconder um link na página depois da consulta a
`/api/me`, como faz o `app.js`, é apresentação, não autorização: o arquivo de destino
continua acessível por sua URL para quem a conhecer.

É por isso que os arquivos desta pasta de evidências estão publicados e legíveis por
qualquer visitante, e por isso nenhum segredo, cookie, token, `state`, `nonce` ou
`code_challenge` real aparece neles.

---

## Assinatura

| Aluno | Papel | Data | Assinatura |
|---|---|---|---|
| Gabriel Fortunato | configuração, execução e conferência | 28/09/2026 | |

**Responsável pela rotação dos Client Secrets:** Gabriel Fortunato (titular das contas
Google Cloud, GitHub e Cloudflare usadas na prática).
