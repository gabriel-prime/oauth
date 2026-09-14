import { base64UrlDecode, nowSeconds, timingSafeEqual } from "./crypto.js";
import { AuthError } from "./http.js";

const decoder = new TextDecoder();

function decodeJson(segment) {
  try {
    return JSON.parse(decoder.decode(base64UrlDecode(segment)));
  } catch {
    throw new AuthError("malformed_id_token");
  }
}

export async function fetchDiscovery(issuer) {
  const response = await fetch(`${issuer}/.well-known/openid-configuration`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new AuthError("discovery_failed", 502);
  const doc = await response.json();
  if (doc.issuer !== issuer || !doc.jwks_uri || !doc.token_endpoint || !doc.authorization_endpoint) {
    throw new AuthError("discovery_invalid", 502);
  }
  return doc;
}

async function fetchJwk(jwksUri, kid) {
  const response = await fetch(jwksUri, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new AuthError("jwks_failed", 502);
  const { keys } = await response.json();
  if (!Array.isArray(keys)) throw new AuthError("jwks_invalid", 502);
  const jwk = keys.find((key) => key.kid === kid && key.kty === "RSA" && (key.alg ?? "RS256") === "RS256");
  if (!jwk) throw new AuthError("unknown_kid");
  return jwk;
}

// Valida o id_token do Google sem bibliotecas externas:
// formato JWT em três partes, alg RS256, chave pública obtida pelo JWKS do
// documento de descoberta, assinatura RSASSA-PKCS1-v1_5 e claims semânticas.
export async function verifyGoogleIdToken(idToken, { issuer, clientId, nonce }) {
  if (typeof idToken !== "string") throw new AuthError("malformed_id_token");
  const parts = idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => part.length === 0)) {
    throw new AuthError("malformed_id_token");
  }
  const [headerSegment, payloadSegment, signatureSegment] = parts;

  const header = decodeJson(headerSegment);
  if (header.alg !== "RS256") throw new AuthError("unsupported_alg");
  if (typeof header.kid !== "string") throw new AuthError("missing_kid");

  const discovery = await fetchDiscovery(issuer);
  const jwk = await fetchJwk(discovery.jwks_uri, header.kid);

  const key = await crypto.subtle.importKey(
    "jwk",
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signatureValid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key,
    base64UrlDecode(signatureSegment),
    new TextEncoder().encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!signatureValid) throw new AuthError("invalid_signature");

  const payload = decodeJson(payloadSegment);
  const now = nowSeconds();
  const clockSkew = 300;

  // O Google pode emitir iss com ou sem o esquema https.
  if (payload.iss !== issuer && payload.iss !== issuer.replace(/^https:\/\//, "")) {
    throw new AuthError("invalid_issuer");
  }
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(clientId)) throw new AuthError("invalid_audience");
  if (!Number.isFinite(payload.exp) || payload.exp <= now - clockSkew) throw new AuthError("token_expired");
  if (!Number.isFinite(payload.iat) || payload.iat > now + clockSkew) throw new AuthError("invalid_iat");
  if (typeof payload.nonce !== "string" || !timingSafeEqual(payload.nonce, nonce)) {
    throw new AuthError("invalid_nonce");
  }
  if (typeof payload.sub !== "string" || payload.sub.length === 0) throw new AuthError("missing_subject");

  return {
    issuer,
    subject: payload.sub,
    email: payload.email_verified === true && typeof payload.email === "string" ? payload.email : null,
    displayName: typeof payload.name === "string" ? payload.name : null,
  };
}
