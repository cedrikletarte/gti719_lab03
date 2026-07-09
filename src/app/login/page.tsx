import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";
import { listProviders } from "@/lib/oauth/providers";

const ERROR_MESSAGES: Record<string, string> = {
  auth_required: "Vous devez vous connecter pour accéder à cette page.",
  expired: "Votre tentative de connexion a expiré. Veuillez réessayer.",
  oauth_denied: "La connexion a été refusée par le fournisseur d'identité.",
  oauth_failed: "La connexion a échoué. Veuillez réessayer.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = readSession(await cookies());
  if (session) {
    redirect("/profile");
  }

  const { error } = await searchParams;
  const errorMessage = error ? ERROR_MESSAGES[error] ?? "Une erreur est survenue." : null;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        Connexion à MONSITE
      </h1>

      {errorMessage && (
        <p className="max-w-sm rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {errorMessage}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {listProviders().map((provider) => (
          <a
            key={provider.id}
            href={`/api/auth/${provider.id}/authorize`}
            className="flex h-12 w-64 items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Se connecter avec {provider.displayName}
          </a>
        ))}
      </div>
    </div>
  );
}
