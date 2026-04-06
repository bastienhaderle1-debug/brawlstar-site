# Brawl Stars API Proxy

Le proxy serveur Brawldex vit dans [brawl-player.js](./brawl-player.js).
L'endpoint de statut rapide vit dans [brawl-health.js](./brawl-health.js).
L'endpoint du catalogue skins vit dans [skins-catalog.js](./skins-catalog.js).
Le chargeur partage pour la source distante + le fallback snapshot vit dans [skins-catalog-source.js](./skins-catalog-source.js).

## Variables Vercel

### Requise pour la synchro Brawl Stars

Configure cette variable d'environnement sur le projet Vercel :

```text
BRAWL_STARS_API_TOKEN
```

Sans elle, le dashboard affichera que le proxy existe mais la synchro echouera.

### Optionnelles pour le catalogue skins

Le catalogue skins peut etre servi par le proxy a partir d'une source distante CSV, puis retomber automatiquement sur [data/skins.json](../data/skins.json).

```text
BRAWLDEX_SKINS_SOURCE_MODE=remote-csv
BRAWLDEX_SKINS_SOURCE_URL=https://.../export.csv
BRAWLDEX_SKINS_ASSET_BASE_URL=https://cdn.example.com/skins
```

Par defaut :

- `BRAWLDEX_SKINS_SOURCE_MODE` vaut `remote-csv`
- `BRAWLDEX_SKINS_SOURCE_URL` retombe sur l'URL Google Sheets publiee deja presente dans le repo
- si la source distante echoue, le proxy sert automatiquement le snapshot local

## Ce que fait le proxy

- valide le tag joueur avec l'alphabet Brawl Stars `0289PYLQGRJCUV`
- normalise `O` en `0` pour les erreurs de saisie les plus frequentes
- interroge l'API officielle via un endpoint serveur
- renvoie un payload propre pour le front Brawldex
- coupe les appels trop lents au bout de 10 secondes
- expose un endpoint `/api/brawl-health` pour que l'accueil et le dashboard sachent si le proxy est configure
- expose un endpoint `/api/skins-catalog` pour servir le catalogue skins cote serveur
- recharge le catalogue distant cote serveur puis bascule sur le snapshot local si la source tombe

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
- le mode snapshot local pour `/api/skins-catalog`
- le chargement d'une source CSV distante pour `/api/skins-catalog`
- le fallback snapshot si la source distante skins echoue

Si tu veux verifier un vrai appel complet, ajoute aussi :

```powershell
$env:BRAWL_STARS_API_TOKEN="ton-token"
$env:BRAWL_STARS_TEST_TAG="#P0LY8Q2"
npm run smoke:api
```

Avec un vrai token + un vrai tag, le script valide la reponse normalisee du proxy.

## Regenerer le snapshot skins

Pour ecraser [data/skins.json](../data/skins.json) avec la source distante actuellement configuree :

```powershell
npm run refresh:skins
```

Si tu veux utiliser une autre source :

```powershell
$env:BRAWLDEX_SKINS_SOURCE_MODE="remote-csv"
$env:BRAWLDEX_SKINS_SOURCE_URL="https://ton-catalogue.example.com/skins.csv"
npm run refresh:skins
```

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
- `/api/skins-catalog`

Le client front peut viser un proxy externe grace a [runtime-config.js](../data/runtime-config.js).

Par defaut :

```js
window.BRAWLDEX_CONFIG = window.BRAWLDEX_CONFIG || {
  brawlApiBaseUrl: "",
  skinsApiBaseUrl: ""
};
```

Pour pointer vers un backend externe, mets l'URL du proxy :

```js
window.BRAWLDEX_CONFIG = window.BRAWLDEX_CONFIG || {
  brawlApiBaseUrl: "https://ton-proxy.example.com",
  skinsApiBaseUrl: "https://ton-proxy.example.com"
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
