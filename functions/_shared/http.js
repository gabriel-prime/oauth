// Respostas padronizadas. Tudo o que sai das Functions usa Cache-Control: no-store.

export class AuthError extends Error {
  constructor(code, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function json(status, body, cookies = []) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

export function redirect(location, cookies = [], status = 302) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  return new Response(null, { status, headers });
}

export function notFound() {
  return json(404, { error: "not_found" });
}

export function methodNotAllowed(allow) {
  const response = json(405, { error: "method_not_allowed" });
  response.headers.set("Allow", allow);
  return response;
}
