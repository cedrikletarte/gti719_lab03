# Procédure de validation complète du flux OAuth2

## Objectif
Valider le flux OAuth2 complet dans MONSITE avec Google, GitHub et IDPERSO, ainsi que les points de sécurité suivants :
1. Redirection vers le fournisseur
2. Retour avec un code d’autorisation
3. Échange du code contre un jeton d’accès
4. Accès à la ressource protégée
5. Persistance de la session après connexion
6. Code d’autorisation à usage unique
7. Expiration du code d’autorisation

---

## Prérequis
- Node.js et npm installés
- Deux terminaux PowerShell ouverts
- Variables d’environnement configurées dans `.env` à la racine
- Variables d’environnement configurées dans `idperso/.env`

---

## 1. Démarrer les serveurs

### Terminal 1 : MONSITE

```powershell
cd C:\Users\Erwan\Documents\GitHub\GTI719_Lab3
npm run dev
```

### Terminal 2 : IDPERSO

```powershell
cd C:\Users\Erwan\Documents\GitHub\GTI719_Lab3\idperso
npm run dev
```

### URLs/ports attendus
- **MONSITE** : `http://localhost:3000`
- **IDPERSO** : `http://localhost:4000`

---

## 2. Valider le flux OAuth2 complet avec Google

### 2.1 Étapes utilisateur
1. Ouvrir `http://localhost:3000/login`
2. Cliquer sur **Se connecter avec Google**
3. Se connecter au compte Google
4. Accepter l’accès
5. Vérifier le retour vers MONSITE
6. Vérifier l’accès à `/profile`

### 2.2 Comportement attendu
- MONSITE redirige vers Google
- Google affiche son écran d’authentification ou réutilise une session existante
- Le code d’autorisation revient dans l’URL de callback
- MONSITE échange ce code contre un token
- MONSITE appelle ensuite `/oauth/userinfo`
- La page `/profile` s’affiche correctement

### 2.3 Requêtes à observer dans DevTools
Dans l’onglet **Network** :
- `GET /api/auth/google/authorize`
- `GET https://accounts.google.com/...`
- `GET /api/auth/google/callback?code=...&state=...`
- `POST` vers le endpoint token Google
- `GET` vers le endpoint userinfo Google

### 2.4 Cookies à observer dans DevTools
Dans l’onglet **Application** :
- `monsite_session` sur `localhost:3000`
- éventuellement `monsite_oauth_state` pendant le flux de connexion

### 2.5 Validation de la session
1. Une fois connecté sur `/profile`, actualiser la page
2. Vérifier que la session est toujours active
3. Vérifier que l’utilisateur reste connecté sans devoir se reconnecter

### 2.6 Résultat attendu
- La page `/profile` reste accessible
- Le cookie de session est toujours présent
- La connexion persiste après rechargement

---

## 3. Valider le flux OAuth2 complet avec GitHub

### 3.1 Étapes utilisateur
1. Ouvrir `http://localhost:3000/login`
2. Cliquer sur **Se connecter avec GitHub**
3. Se connecter au compte GitHub
4. Autoriser l’application
5. Vérifier le retour vers MONSITE
6. Être redirigé vers `/profile`

### 3.2 Comportement attendu
- MONSITE redirige vers GitHub
- GitHub affiche son écran d’autorisation ou réutilise une session existante
- Le code d’autorisation revient dans l’URL de callback
- MONSITE échange ce code contre un token
- MONSITE appelle ensuite l’API utilisateur GitHub
- La page `/profile` s’affiche correctement

### 3.3 Requêtes à observer dans DevTools
Dans l’onglet **Network** :
- `GET /api/auth/github/authorize`
- `GET https://github.com/login/oauth/authorize`
- `GET /api/auth/github/callback?code=...&state=...`
- `POST` vers le endpoint token GitHub
- `GET` vers l’API utilisateur GitHub

### 3.4 Cookies à observer dans DevTools
Dans l’onglet **Application** :
- `monsite_session` sur `localhost:3000`
- éventuellement `monsite_oauth_state` pendant le flux de connexion

### 3.5 Validation de la session
1. Une fois connecté sur `/profile`, actualiser la page
2. Vérifier que la session est toujours active
3. Vérifier que l’utilisateur reste connecté sans devoir se reconnecter

### 3.6 Résultat attendu
- La page `/profile` reste accessible
- Le cookie de session est toujours présent
- La connexion persiste après rechargement

---

## 4. Valider le flux OAuth2 complet avec IDPERSO

### 4.1 Étapes utilisateur
1. Ouvrir `http://localhost:3000/login`
2. Cliquer sur **Se connecter avec IDPERSO**
3. Être redirigé vers `http://localhost:4000/oauth/authorize`
4. Se connecter avec le compte de test IDPERSO si nécessaire
5. Cliquer sur **Autoriser**
6. Être renvoyé vers MONSITE via `/api/auth/idperso/callback`
7. Être redirigé vers `/profile`

### 4.2 Comportement attendu
- MONSITE redirige vers IDPERSO
- IDPERSO affiche la page d’autorisation
- Le code d’autorisation est renvoyé dans l’URL de redirection
- MONSITE échange ce code contre un token
- MONSITE appelle ensuite `/oauth/userinfo`
- La page `/profile` s’affiche correctement

### 4.3 Requêtes à observer dans DevTools
Dans l’onglet **Network** :
- `GET /api/auth/idperso/authorize`
- `GET /oauth/authorize`
- `POST /oauth/authorize/decision`
- `GET /api/auth/idperso/callback?code=...&state=...`
- `POST /oauth/token`
- `GET /oauth/userinfo`

