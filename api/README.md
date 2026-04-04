# Brawl Stars API Proxy

Le proxy serveur Brawldex vit dans [brawl-player.js](./brawl-player.js).
L'endpoint de statut rapide vit dans [brawl-health.js](./brawl-health.js).

## Variable Vercel requise

Configure cette variable d'environnement sur le projet Vercel :

```text
BRAWL_STARS_API_TOKEN
```

Sans elle, le dashboard affichera que le proxy existe mais la synchro echouera.

## Ce que fait le proxy

- valide le tag joueur avec l'alphabet Brawl Stars `0289PYLQGRJCUV`
- normalise `O` en `0` pour les erreurs de saisie les plus frequentes
- interroge l'API officielle via un endpoint serveur
- renvoie un payload propre pour le front Brawldex
- coupe les appels trop lents au bout de 10 secondes
- expose un endpoint `/api/brawl-health` pour que l'accueil et le dashboard sachent si le proxy est configure

## Smoke test local

Installe les dependances Node puis lance :

```powershell
npm install
npm run smoke:api
```

Le smoke test verifie toujours :

- l'erreur attendue si `BRAWL_STARS_API_TOKEN` manque
- le statut `missing_token` sur `/api/brawl-health`
- le statut `ready` si un token existe
- le rejet propre d'un tag invalide

Si tu veux verifier un vrai appel complet, ajoute aussi :

```powershell
$env:BRAWL_STARS_API_TOKEN="ton-token"
$env:BRAWL_STARS_TEST_TAG="#P0LY8Q2"
npm run smoke:api
```

Avec un vrai token + un vrai tag, le script valide la reponse normalisee du proxy.

## Monter un proxy separe du front Vercel

Tu peux laisser le front sur Vercel et deplacer uniquement le proxy API ailleurs.

Le repo contient deja un petit serveur Node dedie :

```powershell
npm install
$env:BRAWL_STARS_API_TOKEN="ton-token"
npm run serve:proxy
```

Ce serveur expose :

- `/api/brawl-health`
- `/api/brawl-player`

Le client front peut viser un proxy externe grace a [runtime-config.js](../data/runtime-config.js).

Par defaut :

```js
window.BRAWLDEX_CONFIG = window.BRAWLDEX_CONFIG || {
  brawlApiBaseUrl: ""
};
```

Pour pointer vers un backend externe, mets l'URL du proxy :

```js
window.BRAWLDEX_CONFIG = window.BRAWLDEX_CONFIG || {
  brawlApiBaseUrl: "https://ton-proxy.example.com"
};
```

Un kit de deploiement minimal est pret dans [deploy/proxy](../deploy/proxy/README.md).

## Check de deploy public

Quand ton proxy est en ligne :

```powershell
$env:BRAWLDEX_BASE_URL="https://ton-proxy.example.com"
$env:BRAWL_STARS_TEST_TAG="#8VP9Q9LUU"
npm run smoke:live
```
