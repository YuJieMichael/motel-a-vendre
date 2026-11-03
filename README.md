# Motel à vendre

Site spécialisé dans les motels et hôtels à vendre au Québec, en français, anglais et chinois. Le français est la langue d’entrée. Version source : **1.8.0**.

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
npm run test:backend
```

Les tests du Worker et du catalogue simulent les appels externes. Les tests du backend utilisent un client de base de données simulé. Ces commandes n’envoient aucun courriel et ne déploient rien. GitHub Actions exécute ces mêmes vérifications.

## Organisation du code

| Dossier ou fichier | Rôle |
| --- | --- |
| `templates/`, `i18n.js`, `lib/` | Rendu partagé et contenus FR/EN/ZH |
| `app.js`, `*.css`, `assets/` | Interface, styles, logo et images |
| `data/catalogue.json` | Instantané des seules annonces publiques |
| `data/site-config.js` | Domaines et clé navigateur publique |
| `deployment/` | Sources du Cloudflare Worker et politiques de publication |
| `scripts/` | Construction, import public et préparation de publication |
| `supabase/functions/` | Interface de consultation et statistiques séparées |
| `supabase/migrations/` | Extension SQL Motel de la plateforme existante |
| `supabase-account/migrations/` | Espace compte : projet Supabase séparé (voir OPERATIONS.md) |
| `lib/account-core.js`, `account.js` | Client et page « Mon compte » |
| `tests/`, `supabase/tests/` | Tests du site, du Worker et de l’interface serveur |

Les pages HTML et les fichiers de données générés sont conservés pour permettre l’aperçu immédiat d’un téléchargement. Après une modification de contenu ou de modèle, exécuter `npm run build` et inclure les fichiers générés mis à jour dans le commit. `dist/` et `release/` restent des résultats de construction ignorés par Git.

## Production et données

Le Worker autonome `motel-a-vendre` sert le domaine canonique et redirige `www`. Il actualise le catalogue public lors des visites, avec un cache normal de cinq minutes, et produit le sitemap à partir des annonces courantes. Il ne lit aucune donnée de contact privée. Les images d’illustration sont identifiées ; les photos confidentielles ne sont pas incluses.

`npm run prepare:release` prépare un candidat dans `release/`, sans déploiement. Il conserve par défaut le relais vers le site principal pour les demandes. La préparation avec `--direct-enquiries` vérifie les permissions CORS et le rejet d’un corps vide avant d’activer la collecte directe ; voir [les notes d’exploitation](docs/OPERATIONS.md).

Les identifiants de compte, clés serveur, fichiers `.env`, courriels et preuves privées de réception sont exclus. La clé `sb_publishable_…` de `data/site-config.js` est volontairement destinée au navigateur ; elle ne donne pas accès aux tables privées.

## English

Independent FR/EN/ZH Québec motel and hotel website, with French as the default language. Use Node.js 24+, then `npm run build` and `npm start`. Run `npm test` and `npm run test:backend` to verify the frontend, Worker and mocked backend. No package installation is required. Hosting and database deployment are manual; pushing to this repository does not publish the website.

The Supabase migration extends the existing main-site schema; it is not a complete standalone database setup. Deployment dependencies and environment variable names are documented in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## 中文

Motel à vendre 独立网站源码，法语默认，支持英语和中文。安装 Node.js 24 或以上版本，执行 `npm run build`、`npm start`，即可在本地预览。执行 `npm test` 和 `npm run test:backend` 验证网站、Worker 与后台接口。

本仓库包含前端、图片、Cloudflare 部署源码、Supabase 后台接口与增量数据库迁移。GitHub 只运行验证，上传或推送不会自动更新正式网站。后台沿用主站已有询盘收集和通知服务，详细依赖见运维说明。
