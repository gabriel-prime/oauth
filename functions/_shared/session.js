import { isToken, nowSeconds, randomToken, sha256Base64Url } from "./crypto.js";
import { SESSION_COOKIE, SESSION_MAX_AGE, parseCookies } from "./cookies.js";

// Procura uma sessão válida a partir do cookie opaco. O D1 guarda apenas o
// resumo SHA-256 do valor do cookie.
export async function resolveSession(request, env) {
  const raw = parseCookies(request)[SESSION_COOKIE];
  if (!isToken(raw)) return null;
  const idHash = await sha256Base64Url(raw);
  const row = await env.DB.prepare(
    "SELECT issuer, subject, email, display_name, expires_at FROM sessions WHERE id_hash = ?1 AND expires_at > ?2",
  )
    .bind(idHash, nowSeconds())
    .first();
  return row ?? null;
}

// Cria a sessão local e devolve o identificador bruto que irá para o cookie.
export async function createSession(env, identity) {
  const raw = randomToken();
  const idHash = await sha256Base64Url(raw);
  const now = nowSeconds();
  await env.DB.prepare(
    "INSERT INTO sessions (id_hash, issuer, subject, email, display_name, expires_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
  )
    .bind(idHash, identity.issuer, identity.subject, identity.email, identity.displayName, now + SESSION_MAX_AGE, now)
    .run();
  return raw;
}

export async function revokeSession(env, raw) {
  if (!isToken(raw)) return;
  const idHash = await sha256Base64Url(raw);
  await env.DB.prepare("DELETE FROM sessions WHERE id_hash = ?1").bind(idHash).run();
}

export async function purgeExpiredSessions(env) {
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?1").bind(nowSeconds()).run();
}
