# Plan — Partie 1 : MONSITE (client OAuth2 vers Google + GitHub)

*(Partie 1 déjà implémentée et fonctionnelle — voir section suivante pour la Partie 2. La section Partie 1 ci-dessous est conservée comme référence historique.)*

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

---

# Plan — Partie 2 : IDPERSO (fournisseur d'identité maison, serveur d'autorisation OAuth2)

## Contexte

La Partie 2 demande de construire **IDPERSO**, un fournisseur d'identités simple qui doit s'intégrer à MONSITE (Partie 1) exactement comme Google et GitHub le font — MONSITE doit pouvoir s'y connecter sans modification de son cœur OAuth générique. Le PDF recommande explicitement de calquer les choix faits pour Google afin que l'intégration soit interopérable, et exige qu'IDPERSO permette l'inscription de nouveaux utilisateurs (stockage volontairement simple — "ce n'est pas l'objectif principal de cette partie"). Contrairement à la Partie 1 où le code d'autorisation à usage unique/expirant était garanti par Google/GitHub eux-mêmes, ici **IDPERSO doit lui-même implémenter et appliquer** cette garantie, car c'est lui qui joue le rôle du serveur d'autorisation — c'est un critère noté explicitement à la démo de la séance 4 (Fonctionnement 5%, code non réutilisable 2.5%, expiration 2.5%).

Décision déjà prise avec l'utilisateur : IDPERSO vivra dans un **sous-dossier `idperso/`** à la racine du dépôt actuel, comme un **second projet Next.js entièrement indépendant** (son propre `package.json`, son propre `.env`, son propre port — 4000 — lancé séparément via `npm run dev` dans ce dossier). Ce n'est pas un workspace npm ; ce sont deux applications qui tournent en parallèle dans le même dépôt Git, ce qui respecte le fait qu'IDPERSO doit être un vrai service séparé franchissant une frontière réseau réelle (échange de `client_secret` par HTTP, cookies de session distincts par origine) — exactement comme Google/GitHub en Partie 1.

Grâce à la conception générique de la Partie 1 (`OAuthProviderConfig` + registre dans `src/lib/oauth/providers/index.ts`), brancher IDPERSO côté MONSITE ne touchera que **2 fichiers** : un nouveau fichier de config provider, et une ligne dans le registre. Zéro changement à `client.ts` ou aux route handlers — c'était l'objectif explicite de la conception de la Partie 1.

## Décision de conception clé : stockage des codes/jetons en mémoire, épinglé sur `globalThis`

Les codes d'autorisation et jetons d'accès sont stockés dans des `Map` en mémoire du processus Node d'IDPERSO — **pas** des jetons signés sans état (un jeton signé prouve l'authenticité et l'expiration, mais ne peut pas à lui seul garantir l'usage unique ; il faudrait de toute façon un état côté serveur pour ça, donc autant garder un seul mécanisme). La `Map` est stockée sur `globalThis` (pas une simple variable de module) pour survivre au rechargement de module par Fast Refresh en dev — seul un vrai redémarrage de `npm run dev` la vide, ce qui est acceptable pour des codes qui vivent ~60 secondes. Marquer un code comme `consumed` (plutôt que le supprimer) permet de distinguer proprement "déjà utilisé" de "jamais existé" à la démo.

Mots de passe utilisateurs : `crypto.scryptSync` natif de Node (zéro nouvelle dépendance, même philosophie que la Partie 1) avec sel aléatoire par utilisateur, comparaison en temps constant via `timingSafeEqual`.

Stockage des comptes : fichier JSON plat `idperso/data/users.json` (gitignoré) — contrairement aux codes/jetons, doit survivre aux redémarrages entre séances de labo, donc pas en mémoire.

## Architecture

### Structure du projet `idperso/`

```
idperso/
  package.json, next.config.ts, tsconfig.json, .gitignore, .env, .env.exemple
  data/                          (gitignoré ; users.json créé au premier /register)
  src/
    lib/
      env.ts                          calque de src/lib/env.ts de MONSITE
      crypto/signedToken.ts           copie conforme de celui de MONSITE
      session.ts                      cookie idperso_session (état de connexion du propriétaire de ressource)
      users/store.ts                  createUser / findUserByUsername / verifyPassword
      oauth/validateAuthorizeRequest.ts   validation partagée GET page + POST decision
      store/authCodes.ts              Map globalThis — createAuthCode / consumeAuthCode
      store/accessTokens.ts           Map globalThis — createAccessToken / getAccessToken
    app/
      layout.tsx, page.tsx, globals.css
      register/page.tsx               formulaire d'inscription
      register/submit/route.ts        POST — crée l'utilisateur
      oauth/login/page.tsx            formulaire de connexion IDPERSO (distinct de la connexion MONSITE)
      oauth/login/submit/route.ts     POST — authentifie, pose idperso_session
      oauth/authorize/page.tsx        GET — écran de consentement ou redirection vers login
      oauth/authorize/decision/route.ts   POST — mint le code, redirige vers MONSITE
      oauth/token/route.ts            POST — échange code→access_token
      oauth/userinfo/route.ts         GET — profil via Bearer token
```

