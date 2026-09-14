import { SESSION_COOKIE, clearSessionCookie, parseCookies } from "../_shared/cookies.js";
import { json, methodNotAllowed, redirect } from "../_shared/http.js";
import { purgeExpiredSessions, revokeSession } from "../_shared/session.js";

// POST /oauth/logout — revoga a sessão local. Exige Origin exatamente igual a
// PUBLIC_BASE_URL, remove a linha do D1, expira o cookie e responde no-store.
export async function onRequestPost({ request, env }) {
  const origin = request.headers.get("Origin");
  if (!origin || origin !== env.PUBLIC_BASE_URL) {
    return json(403, { error: "invalid_origin" });
  }

  const raw = parseCookies(request)[SESSION_COOKIE];
  await revokeSession(env, raw);
  await purgeExpiredSessions(env);

  // 303 faz o formulário POST voltar à página inicial por GET.
  return redirect(env.PUBLIC_BASE_URL, [clearSessionCookie()], 303);
}

export function onRequest() {
  return methodNotAllowed("POST");
}
