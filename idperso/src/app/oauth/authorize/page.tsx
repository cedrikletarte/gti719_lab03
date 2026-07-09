import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { validateAuthorizeRequest } from "@/lib/oauth/validateAuthorizeRequest";

function toSearchParams(sp: Record<string, string | string[] | undefined>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

function buildErrorRedirectUrl(redirectUri: string, error: string, state: string | null): string {
  const url = new URL(redirectUri);
  url.searchParams.set("error", error);
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const rawParams = await searchParams;
  const query = toSearchParams(rawParams);
  const validation = validateAuthorizeRequest(query);

  if (!validation.ok && validation.kind === "fatal") {
    return (
      <main>
        <h1>Requête invalide</h1>
        <p className="error">{validation.message}</p>
      </main>
    );
  }

  if (!validation.ok) {
    redirect(buildErrorRedirectUrl(validation.redirectUri, validation.error, validation.state));
  }

  const session = readSession(await cookies());
  if (!session) {
    const returnTo = `/oauth/authorize?${query.toString()}`;
    redirect(`/oauth/login?return_to=${encodeURIComponent(returnTo)}`);
  }

  const { params } = validation;
  const currentAuthorizeUrl = `/oauth/authorize?${query.toString()}`;

  return (
    <main>
      <h1>Autoriser MONSITE ?</h1>
      <div className="card">
        <p>
          Connecté en tant que <strong>{session.username}</strong>.{" "}
          <a href={`/oauth/logout?return_to=${encodeURIComponent(currentAuthorizeUrl)}`}>
            Se connecter avec un autre compte
          </a>
        </p>
        <p className="muted">
          MONSITE souhaite accéder à : nom d&apos;utilisateur, courriel.
        </p>
        <form method="POST" action="/oauth/authorize/decision">
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="client_id" value={params.clientId} />
          <input type="hidden" name="redirect_uri" value={params.redirectUri} />
          {params.scope && <input type="hidden" name="scope" value={params.scope} />}
          {params.state && <input type="hidden" name="state" value={params.state} />}
          {params.codeChallenge && (
            <input type="hidden" name="code_challenge" value={params.codeChallenge} />
          )}
          {params.codeChallengeMethod && (
            <input
              type="hidden"
              name="code_challenge_method"
              value={params.codeChallengeMethod}
            />
          )}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button type="submit" name="decision" value="approve">
              Autoriser
            </button>
            <button type="submit" name="decision" value="deny" className="btn-secondary">
              Refuser
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