### 4.4 Cookies à observer dans DevTools
Dans l’onglet **Application** :
- `idperso_session` sur `localhost:4000`
- `monsite_session` sur `localhost:3000`
- éventuellement `monsite_oauth_state` pendant le flux de connexion

### 4.5 Validation de la session
1. Une fois connecté sur `/profile`, actualiser la page
2. Vérifier que la session est toujours active
3. Vérifier que l’utilisateur reste connecté sans devoir se reconnecter

### 4.6 Résultat attendu
- La page `/profile` reste accessible
- Le cookie de session est toujours présent
- La connexion persiste après rechargement

### 4.7 Validation du code d’autorisation à usage unique
Le code d’autorisation ne doit pouvoir être échangé qu’une seule fois contre un jeton.

#### Étapes
1. Refaire un login IDPERSO
2. Dans DevTools, ouvrir la requête `POST /oauth/authorize/decision`
3. Copier la valeur du header `Location`
4. Extraire la valeur du paramètre `code`
5. Envoyer une première requête `POST /oauth/token`
6. Rejouer exactement la même requête une deuxième fois

#### Résultat attendu
- Première requête : `200 OK`
- Deuxième requête : `400 Bad Request` avec `invalid_grant`

#### Exemple de commande
```powershell
curl.exe -i -X POST "http://localhost:4000/oauth/token" `
  -H "Content-Type: application/x-www-form-urlencoded" `
  --data-urlencode "grant_type=authorization_code" `
  --data-urlencode "client_id=monsite" `
  --data-urlencode "client_secret=TON_MONSITE_CLIENT_SECRET" `
  --data-urlencode "code=TON_CODE_AUTHORIZATION" `
  --data-urlencode "redirect_uri=http://localhost:3000/api/auth/idperso/callback" `
  --data-urlencode "code_verifier=TON_CODE_VERIFIER_PKCE"
```

### 4.8 Validation de l’expiration du code d’autorisation
Le code d’autorisation expiré doit être rejeté par IDPERSO.

#### Configuration temporaire
Dans `idperso/.env`, utiliser une durée courte :
```dotenv
AUTH_CODE_TTL_SECONDS=5
```

#### Étapes
1. Redémarrer IDPERSO après modification du fichier `.env`
2. Lancer un nouveau login IDPERSO
3. Récupérer le `code` d’autorisation
4. Attendre plus de 5 secondes
5. Envoyer la requête `POST /oauth/token`
6. Vérifier la réponse

#### Résultat attendu
- Réponse HTTP `400`
- Réponse JSON contenant `invalid_grant`
- Log serveur indiquant que le code est `expired`

### 4.9 Connexion avec un compte invalide
#### Étapes
1. Ouvrir `http://localhost:4000/oauth/login`
2. Saisir un nom d’utilisateur inexistant ou un mot de passe incorrect
3. Cliquer sur **Se connecter**

#### Résultat attendu
- Retour sur la page de connexion IDPERSO
- Affichage d’un message indiquant que le nom d’utilisateur ou le mot de passe est invalide
- Aucune session ne doit être créée

### 4.10 Création d’un compte IDPERSO
#### Étapes
1. Ouvrir `http://localhost:4000/register`
2. Saisir un nom d’utilisateur disponible
3. Saisir un courriel valide
4. Saisir un mot de passe respectant les contraintes
5. Cliquer sur **S’inscrire**

#### Résultat attendu
- Le compte est créé avec succès
- Une session IDPERSO est créée automatiquement
- L’utilisateur est redirigé vers la page demandée ou vers l’accueil prévu par le flux OAuth
- Le nouveau compte peut ensuite être utilisé dans la connexion IDPERSO

---

## 5. Validations supplémentaires

### 5.1 Refus de consentement
#### Étapes
1. Lancer un login avec Google, GitHub ou IDPERSO
2. Arriver sur la page d’autorisation du fournisseur
3. Cliquer sur **Refuser** au lieu de **Autoriser**

#### Résultat attendu
- Retour vers MONSITE avec une erreur d’autorisation
- La connexion n’est pas établie
- Aucun jeton d’accès ne doit être émis

### 5.2 Réutilisation du code d’autorisation
#### Étapes
1. Réaliser une connexion complète avec IDPERSO
2. Récupérer le `code` envoyé dans l’URL de callback
3. Exécuter une première requête `POST /oauth/token`
4. Rejouer exactement la même requête avec le même `code`

#### Résultat attendu
- Première requête : `200 OK`
- Deuxième requête : `400 Bad Request` avec `invalid_grant`

### 5.3 Code challenge / PKCE invalide
#### Étapes
1. Réaliser une connexion complète avec IDPERSO
2. Récupérer le `code` envoyé dans l’URL de callback
3. Exécuter une requête `POST /oauth/token` avec un `code_verifier` incorrect

#### Résultat attendu
- Réponse HTTP `400 Bad Request`
- Réponse JSON contenant `invalid_grant`
- Le code d’autorisation ne doit pas être accepté

## 6. Résumé des vérifications finales
À valider :
- le flux OAuth2 complet fonctionne avec Google
- le flux OAuth2 complet fonctionne avec GitHub
- le flux OAuth2 complet fonctionne avec IDPERSO
- les utilisateurs peuvent refuser le consentement
- un code d’autorisation ne peut pas être réutilisé
- un `code_verifier` incorrect est rejeté
- la session tient après connexion
- le code d’autorisation est à usage unique
- le code d’autorisation expiré est rejeté

## 7. Notes
- Le test d’usage unique et d’expiration est à faire sur IDPERSO, car c’est le fournisseur contrôlé par le projet
- Le code d’autorisation est transporté dans l’URL de callback via le paramètre `code`
- Le `code_verifier` PKCE est requis pour l’échange du code contre le token
