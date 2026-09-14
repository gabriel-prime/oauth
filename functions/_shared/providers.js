// Dados fixos de cada provedor. Nenhum segredo é definido aqui: Client ID e
// Client Secret chegam por context.env (variáveis e segredos do Pages).

export const PROVIDERS = {
  google: {
    name: "google",
    // Emissor OIDC. O documento de descoberta fornece os pontos de terminação
    // de autorização e de tokens e o jwks_uri.
    issuer: "https://accounts.google.com",
    scope: "openid email profile",
    usesNonce: true,
    clientIdVar: "GOOGLE_CLIENT_ID",
    clientSecretVar: "GOOGLE_CLIENT_SECRET",
  },
  github: {
    name: "github",
    issuer: "https://github.com",
    authorizationEndpoint: "https://github.com/login/oauth/authorize",
    tokenEndpoint: "https://github.com/login/oauth/access_token",
    // Sem escopos: o perfil público basta para identificar a conta.
    scope: null,
    usesNonce: false,
    clientIdVar: "GITHUB_CLIENT_ID",
    clientSecretVar: "GITHUB_CLIENT_SECRET",
  },
};

export function getProvider(name) {
  if (typeof name !== "string") return null;
  return Object.prototype.hasOwnProperty.call(PROVIDERS, name) ? PROVIDERS[name] : null;
}

export function redirectUri(env, provider) {
  return `${env.PUBLIC_BASE_URL}/oauth/callback/${provider.name}`;
}
