// Consulta a sessão na mesma origem. Ocultar os links de login depois da
// resposta não torna nenhum arquivo de public privado: é apenas apresentação.
(function () {
  const status = document.getElementById("status");
  const login = document.getElementById("login");
  const profile = document.getElementById("profile");

  function show(user) {
    if (user) {
      status.textContent = `Sessão de ${user.email ?? user.displayName}.`;
      document.getElementById("profile-provider").textContent =
        user.provider === "github" ? "GitHub" : "Google";
      document.getElementById("profile-name").textContent = user.displayName ?? "—";
      document.getElementById("profile-email").textContent = user.email ?? "não informado";
      document.getElementById("profile-expires").textContent = user.expiresAt
        ? new Date(user.expiresAt * 1000).toLocaleString("pt-BR")
        : "—";
      login.hidden = true;
      profile.hidden = false;
    } else {
      status.textContent = "Nenhuma sessão neste navegador.";
      login.hidden = false;
      profile.hidden = true;
    }
  }

  fetch("/api/me", { credentials: "same-origin" })
    .then((response) => (response.ok ? response.json() : null))
    .then(show)
    .catch(() => {
      status.textContent = "Não foi possível consultar a sessão.";
    });
})();
