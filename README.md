# Motel à vendre

Site spécialisé dans les motels et hôtels à vendre au Québec, en français, anglais et chinois. Le français est la langue d’entrée. Version source : **1.11.0**.

Site public : [motelavendre.ca](https://motelavendre.ca/).

## Démarrage local

Installer Node.js **24 ou supérieur**, puis exécuter depuis ce dossier :

```sh
npm run build
npm start
```

Ouvrir `http://127.0.0.1:5173/fr/`, `/en/` ou `/zh/`. Aucune installation npm n’est nécessaire : le site et ses tests utilisent les modules natifs de Node.js. Le serveur écoute uniquement sur l’ordinateur local.

Les formulaires de l’aperçu autorisé sur le port 5173 valident les données sans enregistrer de demandes en production. L’aperçu porte une directive `noindex`.

## Vérification

```sh
npm run build
npm test
```

Les tests du Worker, du catalogue et de l’administration utilisent une base SQLite locale à la place de D1. Ces commandes n’envoient aucun courriel et ne déploient rien. GitHub Actions exécute ces mêmes vérifications.

## Organisation du code

| Dossier ou fichier | Rôle |
| --- | --- |
| `templates/`, `i18n.js`, `lib/` | Rendu partagé et contenus FR/EN/ZH |
| `app.js`, `*.css`, `assets/` | Interface, styles, logo et images |
| `data/catalogue.json` | Instantané de secours des annonces publiées |
| `data/site-config.js` | Domaines, comptes et réglages publics |
| `deployment/` | Sources du Cloudflare Worker et politiques de publication |
| `scripts/` | Construction et préparation de publication |
| `deployment/listings.mjs`, `deployment/metrics.mjs` | Annonces et photos (D1), premier mois gratuit, comptes de visites |
| `d1/migrations/`, `deployment/account-api.mjs` | Espace compte : base Cloudflare D1 et API `/api/account` (voir OPERATIONS.md) |
| `lib/account-core.js`, `account.js` | Client et page « Mon compte » |
| `tests/` | Tests du site, du Worker et de l’administration |

Les pages HTML et les fichiers de données générés sont conservés pour permettre l’aperçu immédiat d’un téléchargement. Après une modification de contenu ou de modèle, exécuter `npm run build` et inclure les fichiers générés mis à jour dans le commit. `dist/` et `release/` restent des résultats de construction ignorés par Git.

## Production et données

Le Worker autonome `motel-a-vendre` sert le domaine canonique et redirige `www`. Il lit les annonces dans sa propre base Cloudflare D1 (photos comprises), gérées dans l’espace administration, et produit le sitemap à partir des annonces publiées. Il ne lit aucune donnée de contact privée. Les images d’illustration sont identifiées ; les photos confidentielles ne sont pas incluses.

`npm run prepare:release` prépare un candidat dans `release/`, sans déploiement. Les demandes sont reçues par ce Worker (`/api/enquiry`) et stockées dans D1 ; voir [les notes d’exploitation](docs/OPERATIONS.md).

Les identifiants de compte, clés serveur, fichiers `.env`, courriels et preuves privées de réception sont exclus. Le site ne dépend d’aucune autre base de données.

## English

Independent FR/EN/ZH Québec motel and hotel website, with French as the default language. Use Node.js 24+, then `npm run build` and `npm start`. Run `npm test` to verify the frontend, Worker and admin API. No package installation is required. Pushing to `main` builds, tests and deploys the website through Cloudflare Workers Builds; other branches are only verified.

Listings, photos, enquiries, accounts and visit counts all live in Cloudflare D1; the site depends on no other database. Deployment steps and environment variable names are documented in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## 中文

Motel à vendre 独立网站源码，法语默认，支持英语和中文。安装 Node.js 24 或以上版本，执行 `npm run build`、`npm start`，即可在本地预览。执行 `npm test` 验证网站、Worker 与管理后台接口。

本仓库包含前端、图片、Cloudflare 部署源码和 D1 数据库迁移。房源、照片、咨询、账户和访问统计都保存在 Cloudflare 上，不依赖其他数据库。推送到 `main` 分支会通过 Cloudflare Workers Builds 自动构建、测试并发布正式网站；其他分支只运行 GitHub 验证。上线步骤见运维说明。