**Piège gitignore** : les motifs du `.gitignore` racine (`/node_modules`, `/.next/`) sont ancrés à la racine du dépôt (slash en tête) et ne couvriront **pas** `idperso/node_modules` ni `idperso/.next` — créer un `idperso/.gitignore` dédié. Le motif `.env` (ligne 34 du `.gitignore` racine, sans slash en tête) couvre lui déjà `idperso/.env` à n'importe quelle profondeur, donc pas besoin de le redupliquer pour ça spécifiquement.

Pas de `proxy.ts` dans IDPERSO : le seul endroit qui a besoin de "doit être connecté" (`/oauth/authorize`) a besoin d'un contrôle fin sur le retour après connexion, plus simple à gérer directement dans le composant de page.

### Client OAuth enregistré (pas d'enregistrement dynamique)

IDPERSO reconnaît un seul client via variables d'environnement, comparées en égalité stricte à `/oauth/authorize` et `/oauth/token` : `MONSITE_CLIENT_ID`, `MONSITE_CLIENT_SECRET`, `MONSITE_REDIRECT_URI`.

### Flux `/oauth/authorize`

Validateur partagé (`validateAuthorizeRequest.ts`) utilisé identiquement par la page GET et le handler POST :
1. `client_id` ne correspond pas à `MONSITE_CLIENT_ID` → erreur fatale (pas de redirection — on ne connaît pas encore un `redirect_uri` de confiance).
2. `redirect_uri` ne correspond pas exactement à `MONSITE_REDIRECT_URI` → erreur fatale. **C'est la garde anti-open-redirect** : on ne redirige jamais vers un `redirect_uri` non enregistré.
3. `response_type !== "code"` ou `code_challenge_method` présent mais `!== "S256"` → redirection d'erreur (`redirect_uri` déjà validé, donc sûr).
4. Sinon OK.

`oauth/authorize/page.tsx` (Server Component, `searchParams` async) : si pas de session `idperso_session` → redirige vers `/oauth/login?return_to=<querystring original encodée>`. Si connecté → affiche un écran de consentement ("MONSITE souhaite accéder à : nom d'utilisateur, courriel") avec formulaire POST vers `oauth/authorize/decision` (champs cachés reprenant les paramètres OAuth, boutons Approuver/Refuser).

`oauth/authorize/decision/route.ts` (POST — **c'est ici, jamais au rendu GET, que le code est créé**, pour qu'un simple prefetch/reload de page ne mint pas de code) : revalide, exige la session, si "Refuser" → redirige vers `redirect_uri?error=access_denied&state=...`, si "Approuver" → crée le code d'autorisation et redirige vers `redirect_uri?code=...&state=...`.

### `/oauth/token` (POST)

