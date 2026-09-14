import { json, methodNotAllowed } from "../_shared/http.js";
import { resolveSession } from "../_shared/session.js";

// Resolve o cookie de sessão e devolve apenas o perfil mínimo.
export async function onRequestGet({ request, env }) {
  const session = await resolveSession(request, env);
  if (!session) return json(401, { error: "unauthenticated" });

  return json(200, {
    provider: session.issuer === "https://github.com" ? "github" : "google",
    email: session.email ?? null,
    displayName: session.display_name ?? null,
    expiresAt: session.expires_at,
  });
}

export function onRequest() {
  return methodNotAllowed("GET");
}
