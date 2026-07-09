const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Nom d'utilisateur ou mot de passe invalide.",
};

export default async function OAuthLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const { error, return_to } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Une erreur est survenue." : null;

  return (
    <main>
      <h1>Connexion IDPERSO</h1>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <div className="card">
        <form method="POST" action="/oauth/login/submit">
          {return_to && <input type="hidden" name="return_to" value={return_to} />}
          <label>
            Nom d&apos;utilisateur
            <input type="text" name="username" required autoComplete="username" />
          </label>
          <label>
            Mot de passe
            <input type="password" name="password" required autoComplete="current-password" />
          </label>
          <button type="submit">Se connecter</button>
        </form>
        <p className="muted">
          Pas de compte ?{" "}
          <a href={`/register${return_to ? `?return_to=${encodeURIComponent(return_to)}` : ""}`}>
            S&apos;inscrire
          </a>
        </p>
      </div>
    </main>
  );
}
