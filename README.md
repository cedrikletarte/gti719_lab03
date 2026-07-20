# GTI719 — Laboratoire 3 : Module d’authentification

Ce dépôt regroupe deux applications Next.js indépendantes :

- **MONSITE** : Joue le rôle de client OAuth2 et permet une connexion via les IdP Google, GitHub ou IDPERSO. Présent à la racine du projet.
- **IDPERSO** : Un fournisseur d’identité OAuth2 personnalisé que MONSITE peut utiliser comme source d’authentification. Présent dans le sous-dossier `idperso/` du projet.

---

## Table des matières

- [GTI719 — Laboratoire 3 : Module d’authentification](#gti719--laboratoire-3--module-dauthentification)
  - [Table des matières](#table-des-matières)
  - [1. Structure du projet](#1-structure-du-projet)
  - [2. Prérequis](#2-prérequis)
  - [3. Vue d'ensemble](#3-vue-densemble)
  - [4. Installation](#4-installation)
  - [5. Configuration](#5-configuration)
  - [6. Démarrage](#6-démarrage)
  - [7. Compte de test IDPERSO](#7-compte-de-test-idperso)
  - [8. Configuration OAuth Google](#8-configuration-oauth-google)
  - [9. Configuration OAuth GitHub](#9-configuration-oauth-github)
  - [10. Validation](#10-validation)
  - [11. Remarques](#11-remarques)
  - [12. Ressources](#12-ressources)

---

## 1. Structure du projet

L'arborescence suivante présente les fichiers du projet.

```text
GTI719_Lab3/                                # Racine du projet
├── README.md                               # Présentation du projet
├── docs/                                   # Documentation du projet
│   ├── diagrams/                           # Images générées des diagrammes
│   ├── diagram_class.puml                  # Diagramme de classes
│   ├── diagram_sequence_google.puml        # Diagramme de séquence
│   ├── diagram_sequence_github.puml        # Diagramme de séquence
│   ├── diagram_sequence_idperso.puml       # Diagramme de séquence
│   ├── GTI719_Laboratoire3_Statement.md    # Énoncé du projet au format Markdown
│   └── GTI719_Laboratoire3_Statement.pdf   # Énoncé du projet au format PDF
├── idperso/                                # Fournisseur d'identité OAuth2 personnalisé
│   └── src/                                # Code source du IdP personnalisé
├── public/                                 # Contient les fichiers statiques (images, CSS, JS)
├── src/                                    # Contient le code source de l'application MONSITE
│   ├── app/                                # Contient les composants React et les pages de l'application MONSITE
│   │   ├── api/                            # Contient les routes API de l'application MONSITE
│   │   ├── login/                          # Contient les pages de connexion de l'application MONSITE
│   │   ├── profile/                        # Contient les pages de profil de l'application MONSITE
│   │   ├── favicon.ico                     # Fichier favicon de l'application MONSITE
│   │   ├── globals.css                     # Fichier CSS global de l'application MONSITE
│   │   ├── layout.tsx                      # Composant de mise en page global de l'application MONSITE
│   │   └── page.tsx                        # Page d'accueil de l'application MONSITE
│   ├── lib/                                # Contient les bibliothèques et les utilitaires de l'application MONSITE
│   │   ├── crypto/                         # Contient les fonctions de cryptographie de l'application MONSITE
│   │   │   └── signedToken.ts              # Contient les fonctions de génération et de vérification de jetons signés pour l'application MONSITE
│   │   ├── oauth/                          # Contient les fonctions OAuth de l'application MONSITE
│   │   │   ├── providers/                  # Contient les implémentations des fournisseurs OAuth de l'application MONSITE
│   │   │   │   ├── google.ts               # Fournisseur OAuth Google pour l'application MONSITE
│   │   │   │   ├── github.ts               # Fournisseur OAuth GitHub pour l'application MONSITE
│   │   │   │   ├── idperso.ts              # Fournisseur OAuth IDPERSO pour l'application MONSITE
│   │   │   │   └── index.ts                # Export des fournisseurs OAuth pour l'application MONSITE
│   │   │   ├── client.ts                   # Fonctions de gestion du client OAuth pour l'application MONSITE
│   │   │   ├── pkce.ts                     # Fonctions de gestion du flux PKCE pour l'application MONSITE
│   │   │   ├── state.ts                    # Fonctions de gestion de l'état OAuth pour l'application MONSITE
│   │   │   └── types.ts                    # Types TypeScript pour les fonctions OAuth de l'application MONSITE
│   │   ├── env.ts                          # Contient les variables d'environnement de l'application MONSITE
│   │   └── session.ts                      # Contient les fonctions de gestion de session de l'application MONSITE
│   └── proxy.ts                            # Contient le proxy pour les requêtes API de l'application MONSITE
├── .env.exemple                            # Exemple de fichier de configuration pour MONSITE
├── eslint.config.js                        # Configuration ESLint pour MONSITE
├── next.config.js                          # Configuration Next.js pour MONSITE
├── package-lock.json                       # Fichier de verrouillage des dépendances pour MONSITE
├── package.json                            # Dépendances et scripts pour MONSITE
├── postcss.config.js                       # Configuration PostCSS pour MONSITE
└── tsconfig.json                           # Configuration TypeScript pour MONSITE
```             

---

## 2. Prérequis

- Node.js 18 ou plus récent
- npm 9 ou plus récent
- Deux terminaux pour exécuter les deux applications en parallèle

---

## 3. Vue d'ensemble

Le projet est divisé en deux parties distinctes, chacune avec ses propres dépendances, sa propre configuration et son propre serveur de développement.

| Projet  | Rôle                          | Port |
|---------|-------------------------------|------|
| MONSITE | Application cliente OAuth2    | 3000 |
| IDPERSO | Fournisseur d’identité OAuth2 | 4000 |

---

## 4. Installation

Chaque projet a ses propres dépendances, son propre fichier `.env` et son propre serveur de développement (ports différents). Il faut donc configurer les deux.

Installez les dépendances à la racine du projet, puis dans le dossier IDPERSO :

```bash
npm install
cd idperso && npm install
```

---

## 5. Configuration

Copiez les fichiers d’exemple `.env.exemple` vers leurs fichiers `.env` respectifs, puis complétez les valeurs manquantes :

```bash
cp .env.exemple .env
cp idperso/.env.exemple idperso/.env
```

Variables à renseigner :

- `SESSION_SECRET` dans les deux projets
- `IDPERSO_CLIENT_ID` et `IDPERSO_CLIENT_SECRET` dans MONSITE
- `MONSITE_CLIENT_ID` et `MONSITE_CLIENT_SECRET` dans IDPERSO
- `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET` dans MONSITE
- `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` dans MONSITE

Les secrets aléatoires robustes peuvent être générés avec la commande suivante :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` et `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` doivent être créés auprès de leurs fournisseurs respectifs.

---

## 6. Démarrage

Lancez les deux serveurs de développement dans deux terminaux séparés :

```bash
npm run dev                 # Lance MONSITE sur http://localhost:3000
cd idperso && npm run dev   # Lance IDPERSO sur http://localhost:4000
```

Ensuite, ouvrez [http://localhost:3000/login](http://localhost:3000/login).

---

## 7. Compte de test IDPERSO

IDPERSO stocke ses utilisateurs dans `idperso/data/users.json`. Ce fichier est ignoré par Git, donc chaque machine conserve ses propres comptes locaux.

Pour les tests, créez ce compte de référence via [http://localhost:4000/register](http://localhost:4000/register) :

- **Nom :** `demo`
- **Courriel :** `demo@example.com`
- **Mot de passe :** `Demo1234!`

---

## 8. Configuration OAuth Google

1. Ouvrir [Google Cloud Console](https://console.cloud.google.com/).
2. Créer un projet nommé **gti719**.
3. Dans le menu de gauche, aller dans **APIs & Services**.
4. Ouvrir **OAuth consent screen** et compléter la configuration initiale si demandé.Conserver le mode **Testing** et ajouter votre compte comme testeur (utiliser un compte dédié, pas un compte personnel).
5. Aller dans la section **Clients** et cliquer sur **Create client**.
6. Configurer le client :
   - **Application type :** Web application
   - **Authorized redirect URIs :** `http://localhost:3000/api/auth/google/callback`
7. Cliquer sur **Create**.
8. Copier le **Client ID** et le **Client Secret** générés dans le fichier `.env` local :

```env
GOOGLE_CLIENT_ID=<your_client_id>
GOOGLE_CLIENT_SECRET=<your_client_secret>
```

---

## 9. Configuration OAuth GitHub

1. Ouvrir [GitHub](https://github.com/) avec un compte dédié (pas de compte personnel).
2. Ouvrir **Settings** → **Developer settings** → **OAuth Apps**.
3. Cliquer sur **New OAuth App**.
4. Configurer l'application :
   - **Application name :** gti719
   - **Homepage URL :** `http://localhost:3000`
   - **Authorization callback URL :** `http://localhost:3000/api/auth/github/callback` 
5. Cliquer sur **Register application**.
6. Copier le **Client ID** et le **Client Secret** générés dans le fichier `.env` local :
   
```env
GITHUB_CLIENT_ID=<your_client_id>
GITHUB_CLIENT_SECRET=<your_client_secret>
```

---

## 10. Validation

Une fois la configuration terminée, vous pouvez vérifier le projet avec :

```bash
npm run lint
npm run build
cd idperso && npm run lint
cd idperso && npm run build
```

---

## 11. Remarques

- Ne partagez jamais les fichiers `.env` réels.
- Les données de `idperso/data/users.json` restent locales à la machine.

---

## 12. Ressources

- Google. Using OAuth 2.0 to Access Google APIs. https://developers.google.com/identity/protocols/oauth2
- Google. Google Sign-In JavaScript client reference. https://developers.google.com/identity/sign-in/web/reference#googleusergetbasicprofile
- Laravel. Lavarel Passport. https://laravel.com/docs/9.x/passport
- Laravel. Laravel 6 From Scratch. https://laracasts.com/series/laravel-6-from-scratch
- Clément Dumas. ÉTS - GTI719. Présentation laboratoire 3 - OAuth 2.0. Youtube. https://www.youtube.com/watch?v=UTmWmLz-TBk
