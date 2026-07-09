const ERROR_MESSAGES: Record<string, string> = {
  username_taken: "Ce nom d'utilisateur est déjà pris.",
  missing_fields: "Tous les champs sont requis.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; return_to?: string }>;
}) {
  const { error, return_to } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Une erreur est survenue." : null;

  return (
    <main>
      <h1>Créer un compte IDPERSO</h1>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <div className="card">
        <form method="POST" action="/register/submit">
          {return_to && <input type="hidden" name="return_to" value={return_to} />}
          <label>
            Nom d&apos;utilisateur
            <input type="text" name="username" required minLength={3} autoComplete="username" />
          </label>
          <label>
            Courriel
            <input type="email" name="email" required autoComplete="email" />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              name="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button type="submit">S&apos;inscrire</button>
        </form>
        <p className="muted">
          Déjà un compte ?{" "}
          <a href={`/oauth/login${return_to ? `?return_to=${encodeURIComponent(return_to)}` : ""}`}>
            Se connecter
          </a>
        </p>
      </div>
    </main>
  );
}
