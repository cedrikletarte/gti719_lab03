# GTI719 — Laboratoire 3 : Module d'authentification

This repository contains two independent Next.js projects:

- **MONSITE** (repo root) — the OAuth2 *client* app (Part 1). Lets users sign in via Google, GitHub, or IDPERSO.
- **[idperso/](idperso/)** — a custom OAuth2 *identity provider* (Part 2) that MONSITE can also sign in through.

---

## Getting started

Each project has its own dependencies, `.env` file, and dev server (different ports), so you need to set up both.

### 1. Install dependencies

```bash
npm install
cd idperso && npm install
```

### 2. Configure environment variables

Copy each `.env.exemple` to `.env` and fill in the values (every variable is documented inline):

```bash
cp .env.exemple .env
cp idperso/.env.exemple idperso/.env
```

`SESSION_SECRET` in both files, and the shared `IDPERSO_CLIENT_ID` / `IDPERSO_CLIENT_SECRET` / `MONSITE_CLIENT_ID` / `MONSITE_CLIENT_SECRET` pairs between the two `.env` files, can be generated with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` come from registering OAuth apps with each provider — see below.

### 3. Run both dev servers

```bash
npm run dev          # MONSITE on http://localhost:3000
cd idperso && npm run dev   # IDPERSO on http://localhost:4000
```

Open [http://localhost:3000/login](http://localhost:3000/login).

---

## IDPERSO test account

IDPERSO stores its users in `idperso/data/users.json`, which is gitignored (local to each machine) — so there's no shared account. For consistency, use these credentials as the default test account when registering locally via [http://localhost:4000/register](http://localhost:4000/register):

- **Name:** `demo`
- **Email:** `demo@example.com`
- **Password:** `Demo1234!`

---

## Setting up Google OAuth credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and name it **gti719**.
3. In the left menu, go to **APIs & Services**.
4. Open **OAuth consent screen** and complete the initial configuration if prompted (keep it in **Testing** mode and add yourself as a test user — use a dedicated account, not your personal one).
5. Go to the **Clients** section and click **Create client**.
6. Configure the client:
   - **Application type:** Web application
   - **Authorized redirect URIs:** `http://localhost:3000/api/auth/google/callback`
7. Click **Create**.
8. Copy the generated **Client ID** and **Client Secret** into your local `.env`:
   ```env
   GOOGLE_CLIENT_ID=<your_client_id>
   GOOGLE_CLIENT_SECRET=<your_client_secret>
   ```

---

## Setting up GitHub OAuth credentials

1. Go to [GitHub](https://github.com/) with a dedicated account (not your personal one).
2. Open **Settings** → **Developer settings** → **OAuth Apps**.
3. Click **New OAuth App**.
4. Configure the app:
   - **Application name:** gti719
   - **Homepage URL:** `http://localhost:3000`
   - **Authorization callback URL:** `http://localhost:3000/api/auth/github/callback`
5. Click **Register application**.
6. Copy the generated **Client ID** and **Client Secret** into your local `.env`:
   ```env
   GITHUB_CLIENT_ID=<your_client_id>
   GITHUB_CLIENT_SECRET=<your_client_secret>
   ```
