# Plan — Partie 1 : MONSITE (client OAuth2 vers Google + GitHub)

## Contexte

Le labo GTI719 (sécurité des réseaux d'entreprise) demande de construire **MONSITE**, un service web qui délègue l'authentification à deux fournisseurs d'identité externes (Google + un second au choix) via OAuth v2, plutôt que de gérer ses propres mots de passe. Le PDF prévient explicitement que les choix d'implémentation OAuth2 de différents fournisseurs (ex. Facebook vs Google) ne sont pas forcément compatibles, et — en vue de la Partie 2 (hors scope ici, IDPERSO) — recommande de calquer les choix faits pour Google afin que le même code client puisse plus tard parler à un IdP maison. Ce plan couvre uniquement la **Partie 1**, mais garde le module OAuth générique pour ne pas bloquer la Partie 2.

Second IdP choisi : **GitHub** (OAuth2 pur sans OIDC, bon contraste pédagogique avec Google qui utilise OIDC).

Le projet est un `create-next-app` vierge (Next.js 16.2.10, App Router, TypeScript strict, `src/app/` avec seulement layout/page par défaut). C'est une version **modifiée** de Next.js (voir `AGENTS.md`) : le changement cassant confirmé et pertinent ici est que `middleware.ts` est renommé **`proxy.ts`**, exportant une fonction `proxy` (pas `middleware`), verrouillée sur le runtime Node — confirmé en lisant `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`. `cookies()`/`params` sont pleinement asynchrones (toujours `await`).

Décisions de conception clés :
- **Aucune base de données** : le cookie de session signé contient directement les claims retournés par l'IdP (id, email, nom, avatar, provider). Pas de table utilisateurs pour la Partie 1.
- **Aucune nouvelle dépendance npm** : le module `crypto` natif de Node (disponible car `proxy.ts` est maintenant verrouillé sur Node) suffit pour `randomBytes` (state/PKCE), `createHmac` (signature de cookie), `createHash('sha256')` (PKCE).
- **Module OAuth générique** paramétré par une config par fournisseur (`OAuthProviderConfig`), afin que Google, GitHub, et plus tard IDPERSO passent par le même code d'échange authorize/callback/token.

## Architecture

### Module OAuth générique (`src/lib/oauth/`)

```ts
type OAuthUserInfo = { provider: string; providerAccountId: string; email: string | null; name: string | null; avatarUrl: string | null };

type OAuthProviderConfig = {
  id: string; displayName: string;
  clientIdEnv: string; clientSecretEnv: string;
  authorizationEndpoint: string; tokenEndpoint: string; userinfoEndpoint: string;
  scope: string; usePkce: boolean;
  mapUserInfo: (raw: unknown) => OAuthUserInfo;
};
```

`src/lib/oauth/client.ts` expose 3 fonctions génériques utilisées identiquement pour tous les fournisseurs :
- `buildAuthorizationUrl(config, { state, redirectUri, codeChallenge })`
- `exchangeCodeForToken(config, { code, redirectUri, codeVerifier })` — POST form-encoded avec header `Accept: application/json` (nécessaire pour que le endpoint token de GitHub, qui répond en `x-www-form-urlencoded` par défaut, se comporte comme celui de Google) et un header `User-Agent` (GitHub retourne 403 sans ça).
- `fetchUserInfo(config, accessToken)` — GET avec `Authorization: Bearer`, puis `config.mapUserInfo(json)`.

Config par fournisseur :
- **Google** (`src/lib/oauth/providers/google.ts`) : `authorizationEndpoint: https://accounts.google.com/o/oauth2/v2/auth`, `tokenEndpoint: https://oauth2.googleapis.com/token`, `userinfoEndpoint: https://openidconnect.googleapis.com/v1/userinfo`, `scope: "openid email profile"`, mapping `sub→providerAccountId`, `picture→avatarUrl`.
- **GitHub** (`src/lib/oauth/providers/github.ts`) : `authorizationEndpoint: https://github.com/login/oauth/authorize`, `tokenEndpoint: https://github.com/login/oauth/access_token`, `userinfoEndpoint: https://api.github.com/user`, `scope: "read:user user:email"`, mapping `id→providerAccountId` (stringifié), `email` peut être `null`, `avatar_url→avatarUrl`.

`src/lib/oauth/providers/index.ts` expose `getProvider(id)` sur un registre `Record<string, OAuthProviderConfig>` — **c'est l'unique point d'extension** dont la Partie 2 aura besoin pour brancher IDPERSO (nouvelle entrée, zéro changement à `client.ts` ou aux route handlers).

### Routes (App Router)

```
src/app/api/auth/[provider]/authorize/route.ts   GET — redirige vers l'IdP
src/app/api/auth/[provider]/callback/route.ts    GET — échange le code, ouvre la session, redirige
src/app/api/auth/logout/route.ts                 GET/POST — efface la session
src/app/login/page.tsx                           publique
src/app/profile/page.tsx                         protégée
src/proxy.ts                                     protection de route (remplace middleware.ts)
```

`[provider]` est un segment dynamique (`params` étant async : `const { provider } = await params`), puis `getProvider(provider) ?? notFound()` — sert aussi de liste blanche contre des valeurs arbitraires.

`redirect_uri` est construit depuis `APP_BASE_URL` (env var), jamais depuis le header Host, car les IdP exigent une correspondance exacte enregistrée.

La session n'est émise qu'à **un seul endroit** : fin de `callback/route.ts`, après un unique échange de code + un unique fetch userinfo réussis.

### Session (cookie signé, sans store serveur)

Choisi plutôt qu'une Map en mémoire, car en `next dev` le Fast Refresh peut recharger les modules de Route Handlers et vider une Map en pleine démo — un cookie signé n'a pas ce risque, et aucune persistance entre redémarrages n'est requise.

`src/lib/crypto/signedToken.ts` : `sign(payload, maxAgeSeconds)` / `verify(token)` — `base64url(JSON) + "." + base64url(HMAC-SHA256(..., SESSION_SECRET))`, expiration `exp` intégrée. Réutilisé pour le cookie de session **et** le cookie d'état OAuth (un seul primitif crypto, deux usages).

Cookie `monsite_session` : `HttpOnly`, `Secure` en prod, **`SameSite=Lax`** (obligatoire — le navigateur arrive sur `/api/auth/{provider}/callback` via une redirection cross-site top-level depuis `accounts.google.com`/`github.com` ; `Strict` bloquerait le cookie sur cette navigation), `Path=/`, `Max-Age` ~2h. Claims : `{ sub, provider, email, name, avatarUrl, iat, exp }`.

### Protections CSRF / rejeu

- **`state`** : `crypto.randomBytes(32)`, généré dans `authorize/route.ts`, stocké dans un cookie signé court `monsite_oauth_state` (pas en mémoire serveur, même raison qu'au-dessus), `Path=/api/auth`, `Max-Age=600`. Au callback : vérifier signature+expiration, vérifier que `payload.provider` correspond au segment d'URL, comparer `state` avec `crypto.timingSafeEqual`. **Le cookie est supprimé dès sa première lecture**, succès ou échec — c'est ce qui garantit qu'un second hit du callback (retour arrière, double clic) échoue proprement côté MONSITE plutôt que de retenter l'échange.
- **PKCE** : ajouté même si MONSITE est un client confidentiel (avec `client_secret`), car c'est peu coûteux (~15 lignes dans le client générique), recommandé par la doc actuelle de Google, et — vivant dans le module générique via `config.usePkce` — profite gratuitement à IDPERSO en Partie 2.

### Critère noté « code non réutilisable / expiration »

Ce sont des comportements du **serveur d'autorisation** (Google/GitHub), déclenchés en retentant un échange avec le même `code`. Ce que MONSITE doit garantir de son côté :
- Aucune boucle de retry autour du POST d'échange de token.
- Aucun cache/log de la valeur `code`.
- Un seul appel à `exchangeCodeForToken` par callback, dans un try/catch qui redirige vers `/login?error=oauth_failed` en cas de `invalid_grant`/erreur.
- Le cookie `monsite_oauth_state` supprimé au premier hit rend un second hit du callback rejeté par MONSITE lui-même (`/login?error=expired`) avant toute tentative d'échange.

Pour démontrer live que le code est bien à usage unique/expirant (rubrique notée), la manière propre est d'observer dans l'onglet réseau le POST vers le token endpoint pendant une connexion normale, puis rejouer ce même POST (curl/Postman) après coup — l'IdP renverra `invalid_grant`.

### Pages et `proxy.ts`

- `src/app/login/page.tsx` — liens `/api/auth/google/authorize` et `/api/auth/github/authorize`, affiche `?error=`.
- `src/app/profile/page.tsx` — protégée ; relit et revérifie la session côté serveur (`await readSession(await cookies())`) même si `proxy.ts` a déjà filtré — défense en profondeur (la doc Next.js elle-même recommande de ne pas se fier uniquement au Proxy).
- `src/app/page.tsx` — page d'accueil simple, lien vers `/login`.
- `src/proxy.ts` — `export function proxy(request: NextRequest)`, `export const config = { matcher: ["/profile/:path*"] }`, vérifie `monsite_session` via `verify()`, redirige vers `/login?error=auth_required` si absent/invalide.

## Fichiers à créer (ordre de construction)

1. `.env.local` (déjà ignoré par `.env*` dans `.gitignore`) — `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `SESSION_SECRET`, `APP_BASE_URL=http://localhost:3000`.
2. `src/lib/env.ts` — validation des variables d'env au démarrage.
3. `src/lib/crypto/signedToken.ts`
4. `src/lib/oauth/types.ts`
5. `src/lib/oauth/pkce.ts` — `createPkcePair()`
6. `src/lib/oauth/client.ts`
7. `src/lib/oauth/providers/google.ts`
8. `src/lib/oauth/providers/github.ts`
9. `src/lib/oauth/providers/index.ts`
10. `src/lib/session.ts` — `createSessionCookie`, `readSession`, `SESSION_COOKIE_NAME`
11. `src/app/api/auth/[provider]/authorize/route.ts`
12. `src/app/api/auth/[provider]/callback/route.ts`
13. `src/app/api/auth/logout/route.ts`
14. `src/proxy.ts`
15. `src/app/login/page.tsx`
16. `src/app/profile/page.tsx`
17. `src/app/page.tsx` (mise à jour)

## Inscription des applications OAuth (à faire par l'utilisateur, comptes dédiés)

**Google Cloud Console** : créer un projet → OAuth consent screen (External, garder en mode "Testing", s'ajouter comme test user) → Credentials → OAuth client ID (Web application) → redirect URI `http://localhost:3000/api/auth/google/callback`.

**GitHub Developer Settings** : Settings → Developer settings → OAuth Apps → New OAuth App → Homepage `http://localhost:3000`, Authorization callback URL `http://localhost:3000/api/auth/github/callback` (une seule callback URL par app classique GitHub OAuth — une URL de prod nécessitera une seconde app enregistrée).

## Vérification

1. `npm run dev`, remplir `.env.local` avec les identifiants réels des deux apps enregistrées.
2. Depuis `/login`, cliquer "Se connecter avec Google" → flux complet → doit atterrir sur `/profile` avec nom/email/avatar affichés et cookie `monsite_session` présent (DevTools → Application → Cookies, `HttpOnly` coché).
3. Répéter avec GitHub.
4. Accéder à `/profile` sans cookie de session (navigation privée) → doit rediriger vers `/login?error=auth_required`.
5. Cliquer déconnexion → cookie effacé → `/profile` redirige de nouveau vers `/login`.
6. Revenir en arrière dans le navigateur juste après un callback réussi (retente la même URL de callback) → doit afficher `/login?error=expired`, pas de crash.
7. `npm run lint` et `npm run build` doivent passer sans erreur.
