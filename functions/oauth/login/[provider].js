import { nowSeconds, randomToken, sha256Base64Url } from "../../_shared/crypto.js";
import { TX_MAX_AGE, txCookie } from "../../_shared/cookies.js";
import { json, methodNotAllowed, notFound, redirect } from "../../_shared/http.js";
import { fetchDiscovery } from "../../_shared/oidc.js";
import { getProvider, redirectUri } from "../../_shared/providers.js";

// GET /oauth/login/{provider}
// Cria a transação (resumos no D1), grava o cookie temporário e redireciona
// ao provedor com código de autorização + PKCE S256.
export async function onRequestGet({ env, params }) {
  const provider = getProvider(params.provider);
  if (!provider) return notFound();

  const clientId = env[provider.clientIdVar];
  if (!clientId || !env.PUBLIC_BASE_URL || !env.DB) {
    return json(500, { error: "misconfigured" });
  }

  const txId = randomToken();
  const state = randomToken();
  const codeVerifier = randomToken();
  const nonce = provider.usesNonce ? randomToken() : null;

  const [txHash, stateHash, codeChallenge] = await Promise.all([
    sha256Base64Url(txId),
    sha256Base64Url(state),
    sha256Base64Url(codeVerifier),
  ]);

  const now = nowSeconds();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM oauth_transactions WHERE expires_at <= ?1").bind(now),
    env.DB.prepare(
      "INSERT INTO oauth_transactions (id_hash, provider, state_hash, nonce, code_verifier, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ).bind(txHash, provider.name, stateHash, nonce, codeVerifier, now + TX_MAX_AGE),
  ]);

  const authorizationEndpoint = provider.usesNonce
    ? (await fetchDiscovery(provider.issuer)).authorization_endpoint
    : provider.authorizationEndpoint;

  const url = new URL(authorizationEndpoint);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri(env, provider));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider.scope) url.searchParams.set("scope", provider.scope);
  if (nonce) url.searchParams.set("nonce", nonce);

  return redirect(url.toString(), [txCookie(txId)]);
}

export function onRequest() {
  return methodNotAllowed("GET");
}