Valide `client_id`/`client_secret`, consomme le code via `consumeAuthCode` (échoue proprement si déjà utilisé ou expiré → `invalid_grant`, **c'est le critère noté**), vérifie que `redirect_uri` correspond à celui de l'autorisation d'origine, vérifie PKCE (`SHA256(code_verifier) === code_challenge` stocké), puis émet un `access_token` et répond `{ access_token, token_type: "Bearer", expires_in, scope }` — forme JSON déjà attendue telle quelle par `exchangeCodeForToken` de MONSITE (aucune modification requise côté MONSITE, contrairement à GitHub qui demandait un header `Accept` spécial — ici JSON par défaut).

### `/oauth/userinfo` (GET, `Authorization: Bearer`)

Répond `{ sub, email, name, picture }` — forme identique à Google, donc le `mapUserInfo` d'IDPERSO côté MONSITE est trivial.

### Changements côté MONSITE (2 fichiers seulement)

`src/lib/oauth/providers/idperso.ts` (nouveau) — même forme que `google.ts`, `authorizationEndpoint`/`tokenEndpoint`/`userinfoEndpoint` construits depuis `IDPERSO_BASE_URL` (avec valeur par défaut `http://localhost:4000` via `process.env.IDPERSO_BASE_URL ?? "..."` plutôt que `requireEnv`, pour ne pas casser le build de la Partie 1 tant qu'IDPERSO n'est pas configuré), `usePkce: true`, `mapUserInfo` mappe `sub→providerAccountId`, `picture→avatarUrl`.

`src/lib/oauth/providers/index.ts` (édition) — ajoute l'entrée `idperso: idpersoProvider` au registre.

`login/page.tsx` affiche déjà le bouton "Se connecter avec IDPERSO" automatiquement (itère `listProviders()`) — aucune modification.

## Variables d'environnement

`idperso/.env` : `SESSION_SECRET` (indépendant), `MONSITE_CLIENT_ID=monsite`, `MONSITE_CLIENT_SECRET=<aléatoire>`, `MONSITE_REDIRECT_URI=http://localhost:3000/api/auth/idperso/callback`, `APP_BASE_URL=http://localhost:4000`, `AUTH_CODE_TTL_SECONDS=60`, `ACCESS_TOKEN_TTL_SECONDS=3600`.

`.env` de MONSITE, ajouts : `IDPERSO_CLIENT_ID=monsite`, `IDPERSO_CLIENT_SECRET=<même valeur que MONSITE_CLIENT_SECRET côté idperso>`, `IDPERSO_BASE_URL=http://localhost:4000`.

**Trois valeurs doivent être identiques caractère pour caractère entre les deux fichiers** (source n°1 de bugs `invalid_client`/mismatch de redirection en démo, faute d'enregistrement dynamique de client) : le client ID, le client secret, et `MONSITE_REDIRECT_URI` doit correspondre exactement à `${IDPERSO_BASE_URL}/api/auth/idperso/callback` calculé côté MONSITE.

## Fichiers à créer (ordre de construction)

1. `idperso/package.json`, `next.config.ts`, `tsconfig.json`, `.gitignore`, `.env.exemple` → `npm install` dans `idperso/`.
2. `idperso/src/lib/env.ts`, `src/lib/crypto/signedToken.ts` (copie de MONSITE).
3. `idperso/src/lib/session.ts`.
4. `idperso/src/lib/users/store.ts`.
5. `idperso/src/app/layout.tsx`, `globals.css`, `page.tsx`.
6. `idperso/src/app/register/page.tsx` + `register/submit/route.ts`.
7. `idperso/src/app/oauth/login/page.tsx` + `oauth/login/submit/route.ts`.
   → À ce stade : `npm run dev` dans `idperso/`, vérifier inscription + connexion en isolation sur `http://localhost:4000` avant de toucher à OAuth.
8. `idperso/src/lib/oauth/validateAuthorizeRequest.ts`.
9. `idperso/src/lib/store/authCodes.ts`, `accessTokens.ts`.
10. `idperso/src/app/oauth/authorize/page.tsx` + `oauth/authorize/decision/route.ts`.
11. `idperso/src/app/oauth/token/route.ts`.
12. `idperso/src/app/oauth/userinfo/route.ts`.
    → Vérifier le flux complet côté IDPERSO seul via curl (voir Vérification) avant de toucher à MONSITE.
13. MONSITE : `src/lib/oauth/providers/idperso.ts` (nouveau).
14. MONSITE : `src/lib/oauth/providers/index.ts` (enregistrement).
15. Ajouter les variables d'environnement des deux côtés, lancer les deux `npm run dev` en parallèle pour le test de bout en bout au navigateur.

## Vérification

**De bout en bout (navigateur)** : `npm run dev` dans `idperso/` (port 4000) et à la racine (port 3000) → `http://localhost:3000/login` → "Se connecter avec IDPERSO" → pas connecté sur IDPERSO → formulaire de connexion (s'inscrire d'abord si besoin) → écran de consentement nommant MONSITE → Approuver → atterrit sur `/profile` de MONSITE avec `provider: "idperso"`.

**Code non réutilisable / expiration (critère noté, via curl — plus fiable que le navigateur qui consomme le code automatiquement avant qu'on puisse le copier)** :
1. S'inscrire et capturer le cookie `idperso_session` (`curl -c jar.txt -X POST http://localhost:4000/register/submit ...`).
2. Approuver le consentement en tant qu'utilisateur connecté, capturer le `code` dans l'en-tête `Location` de la réponse (`curl -c jar.txt -b jar.txt -i -X POST http://localhost:4000/oauth/authorize/decision ...`).
3. Premier échange du code vers `/oauth/token` → doit réussir (`200`, `access_token` présent).
4. Rejouer exactement la même requête avec le même code → doit échouer (`400`, `{"error":"invalid_grant"}`).
5. Pour l'expiration : répéter l'étape 2 pour un nouveau code, réduire temporairement `AUTH_CODE_TTL_SECONDS` à `5` dans `idperso/.env` pour une démo rapide, attendre au-delà du délai, puis tenter l'échange → doit échouer dès la première tentative (`invalid_grant`).

**Build** : `npm run lint` et `npm run build` doivent passer sans erreur dans `idperso/` comme dans le dépôt racine.
