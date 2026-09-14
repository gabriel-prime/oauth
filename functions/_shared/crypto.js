// Utilidades criptográficas baseadas apenas em Web Crypto (sem pacotes externos).

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(text) {
  const padding = text.length % 4 === 0 ? "" : "=".repeat(4 - (text.length % 4));
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// 32 bytes aleatórios em Base64URL sem preenchimento => 43 caracteres.
// Serve para id da transação, state, nonce, code_verifier e id da sessão.
export function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function isToken(value) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

// SHA-256 em Base64URL. Usado para code_challenge (S256) e para os resumos
// do cookie de transação, do state e do cookie de sessão gravados no D1.
export async function sha256Base64Url(input) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
}

// Comparação em tempo constante para resumos codificados em texto.
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const bytesA = new TextEncoder().encode(a);
  const bytesB = new TextEncoder().encode(b);
  if (bytesA.length !== bytesB.length) return false;
  let diff = 0;
  for (let i = 0; i < bytesA.length; i++) diff |= bytesA[i] ^ bytesB[i];
  return diff === 0;
}

export function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}
