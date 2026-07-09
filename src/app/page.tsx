import { cookies } from "next/headers";
import { readSession } from "@/lib/session";

export default async function Home() {
  const session = readSession(await cookies());

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold text-black dark:text-zinc-50">MONSITE</h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Service web démontrant l&apos;authentification via un fournisseur
        d&apos;identité externe (OAuth v2).
      </p>
      <a
        href={session ? "/profile" : "/login"}
        className="flex h-12 w-48 items-center justify-center rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
      >
        {session ? "Voir mon profil" : "Se connecter"}
      </a>
    </div>
  );
}
