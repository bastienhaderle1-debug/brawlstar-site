# Deployer Le Proxy Brawldex

Ce dossier sert a mettre le proxy Brawldex sur un petit serveur avec IP fixe, tout en laissant le front sur Vercel.

## Ce que tu dois faire

1. Prendre un petit VPS Linux avec une IP publique fixe.
2. Creer un sous-domaine pour le proxy, par exemple `api.ton-domaine.fr`.
3. Dans `developer.brawlstars.com`, creer une nouvelle cle API avec l'IP publique du VPS dans `Allowed IP Addresses`.
4. Copier le projet sur le serveur, installer Node.js puis lancer le proxy.
5. Mettre l'URL du proxy dans [runtime-config.js](../../data/runtime-config.js).
6. Redeployer le front sur Vercel.

## Ce que le repo te fournit deja

- le serveur proxy Node : [server.cjs](../../api/server.cjs)
- le service `systemd` : [brawldex-proxy.service](./brawldex-proxy.service)
- l'exemple d'environnement : [proxy.env.example](./proxy.env.example)
- la config Nginx : [brawldex-proxy.nginx.conf](./brawldex-proxy.nginx.conf)

## Checklist serveur

Sur un Ubuntu propre, installe le minimum :

```bash
sudo apt update
sudo apt install -y nginx curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Puis deploie le projet :

```bash
sudo mkdir -p /srv/brawldex
sudo chown $USER:$USER /srv/brawldex
git clone <ton-repo> /srv/brawldex
cd /srv/brawldex
npm install
```

## Variables d'environnement

Copie l'exemple puis mets ton vrai token :

```bash
sudo cp deploy/proxy/proxy.env.example /etc/brawldex-proxy.env
sudo nano /etc/brawldex-proxy.env
```

Contenu attendu :

```text
BRAWL_STARS_API_TOKEN=ton_nouveau_token_brawl_stars
BRAWLDEX_SKINS_SOURCE_MODE=remote-csv
BRAWLDEX_SKINS_SOURCE_URL=https://ton-catalogue.example.com/skins.csv
BRAWLDEX_SKINS_ASSET_BASE_URL=https://cdn.example.com/skins
HOST=127.0.0.1
PORT=3000
```

Important : revoque le token Brawl Stars expose plus tot et genere un nouveau token reserve au serveur.
Si tu laisses `BRAWLDEX_SKINS_SOURCE_URL` vide, le proxy utilisera l'URL distante par defaut embarquee dans le repo. Si la source distante tombe, le serveur renverra automatiquement le snapshot local.

## Lancer le proxy avec systemd

Copie le service puis active-le :

```bash
sudo cp deploy/proxy/brawldex-proxy.service /etc/systemd/system/brawldex-proxy.service
sudo systemctl daemon-reload
sudo systemctl enable --now brawldex-proxy
sudo systemctl status brawldex-proxy
```

Le proxy repondra alors localement sur `http://127.0.0.1:3000`.

## Brancher Nginx

Copie la config fournie puis adapte `server_name` :

```bash
sudo cp deploy/proxy/brawldex-proxy.nginx.conf /etc/nginx/sites-available/brawldex-proxy
sudo nano /etc/nginx/sites-available/brawldex-proxy
sudo ln -s /etc/nginx/sites-available/brawldex-proxy /etc/nginx/sites-enabled/brawldex-proxy
sudo nginx -t
sudo systemctl reload nginx
```

Ensuite ajoute le HTTPS avec Certbot sur ce domaine.

## Pointer le front Vercel vers le proxy

Dans [runtime-config.js](../../data/runtime-config.js), mets l'URL publique du proxy :

```js
window.BRAWLDEX_CONFIG = window.BRAWLDEX_CONFIG || {
  brawlApiBaseUrl: "https://api.ton-domaine.fr",
  skinsApiBaseUrl: "https://api.ton-domaine.fr"
};
```

Puis redeploie le front.

## Verifier

Teste le proxy publie :

```powershell
$env:BRAWLDEX_BASE_URL="https://api.ton-domaine.fr"
$env:BRAWL_STARS_TEST_TAG="#8VP9Q9LUU"
npm run smoke:live
```

Tu peux aussi verifier vite a la main :

```bash
curl https://api.ton-domaine.fr/api/brawl-health
curl "https://api.ton-domaine.fr/api/brawl-player?tag=%238VP9Q9LUU"
curl https://api.ton-domaine.fr/api/skins-catalog
```
