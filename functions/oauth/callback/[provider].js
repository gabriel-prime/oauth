import { isToken, nowSeconds, sha256Base64Url, timingSafeEqual } from "../../_shared/crypto.js";
import { TX_COOKIE, clearTxCookie, parseCookies, sessionCookie } from "../../_shared/cookies.js";
import { AuthError, json, methodNotAllowed, notFound, redirect } from "../../_shared/http.js";
import { fetchDiscovery, verifyGoogleIdToken } from "../../_shared/oidc.js";
import { getProvider, redirectUri } from "../../_shared/providers.js";
import { createSession } from "../../_shared/session.js";

const GITHUB_API_VERSION = "2026-03-10";
const USER_AGENT = "oauth-pages-lab";

// GET /oauth/callback/{provider}
export async function onRequestGet({ request, env, params }) {
  const provider = getProvider(params.provider);
  if (!provider) return notFound();

  try {
    const identity = await handleCallback(request, env, provider);
    const sessionId = await createSession(env, identity);
    return redirect(env.PUBLIC_BASE_URL, [clearTxCookie(), sessionCookie(sessionId)]);
  } catch (error) {
    // Apenas o código interno é registrado: nunca tokens, códigos ou corpos.
    const code = error instanceof AuthError ? error.code : "unexpected";
    const status = error instanceof AuthError ? error.status : 500;
    console.error(`callback ${provider.name} rejected: ${code}`);
    return json(status, { error: code }, [clearTxCookie()]);
  }
}

export function onRequest() {
  return methodNotAllowed("GET");
}

async function handleCallback(request, env, provider) {
  const clientId = env[provider.clientIdVar];
  const clientSecret = env[provider.clientSecretVar];
  if (!clientId || !clientSecret || !env.PUBLIC_BASE_URL || !env.DB) {
    throw new AuthError("misconfigured", 500);
  }

  // 1. recusar error ou ausência de code/state
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (url.searchParams.get("error") || !code || !state) throw new AuthError("invalid_callback");

  // 2. exigir o cookie temporário
  const txId = parseCookies(request)[TX_COOKIE];
  if (!isToken(txId)) throw new AuthError("missing_transaction");

  // 3. localizar uma transação não expirada pelo resumo do cookie
  const txHash = await sha256Base64Url(txId);
  const tx = await env.DB.prepare(
    "SELECT provider, state_hash, nonce, code_verifier FROM oauth_transactions WHERE id_hash = ?1 AND expires_at > ?2",
  )
    .bind(txHash, nowSeconds())
    .first();
  if (!tx || tx.provider !== provider.name) throw new AuthError("invalid_transaction");

  // 4. comparar o resumo de state
  const stateHash = await sha256Base64Url(state);
  if (!timingSafeEqual(stateHash, tx.state_hash)) {
    await env.DB.prepare("DELETE FROM oauth_transactions WHERE id_hash = ?1").bind(txHash).run();
    throw new AuthError("invalid_state");
  }

  // 5. apagar a transação antes de concluir (uso único)
  const deleted = await env.DB.prepare("DELETE FROM oauth_transactions WHERE id_hash = ?1").bind(txHash).run();
  if (!deleted.meta || deleted.meta.changes !== 1) throw new AuthError("invalid_transaction");

  // 6. trocar o código com code_verifier + Client Secret
  const tokenEndpoint = provider.usesNonce
    ? (await fetchDiscovery(provider.issuer)).token_endpoint
    : provider.tokenEndpoint;
  const tokens = await exchangeCode(tokenEndpoint, {
    code,
    codeVerifier: tx.code_verifier,
    clientId,
    clientSecret,
    redirectUri: redirectUri(env, provider),
  });

  // 7. validar a identidade conforme o contrato do provedor
  if (provider.name === "google") {
    return verifyGoogleIdToken(tokens.id_token, { issuer: provider.issuer, clientId, nonce: tx.nonce });
  }
  return confirmGithubIdentity(tokens, { clientId, clientSecret });
}

async function exchangeCode(tokenEndpoint, { code, codeVerifier, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
  });
  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body,
  });
  if (!response.ok) throw new AuthError("token_exchange_failed", 401);
  let tokens;
  try {
    tokens = await response.json();
  } catch {
    throw new AuthError("token_exchange_invalid", 401);
  }
  // O GitHub pode responder 200 com um campo error no corpo.
  if (!tokens || typeof tokens !== "object" || tokens.error) throw new AuthError("token_exchange_failed", 401);
  return tokens;
}

// Usa o access_token somente para GET /user, revoga a autorização da OAuth App
// (DELETE /applications/{client_id}/grant) e devolve a identidade estável.
async function confirmGithubIdentity(tokens, { clientId, clientSecret }) {
  const accessToken = tokens.access_token;
  const tokenType = typeof tokens.token_type === "string" ? tokens.token_type.toLowerCase() : "";
  if (typeof accessToken !== "string" || accessToken.length === 0 || tokenType !== "bearer") {
    throw new AuthError("invalid_token_response", 401);
  }

  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    },
  });
  if (userResponse.status !== 200) throw new AuthError("github_user_failed", 401);
  const user = await userResponse.json();
  if (!Number.isInteger(user.id)) throw new AuthError("github_user_invalid", 401);

  const revokeResponse = await fetch(
    `https://api.github.com/applications/${encodeURIComponent(clientId)}/grant`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({ access_token: accessToken }),
    },
  );
  if (revokeResponse.status !== 204) throw new AuthError("github_revoke_failed", 502);

  return {
    issuer: "https://github.com",
    subject: String(user.id),
    email: typeof user.email === "string" ? user.email : null,
    displayName: (typeof user.name === "string" && user.name) || (typeof user.login === "string" ? user.login : null),
  };
}
