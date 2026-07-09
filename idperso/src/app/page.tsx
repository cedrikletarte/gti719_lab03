export default function Home() {
  return (
    <main>
      <h1>IDPERSO</h1>
      <p className="muted">Fournisseur d&apos;identité maison — serveur d&apos;autorisation OAuth2.</p>
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <a className="btn" href="/register">
          Créer un compte
        </a>
        <a className="btn btn-secondary" href="/oauth/login?return_to=%2F">
          Se connecter
        </a>
      </div>
    </main>
  );
}
