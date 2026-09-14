// Contratos dos cookies definidos no roteiro do laboratório.

export const TX_COOKIE = "__Host-oauth-tx";
export const SESSION_COOKIE = "__Host-session";

export const TX_MAX_AGE = 600; // 10 minutos
export const SESSION_MAX_AGE = 28800; // 8 horas

export function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) cookies[name] = value;
  }
  return cookies;
}

export function txCookie(value) {
  return `${TX_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${TX_MAX_AGE}`;
}

export function clearTxCookie() {
  return `${TX_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function sessionCookie(value) {
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
