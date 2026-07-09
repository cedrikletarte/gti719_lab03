import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export default async function ProfilePage() {
  // Re-verify the session here even though proxy.ts already filtered this route:
  // Proxy protection alone is not a substitute for checking auth in the route itself.
  const session = readSession(await cookies());
  if (!session) {
    redirect("/login?error=auth_required");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        {session.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.avatarUrl}
            alt={session.name ?? "Avatar"}
            className="h-20 w-20 rounded-full"
          />
        )}
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          {session.name ?? "Utilisateur"}
        </h1>
        {session.email && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{session.email}</p>
        )}
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          Connecté via {session.provider}
        </span>

        <a
          href="/api/auth/logout"
          className="mt-4 flex h-10 w-full items-center justify-center rounded-full border border-black/[.08] px-5 text-sm transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Se déconnecter
        </a>
      </div>
    </div>
  );
}
