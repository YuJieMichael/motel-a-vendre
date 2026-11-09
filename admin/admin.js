// Motel à vendre staff workspace. Wording follows the Propriété En Vente admin
// (frontend/src/admin.tsx, buyer-enquiries.tsx); layout and styles are this site's own console design, without a framework.
// Fully independent: staff accounts, enquiries and invitations live in this site's
// Cloudflare D1, behind /api/admin/* with an HttpOnly session cookie. Nothing else is called.
(function () {
'use strict';
const root = document.getElementById('admin-root');
const local = ['127.0.0.1', 'localhost'].includes(location.hostname);

// ---- Copy (wording follows the main admin and its buyer inbox) ----
const COPY = {
 fr: {
  title: 'Espace administration', eyebrow: 'MOTELAVENDRE · ÉQUIPE', intro: 'Traitez les demandes, les comptes acheteurs et l’affichage des annonces de Motel à vendre depuis un seul endroit.',
  back: 'Retour au site', login: 'Se connecter', loginTitle: 'Connectez-vous avec votre compte d’équipe', loginText: 'Cet espace est réservé aux membres autorisés de l’équipe Motel à vendre.',
  email: 'Courriel', password: 'Mot de passe', forgot: 'Première connexion ou mot de passe oublié ?', linkTitle: 'Recevoir un lien par courriel', linkText: 'Saisissez votre courriel d’équipe. Vous recevrez un lien pour choisir votre mot de passe (valide une heure).', sendLink: 'Envoyer le lien', linkSent: 'Si cette adresse fait partie de l’équipe, un courriel vient d’être envoyé. Utilisez le lien le plus récent.', setTitle: 'Choisissez votre mot de passe', setText: 'Au moins 10 caractères. Il sert uniquement à l’administration Motel à vendre.', newPassword: 'Nouveau mot de passe', confirmPassword: 'Confirmer le mot de passe', save: 'Enregistrer et se connecter', mismatch: 'Les deux mots de passe ne correspondent pas.', weak: 'Choisissez au moins 10 caractères, différents de votre courriel.', badLink: 'Ce lien est expiré, déjà utilisé ou remplacé. Demandez un nouveau lien.', rate: 'Trop de tentatives. Réessayez dans quelques minutes.', backToLogin: 'Retour à la connexion', badLogin: 'Courriel ou mot de passe incorrect.',
  noAccess: 'Accès réservé à l’équipe', noAccessText: 'Ce compte n’est pas un compte d’administration actif. Demandez une invitation au propriétaire de la plateforme.',
  setup: 'Connexion au serveur à configurer', setupText: 'La configuration du site ne contient pas l’adresse du service.', expired: 'Votre session a expiré. Connectez-vous de nouveau.',
  loading: 'Chargement…', work: 'Travail', management: 'Gestion', signOut: 'Se déconnecter', refresh: 'Actualiser', original: 'Administration Propriété En Vente',
  error: 'Impossible de charger les données. Réessayez après avoir vérifié votre connexion et vos droits d’accès.', unavailable: 'Service momentanément indisponible. Réessayez dans un instant.',
  previous: 'Précédent', next: 'Suivant', cancel: 'Annuler', saving: 'Enregistrement…', saveError: 'Enregistrement impossible. Les données ont été actualisées.',
  status: 'Rôle', audit: 'Journal des opérations', emptyAudit: 'Aucune opération à afficher.', date: 'Date', action: 'Opération', actor: 'Compte responsable', target: 'Élément',
  actions: { listing_create: 'Annonce créée', listing_update: 'Annonce modifiée', listing_publish: 'Annonce publiée', listing_unpublish: 'Annonce retirée', listing_renew: 'Annonce prolongée de 30 jours', listing_expire: 'Période gratuite terminée (retrait automatique)', staff_invite: 'Membre invité', staff_deactivate: 'Membre désactivé', staff_activate: 'Membre réactivé', staff_resend: 'Courriel renvoyé', staff_password: 'Mot de passe défini', enquiry_accept: 'Demande acceptée', enquiry_reopen: 'Demande remise à traiter', enquiry_delete: 'Demande supprimée', enquiry_restore: 'Demande restaurée', account_confirm: 'Compte confirmé manuellement', account_delete: 'Compte supprimé', listing_hide: 'Annonce masquée', listing_show: 'Annonce affichée', listing_pin: 'Annonce épinglée', listing_unpin: 'Annonce désépinglée' },
  local: 'Aperçu local : toutes les données viennent de la base locale de ce poste. Les courriels restent dans le journal local.',
  auditHint: 'Les 200 dernières opérations effectuées par l’équipe dans cet espace.', console: 'Administration', menu: 'Menu', staffArea: 'Espace réservé à l’équipe'
 },
 en: {
  title: 'Admin workspace', eyebrow: 'MOTELAVENDRE · TEAM', intro: 'Handle Motel à vendre enquiries, buyer accounts and listing display from one place.',
  back: 'Back to website', login: 'Sign in', loginTitle: 'Sign in with your team account', loginText: 'This area is reserved for authorized members of the Motel à vendre team.',
  email: 'Email', password: 'Password', forgot: 'First sign-in or forgot your password?', linkTitle: 'Get a link by email', linkText: 'Enter your team email. You will receive a link to choose your password (valid for one hour).', sendLink: 'Send link', linkSent: 'If this address is on the team, an email has just been sent. Use the most recent link.', setTitle: 'Choose your password', setText: 'At least 10 characters. It is used only for the Motel à vendre admin.', newPassword: 'New password', confirmPassword: 'Confirm password', save: 'Save and sign in', mismatch: 'The two passwords do not match.', weak: 'Use at least 10 characters, different from your email.', badLink: 'This link has expired, was already used or was replaced. Ask for a new link.', rate: 'Too many attempts. Try again in a few minutes.', backToLogin: 'Back to sign-in', badLogin: 'Incorrect email or password.',
  noAccess: 'Team access only', noAccessText: 'This account is not an active admin account. Ask the platform owner for an invitation.',
  setup: 'Server connection required', setupText: 'The site configuration has no service address.', expired: 'Your session expired. Please sign in again.',
  loading: 'Loading…', work: 'Work', management: 'Management', signOut: 'Sign out', refresh: 'Refresh', original: 'Propriété En Vente admin',
  error: 'Could not load data. Check your connection and access rights, then try again.', unavailable: 'Service temporarily unavailable. Try again shortly.',
  previous: 'Previous', next: 'Next', cancel: 'Cancel', saving: 'Saving…', saveError: 'Could not save. The data has been refreshed.',
  status: 'Role', audit: 'Activity log', emptyAudit: 'No activity to show.', date: 'Date', action: 'Action', actor: 'Account', target: 'Item',
  actions: { listing_create: 'Listing created', listing_update: 'Listing edited', listing_publish: 'Listing published', listing_unpublish: 'Listing unpublished', listing_renew: 'Listing extended by 30 days', listing_expire: 'Free period ended (removed automatically)', staff_invite: 'Staff invited', staff_deactivate: 'Member deactivated', staff_activate: 'Member reactivated', staff_resend: 'Email resent', staff_password: 'Password set', enquiry_accept: 'Enquiry accepted', enquiry_reopen: 'Enquiry marked pending', enquiry_delete: 'Enquiry deleted', enquiry_restore: 'Enquiry restored', account_confirm: 'Account confirmed manually', account_delete: 'Account deleted', listing_hide: 'Listing hidden', listing_show: 'Listing shown', listing_pin: 'Listing pinned', listing_unpin: 'Listing unpinned' },
  local: 'Local preview: all data comes from this computer’s local database. Emails stay in the local log.',
  auditHint: 'The most recent actions taken by the team in this workspace.', console: 'Admin', menu: 'Menu', staffArea: 'Team-only area'
 },
 zh: {
  title: '管理工作台', eyebrow: 'MOTELAVENDRE · 团队', intro: '在同一个入口处理 Motel à vendre 的买家咨询、买家账户和房源展示。',
  back: '返回网站', login: '登录', loginTitle: '使用团队账号登录', loginText: '此区域仅向 Motel à vendre 授权团队成员开放。',
  email: '邮箱', password: '密码', forgot: '首次登录或忘记密码？', linkTitle: '通过邮件获取链接', linkText: '输入您的团队邮箱，我们会发送一个设置密码的链接（1 小时内有效）。', sendLink: '发送链接', linkSent: '如果这是团队成员的邮箱，邮件已经发出。请使用最新的一封。', setTitle: '设置您的密码', setText: '至少 10 个字符，只用于 Motel à vendre 管理后台。', newPassword: '新密码', confirmPassword: '确认密码', save: '保存并登录', mismatch: '两次输入的密码不一致。', weak: '请至少使用 10 个字符，并且不要和邮箱相同。', badLink: '链接已过期、已使用或已被新链接取代。请重新获取链接。', rate: '尝试次数过多，请几分钟后再试。', backToLogin: '返回登录', badLogin: '邮箱或密码不正确。',
  noAccess: '仅限授权团队成员', noAccessText: '此账号不是有效的管理员账号。请向平台所有者申请邀请。',
  setup: '需要配置后端连接', setupText: '网站配置中缺少服务地址。', expired: '登录已过期，请重新登录。',
  loading: '加载中…', work: '工作', management: '管理', signOut: '退出登录', refresh: '刷新', original: 'Propriété En Vente 主站后台',
  error: '无法加载资料。请检查网络和账号权限后重试。', unavailable: '服务暂时不可用，请稍后再试。',
  previous: '上一页', next: '下一页', cancel: '取消', saving: '正在保存…', saveError: '保存失败，已重新获取最新数据。',
  status: '角色', audit: '操作记录', emptyAudit: '暂无操作记录。', date: '时间', action: '操作', actor: '操作账号', target: '对象',
  actions: { listing_create: '新建房源', listing_update: '修改房源', listing_publish: '发布房源', listing_unpublish: '下架房源', listing_renew: '房源续期 30 天', listing_expire: '免费期结束（自动下架）', staff_invite: '邀请团队成员', staff_deactivate: '停用成员', staff_activate: '重新启用成员', staff_resend: '重新发送邮件', staff_password: '设置密码', enquiry_accept: '通过咨询', enquiry_reopen: '咨询改为待处理', enquiry_delete: '删除咨询', enquiry_restore: '恢复咨询', account_confirm: '手动确认账户', account_delete: '删除账户', listing_hide: '隐藏房源', listing_show: '显示房源', listing_pin: '置顶房源', listing_unpin: '取消置顶' },
  local: '本地预览：所有数据来自本机的本地数据库，邮件只写入本地日志。',
  auditHint: '团队成员在后台中最近的操作记录。', console: '管理后台', menu: '菜单', staffArea: '仅限团队成员'
 }
};
// Buyer inbox copy: Propriété En Vente buyer-enquiries.tsx, with Motel seller fields added.
const INBOX = {
 en: { title: 'Buyer enquiries', hint: 'Buyer and seller enquiries sent from motelavendre.ca. Each new enquiry is also emailed to the owner.', autoRefresh: 'Updates automatically every 15 seconds and when you return to this page.', loading: 'Loading…', error: 'Could not sync enquiries. The system will retry automatically.', empty: 'No enquiries yet.', date: 'Submitted', name: 'Name', email: 'Email', phone: 'Phone', city: 'Preferred cities', min: 'Minimum budget (CAD)', max: 'Maximum budget (CAD)', expectedPrice: 'Expected price (CAD)', address: 'Address', requirements: 'Requirements', timeline: 'Timeline', contactLanguage: 'Contact language', contactMethod: 'Contact method', contactTime: 'Contact availability', details: 'View request', seller: 'Seller', buyer: 'Buyer' },
 fr: { title: 'Demandes d’achat', hint: 'Demandes d’acheteurs et de vendeurs envoyées depuis motelavendre.ca. Chaque nouvelle demande est aussi envoyée par courriel au propriétaire.', autoRefresh: 'Mise à jour automatique toutes les 15 secondes et à votre retour sur la page.', loading: 'Chargement…', error: 'Impossible de synchroniser les demandes. Une nouvelle tentative sera faite automatiquement.', empty: 'Aucune demande pour le moment.', date: 'Date de réception', name: 'Nom', email: 'Courriel', phone: 'Téléphone', city: 'Villes recherchées', min: 'Budget minimum (CAD)', max: 'Budget maximum (CAD)', expectedPrice: 'Prix souhaité (CAD)', address: 'Adresse', requirements: 'Critères', timeline: 'Échéancier', contactLanguage: 'Langue de contact', contactMethod: 'Moyen de contact', contactTime: 'Disponibilités', details: 'Voir la demande', seller: 'Vendeur', buyer: 'Acheteur' },
 zh: { title: '买家咨询', hint: '在 motelavendre.ca 提交的买家和卖家咨询。每条新咨询也会同时发邮件给所有者。', autoRefresh: '每 15 秒自动同步；返回此页面时也会立即更新。', loading: '正在加载…', error: '咨询暂时无法同步，系统会自动重试。', empty: '目前还没有咨询。', date: '提交时间', name: '姓名', email: '邮箱', phone: '电话', city: '意向城市', min: '最低预算（加元）', max: '最高预算（加元）', expectedPrice: '期望售价（加元）', address: '地址', requirements: '购房要求', timeline: '计划时间', contactLanguage: '联系语言', contactMethod: '联系方式', contactTime: '方便联系的时间', details: '查看需求', seller: '卖家', buyer: '买家' }
};
const ACTION = {
 en: { active: 'All active', pending: 'Pending', accepted: 'Accepted', deleted: 'Deleted', accept: 'Accept', remove: 'Delete', restore: 'Restore', reopen: 'Mark pending', confirm: 'Move this enquiry to Deleted? You can restore it later. Existing email summaries are retained.', yes: 'Confirm delete', cancel: 'Keep enquiry', saving: 'Saving…', error: 'Could not save. The enquiry may have changed; its latest status has been loaded.' },
 fr: { active: 'Toutes les actives', pending: 'À traiter', accepted: 'Acceptées', deleted: 'Supprimées', accept: 'Accepter', remove: 'Supprimer', restore: 'Restaurer', reopen: 'Remettre à traiter', confirm: 'Déplacer cette demande vers les demandes supprimées ? Vous pourrez la restaurer. Les récapitulatifs déjà créés sont conservés.', yes: 'Confirmer la suppression', cancel: 'Conserver', saving: 'Enregistrement…', error: 'Enregistrement impossible. La demande a peut-être changé; son état a été actualisé.' },
 zh: { active: '全部有效', pending: '待处理', accepted: '已通过', deleted: '已删除', accept: '通过', remove: '删除', restore: '恢复', reopen: '改为待处理', confirm: '将这条咨询移入已删除列表？之后可以恢复，已生成的邮件汇总会保留。', yes: '确认删除', cancel: '保留咨询', saving: '正在保存…', error: '保存失败，咨询可能已被更新；已重新获取最新状态。' }
};
const PROPERTY = {
 en: { heading: 'Requested property', general: 'General enquiry', unavailable: 'Property unavailable — reference retained', unpublished: 'Address not published', view: 'View property', recovered: 'Recovered from current listing; original enquiry price unknown.', export: 'Export this page (CSV)', noDetails: 'No additional requirements provided.', nda: 'NDA request · manual review' },
 fr: { heading: 'Propriété demandée', general: 'Demande générale', unavailable: 'Propriété indisponible — référence conservée', unpublished: 'Adresse non publiée', view: 'Voir la propriété', recovered: 'Récupéré de l’annonce actuelle; prix au moment de la demande inconnu.', export: 'Exporter cette page (CSV)', noDetails: 'Aucun critère supplémentaire fourni.', nda: 'Demande NDA · examen manuel' },
 zh: { heading: '咨询房源', general: '通用找房咨询', unavailable: '房源暂不可用，原编号已保留', unpublished: '地址未公开', view: '查看房源', recovered: '依据当前房源补充；咨询当时的价格未知。', export: '导出本页（CSV）', noDetails: '暂无补充需求。', nda: 'NDA 资料申请 · 人工核验' }
};
const ACCOUNTS = {
 en: { title: 'Buyer accounts', hint: 'Accounts created on motelavendre.ca. Unconfirmed accounts are removed automatically after 7 days.', search: 'Search by email, name or phone', all: 'All', verified: 'Confirmed', unverified: 'Not confirmed', total: 'Accounts', confirmedCount: 'Confirmed', empty: 'No matching accounts.', person: 'Account', status: 'Status', created: 'Created', lastSignin: 'Last sign-in', activity: 'Saved · searches · enquiries', actions: 'Actions', confirmBtn: 'Confirm manually', deleteBtn: 'Delete', confirmDelete: 'Permanently delete {email}? Their profile, saved listings, saved searches and enquiry history are erased. This cannot be undone.', yes: 'Delete permanently', confirmed: 'Account confirmed. The buyer can sign in now.', deleted: 'Account deleted.', never: 'Never', budget: 'Budget', regions: 'Regions', saved: 'Saved listings', searches: 'Saved searches', enquiries: 'Enquiries' },
 fr: { title: 'Comptes acheteurs', hint: 'Comptes créés sur motelavendre.ca. Les comptes non confirmés sont supprimés automatiquement après 7 jours.', search: 'Rechercher par courriel, nom ou téléphone', all: 'Tous', verified: 'Confirmés', unverified: 'Non confirmés', total: 'Comptes', confirmedCount: 'Confirmés', empty: 'Aucun compte correspondant.', person: 'Compte', status: 'État', created: 'Création', lastSignin: 'Dernière connexion', activity: 'Favoris · recherches · demandes', actions: 'Actions', confirmBtn: 'Confirmer manuellement', deleteBtn: 'Supprimer', confirmDelete: 'Supprimer définitivement {email} ? Le profil, les favoris, les recherches et l’historique des demandes seront effacés. Action irréversible.', yes: 'Supprimer définitivement', confirmed: 'Compte confirmé. L’acheteur peut maintenant se connecter.', deleted: 'Compte supprimé.', never: 'Jamais', budget: 'Budget', regions: 'Régions', saved: 'Favoris', searches: 'Recherches enregistrées', enquiries: 'Demandes' },
 zh: { title: '买家账户', hint: '在 motelavendre.ca 注册的账户。未确认邮箱的账户会在 7 天后自动删除。', search: '按邮箱、姓名或电话搜索', all: '全部', verified: '已确认', unverified: '未确认', total: '账户总数', confirmedCount: '已确认', empty: '没有符合条件的账户。', person: '账户', status: '状态', created: '注册时间', lastSignin: '最近登录', activity: '收藏 · 搜索 · 咨询', actions: '操作', confirmBtn: '手动确认', deleteBtn: '删除', confirmDelete: '永久删除 {email}？其资料、收藏、保存的搜索和咨询记录都会被清除，无法恢复。', yes: '永久删除', confirmed: '账户已确认，买家现在可以登录了。', deleted: '账户已删除。', never: '从未', budget: '预算', regions: '意向地区', saved: '收藏房源', searches: '保存的搜索', enquiries: '咨询' }
};
const LISTINGS = {
 en: { title: 'Listings', hint: 'Hotels and motels on motelavendre.ca. Listings, photos and settings are stored on this site only.', delay: 'Changes appear on the public site within one minute.', empty: 'No listings yet.', ref: 'Listing', place: 'Location', price: 'Price', photos: 'Photos', status: 'Status', state: 'On the site', actions: 'Actions', shown: 'Shown', hidden: 'Hidden', pinned: 'Pinned', illustrative: 'Illustration', hide: 'Hide', show: 'Show', pin: 'Pin to top', unpin: 'Unpin', view: 'View', counts: '{shown} shown · {hidden} hidden · {pinned} pinned', statTotal: 'Listings', statShown: 'Published', statHidden: 'Drafts', statPinned: 'Free until…',
  draft: 'Draft', published: 'Published', expired: 'Expired', freeUntil: 'Free until {date}', add: 'New listing', edit: 'Edit', publish: 'Publish', unpublish: 'Unpublish', renew: 'Extend 30 days',
  editTitle: 'Edit listing #{ref}', newTitle: 'New listing', back: 'Back to listings', save: 'Save', saved: 'Saved.', type: 'Type', types: { motel: 'Motel', hotel: 'Hotel', inn: 'Inn', 'hotel-motel': 'Hotel / motel' },
  city: 'City', region: 'Region (optional, set from the city)', priceField: 'Asking price (CAD)', rooms: 'Guest rooms', acres: 'Land (acres)', parking: 'Parking spaces', season: 'Operation', seasons: { unknown: 'Not specified', 'year-round': 'Year-round', seasonal: 'Seasonal' }, freehold: 'Freehold (land included)', illustrativeField: 'The photos are illustrations, not the actual property',
  copyTitle: 'Text', copyHint: 'French is required. English and Chinese are optional: when empty, the French text is shown.', short: 'Summary (1–2 sentences)', description: 'Description', features: 'Highlights (one per line, up to 12)',
  photosTitle: 'Photos', photosHint: 'The first photo is the cover. Photos are converted to WebP in your browser (max. 1600 px) before upload.', photosFirst: 'Save the listing once before adding photos.', addPhotos: 'Add photos', uploading: 'Uploading {n}…', up: 'Move up', down: 'Move down', remove: 'Remove', noPhotos: 'No photos yet. A listing needs at least one photo to be published.',
  sellerTitle: 'Seller and free first month', sellerHint: 'Private: never shown on the site. Used for the reminder 7 days before the free period ends and the notice when the listing is removed.', sellerName: 'Seller name', sellerEmail: 'Seller email', sellerLang: 'Email language', free: 'Free first month: publish for 30 days, then remove automatically (no charge)', freeNote: 'The 30 days start when the listing is published.',
  errors: { missing_short: 'Add a French summary.', missing_description: 'Add a French description.', missing_city: 'Add the city.', invalid_type: 'Choose a type.', missing_seller_email: 'A free listing needs the seller’s email (for the reminder).', invalid_seller_email: 'Check the seller’s email.', photo_required: 'Add at least one photo before publishing.', renew_required: 'This free listing expired: use “Extend 30 days”.', revision_conflict: 'Someone else changed this listing. The list was refreshed.', photo_too_large: 'Photo too large (2 MB max after conversion).', photo_format: 'Unsupported photo format.', too_many_photos: 'Up to 30 photos per listing.', photos_unavailable: 'Photo storage is not set up yet.', invalid_photo: 'A photo path is not valid.' },
  statsTitle: 'Visits', statsHint: 'Aggregate counts for the last 30 days: no names, emails or addresses are recorded.', pageViews: 'Page views', propertyViews: 'Listing views', guideViews: 'Guide views', sources: 'Sources', topListings: 'Most viewed listings', noStats: 'No visits recorded yet.' },
 fr: { title: 'Annonces', hint: 'Hôtels et motels sur motelavendre.ca. Les annonces, photos et réglages sont stockés sur ce site uniquement.', delay: 'Les changements apparaissent sur le site public en moins d’une minute.', empty: 'Aucune annonce pour l’instant.', ref: 'Annonce', place: 'Lieu', price: 'Prix', photos: 'Photos', status: 'Statut', state: 'Sur le site', actions: 'Actions', shown: 'Affichée', hidden: 'Masquée', pinned: 'Épinglée', illustrative: 'Illustration', hide: 'Masquer', show: 'Afficher', pin: 'Épingler en tête', unpin: 'Désépingler', view: 'Voir', counts: '{shown} affichées · {hidden} masquées · {pinned} épinglées', statTotal: 'Annonces', statShown: 'Publiées', statHidden: 'Brouillons', statPinned: 'Gratuites',
  draft: 'Brouillon', published: 'Publiée', expired: 'Expirée', freeUntil: 'Gratuite jusqu’au {date}', add: 'Nouvelle annonce', edit: 'Modifier', publish: 'Publier', unpublish: 'Retirer', renew: 'Prolonger de 30 jours',
  editTitle: 'Modifier l’annonce no {ref}', newTitle: 'Nouvelle annonce', back: 'Retour aux annonces', save: 'Enregistrer', saved: 'Enregistré.', type: 'Type', types: { motel: 'Motel', hotel: 'Hôtel', inn: 'Auberge', 'hotel-motel': 'Hôtel / motel' },
  city: 'Ville', region: 'Région (facultatif, déduite de la ville)', priceField: 'Prix demandé ($ CA)', rooms: 'Chambres', acres: 'Terrain (acres)', parking: 'Places de stationnement', season: 'Exploitation', seasons: { unknown: 'Non précisée', 'year-round': 'À l’année', seasonal: 'Saisonnière' }, freehold: 'Propriété (terrain inclus)', illustrativeField: 'Les photos sont des illustrations, pas la propriété réelle',
  copyTitle: 'Textes', copyHint: 'Le français est obligatoire. L’anglais et le chinois sont facultatifs : vides, le texte français est affiché.', short: 'Résumé (1 à 2 phrases)', description: 'Description', features: 'Points forts (un par ligne, 12 au maximum)',
  photosTitle: 'Photos', photosHint: 'La première photo sert de couverture. Les photos sont converties en WebP dans votre navigateur (1600 px max.) avant l’envoi.', photosFirst: 'Enregistrez l’annonce une première fois avant d’ajouter des photos.', addPhotos: 'Ajouter des photos', uploading: 'Envoi de {n}…', up: 'Monter', down: 'Descendre', remove: 'Retirer', noPhotos: 'Aucune photo. Une annonce doit avoir au moins une photo pour être publiée.',
  sellerTitle: 'Vendeur et premier mois gratuit', sellerHint: 'Privé : jamais affiché sur le site. Sert au rappel envoyé 7 jours avant la fin de la période gratuite et à l’avis de retrait.', sellerName: 'Nom du vendeur', sellerEmail: 'Courriel du vendeur', sellerLang: 'Langue des courriels', free: 'Premier mois gratuit : publiée 30 jours, puis retirée automatiquement (sans frais)', freeNote: 'Les 30 jours commencent à la publication.',
  errors: { missing_short: 'Ajoutez un résumé en français.', missing_description: 'Ajoutez une description en français.', missing_city: 'Indiquez la ville.', invalid_type: 'Choisissez un type.', missing_seller_email: 'Une annonce gratuite exige le courriel du vendeur (pour le rappel).', invalid_seller_email: 'Vérifiez le courriel du vendeur.', photo_required: 'Ajoutez au moins une photo avant de publier.', renew_required: 'Cette annonce gratuite a expiré : utilisez « Prolonger de 30 jours ».', revision_conflict: 'Quelqu’un d’autre a modifié cette annonce. La liste a été actualisée.', photo_too_large: 'Photo trop lourde (2 Mo max. après conversion).', photo_format: 'Format de photo non pris en charge.', too_many_photos: '30 photos au maximum par annonce.', photos_unavailable: 'Le stockage des photos n’est pas encore configuré.', invalid_photo: 'Un chemin de photo n’est pas valide.' },
  statsTitle: 'Visites', statsHint: 'Comptes globaux des 30 derniers jours : aucun nom, courriel ni adresse n’est enregistré.', pageViews: 'Pages vues', propertyViews: 'Fiches consultées', guideViews: 'Guides consultés', sources: 'Sources', topListings: 'Annonces les plus vues', noStats: 'Aucune visite enregistrée pour l’instant.' },
 zh: { title: '房源', hint: 'motelavendre.ca 上的酒店和汽车旅馆。房源、照片和设置都只保存在本站。', delay: '修改会在 1 分钟内同步到公开网站。', empty: '还没有房源。', ref: '房源', place: '位置', price: '价格', photos: '照片', status: '状态', state: '网站显示', actions: '操作', shown: '显示中', hidden: '已隐藏', pinned: '已置顶', illustrative: '示意图', hide: '隐藏', show: '显示', pin: '置顶', unpin: '取消置顶', view: '查看', counts: '显示 {shown} · 隐藏 {hidden} · 置顶 {pinned}', statTotal: '房源总数', statShown: '已发布', statHidden: '草稿', statPinned: '免费中',
  draft: '草稿', published: '已发布', expired: '已到期', freeUntil: '免费至 {date}', add: '新建房源', edit: '编辑', publish: '发布', unpublish: '下架', renew: '续期 30 天',
  editTitle: '编辑房源 #{ref}', newTitle: '新建房源', back: '返回房源列表', save: '保存', saved: '已保存。', type: '类型', types: { motel: '汽车旅馆', hotel: '酒店', inn: '度假屋', 'hotel-motel': '酒店／汽车旅馆' },
  city: '城市', region: '地区（选填，默认按城市自动填写）', priceField: '要价（加元）', rooms: '客房数', acres: '土地（英亩）', parking: '车位数', season: '经营方式', seasons: { unknown: '未注明', 'year-round': '全年经营', seasonal: '季节性经营' }, freehold: '产权（含土地）', illustrativeField: '照片为示意图，不是实际物业',
  copyTitle: '文字介绍', copyHint: '法文必填。英文和中文选填，不填时网站显示法文内容。', short: '摘要（1–2 句）', description: '详细介绍', features: '亮点（每行一条，最多 12 条）',
  photosTitle: '照片', photosHint: '第一张为封面。照片会先在您的浏览器里转成 WebP（最长边 1600 像素）再上传。', photosFirst: '请先保存一次房源，再添加照片。', addPhotos: '添加照片', uploading: '正在上传 {n}…', up: '上移', down: '下移', remove: '删除', noPhotos: '还没有照片。房源至少要有一张照片才能发布。',
  sellerTitle: '卖家与首月免费', sellerHint: '仅后台可见，不会在网站显示。用于免费期结束前 7 天的提醒邮件和下架通知。', sellerName: '卖家姓名', sellerEmail: '卖家邮箱', sellerLang: '邮件语言', free: '首月免费：发布后展示 30 天，到期自动下架（不收费）', freeNote: '30 天从发布当天开始计算。',
  errors: { missing_short: '请填写法文摘要。', missing_description: '请填写法文详细介绍。', missing_city: '请填写城市。', invalid_type: '请选择类型。', missing_seller_email: '免费房源需要填写卖家邮箱（用于发提醒）。', invalid_seller_email: '请检查卖家邮箱。', photo_required: '发布前请至少添加一张照片。', renew_required: '这条免费房源已到期，请用“续期 30 天”。', revision_conflict: '其他人刚修改了这条房源，列表已刷新。', photo_too_large: '照片太大（转换后最大 2 MB）。', photo_format: '不支持的照片格式。', too_many_photos: '每条房源最多 30 张照片。', photos_unavailable: '照片存储还没有配置好。', invalid_photo: '照片路径无效。' },
  statsTitle: '访问统计', statsHint: '近 30 天的汇总次数，不记录姓名、邮箱或地址。', pageViews: '页面浏览', propertyViews: '房源浏览', guideViews: '指南浏览', sources: '来源', topListings: '浏览最多的房源', noStats: '还没有访问记录。' }
};
const INVITE = {
 fr: { tab: 'Inviter un membre', title: 'Inviter un administrateur des opérations', text: 'L’invitation donne accès aux demandes, aux comptes acheteurs et aux annonces de Motel à vendre. Elle ne permet pas d’inviter d’autres administrateurs.', email: 'Adresse courriel professionnelle', send: 'Envoyer l’invitation', hint: 'La personne reçoit un courriel pour choisir son mot de passe (lien valide 7 jours). Aucun compte préalable n’est nécessaire.', sent: 'Invitation envoyée à {email}.', sentNoMail: 'Membre ajouté ({email}), mais le courriel n’a pas pu être envoyé. Utilisez « Renvoyer » plus tard.', already: 'Ce compte fait déjà partie de l’équipe.', invalid: 'Adresse invalide, ou c’est votre propre compte.', error: 'L’opération n’a pas pu être finalisée. Réessayez dans un instant.', team: 'Membres de l’équipe', role: 'Rôle', state: 'État', since: 'Depuis', owner: 'Propriétaire', operator: 'Administrateur', activeLabel: 'Actif', pending: 'Invitation en attente', inactive: 'Désactivé', resend: 'Renvoyer', deactivate: 'Désactiver', activate: 'Réactiver', resent: 'Courriel renvoyé à {email}.', confirmDeactivate: 'Désactiver {email} ? Ses sessions sont fermées immédiatement. Vous pourrez le réactiver.', yes: 'Désactiver' },
 en: { tab: 'Invite a member', title: 'Invite an operations administrator', text: 'The invitation gives access to Motel à vendre enquiries, buyer accounts and listings. It does not allow inviting other administrators.', email: 'Work email address', send: 'Send invitation', hint: 'They receive an email to choose their password (link valid for 7 days). No existing account is needed.', sent: 'Invitation sent to {email}.', sentNoMail: 'Member added ({email}), but the email could not be sent. Use “Resend” later.', already: 'This account is already on the team.', invalid: 'Invalid address, or this is your own account.', error: 'The action could not be completed. Try again shortly.', team: 'Team members', role: 'Role', state: 'Status', since: 'Since', owner: 'Owner', operator: 'Administrator', activeLabel: 'Active', pending: 'Invitation pending', inactive: 'Deactivated', resend: 'Resend', deactivate: 'Deactivate', activate: 'Reactivate', resent: 'Email resent to {email}.', confirmDeactivate: 'Deactivate {email}? Their sessions end immediately. You can reactivate them later.', yes: 'Deactivate' },
 zh: { tab: '邀请成员', title: '邀请运营管理员', text: '受邀成员可以处理 Motel à vendre 的咨询、买家账户和房源，但不能再邀请其他管理员。', email: '工作邮箱', send: '发送邀请', hint: '对方会收到一封邮件，点链接设置密码即可开通（链接 7 天内有效），不需要事先注册任何账号。', sent: '邀请已发送至 {email}。', sentNoMail: '已添加成员（{email}），但邀请邮件没有发出，请稍后点“重新发送”。', already: '这个账号已经是团队成员。', invalid: '邮箱无效，或者这是您自己的账号。', error: '操作未能完成，请稍后再试。', team: '团队成员', role: '角色', state: '状态', since: '加入时间', owner: '所有者', operator: '管理员', activeLabel: '已开通', pending: '等待接受邀请', inactive: '已停用', resend: '重新发送', deactivate: '停用', activate: '重新启用', resent: '已重新发送邮件给 {email}。', confirmDeactivate: '停用 {email}？对方会立即被退出登录，之后可以重新启用。', yes: '确认停用' }
};
const LANG_NAMES = { fr: 'FR', en: 'EN', zh: '中文' };
const LOCALES = { fr: 'fr-CA', en: 'en-CA', zh: 'zh-CN' };

// ---- Icons (Lucide paths, as used by the main admin) ----
const ICONS = {
 shield: ['M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z', 'm9 12 2 2 4-4'],
 lock: ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
 back: ['m12 19-7-7 7-7', 'M19 12H5'],
 message: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', 'M13 8H7', 'M17 12H7'],
 users: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M22 21v-2a4 4 0 0 0-3-3.87', 'M16 3.13a4 4 0 0 1 0 7.75'],
 home: ['M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z', 'M9 21v-6h6v6'],
 history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
 external: ['M15 3h6v6', 'M10 14 21 3', 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6'],
 mail: ['M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z', 'M22 7l-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7'],
 phone: ['M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z'],
 clock: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 6v6l4 2'],
 check: ['M20 6 9 17l-5-5'],
 undo: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5'],
 trash: ['M3 6h18', 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6', 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2'],
 chevron: ['m6 9 6 6 6-6'],
 download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'M7 10l5 5 5-5', 'M12 15V3'],
 refresh: ['M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8', 'M21 3v5h-5', 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16', 'M8 16H3v5'],
 arrowUp: ['M7 7h10v10', 'M7 17 17 7'],
 search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'm21 21-4.3-4.3'],
 logout: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
 eye: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
 eyeOff: ['M9.9 4.2A10 10 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2', 'M6.6 6.6C3.9 8.4 2 12 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6', 'M14.1 14.1a3 3 0 1 1-4.2-4.2', 'm2 2 20 20'],
 pin: ['M12 17v5', 'M9 10.8a2 2 0 0 1-1.1 1.8l-1.8.9A2 2 0 0 0 5 15.2V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.8a2 2 0 0 0-1.1-1.8l-1.8-.9a2 2 0 0 1-1.1-1.8V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z'],
 bookmark: ['m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z'],
 userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19 8v6', 'M22 11h-6']
};
function icon(name, size = 16) {
 const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
 for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'admin-icon' })) svg.setAttribute(k, v);
 for (const d of ICONS[name]) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.appendChild(p); }
 return svg;
}

// Site brand mark (assets/brand-mark.svg), drawn in currentColor for the dark sidebar.
function brandMark(size = 30) {
 const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
 for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 48 48', fill: 'none', stroke: 'currentColor', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'admin-mark' })) svg.setAttribute(k, v);
 for (const [d, w, o] of [['M7 44V22a17 17 0 0 1 34 0v22H7Z', 1.6, 1], ['M13 44V22a11 11 0 0 1 22 0v22', 1, .55], ['M17 34V20l7 10 7-10v14', 1.8, 1]]) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); p.setAttribute('stroke-width', w); p.setAttribute('opacity', o); svg.appendChild(p); }
 return svg;
}
const initials = text => { const parts = String(text || '').split(/[@\s._-]+/).filter(Boolean); return ((parts[0] || '?')[0] + (parts[1] ? parts[1][0] : '')).toUpperCase(); };
const avatar = text => h('span', { class: 'admin-avatar', 'aria-hidden': 'true', text: initials(text) });
// Page header shared by every tab: title, explanation, optional sync note and actions.
const pageHead = (title, hint, note, ...actions) => h('header', { class: 'admin-page-head' }, h('div', {}, h('h1', { text: title }), hint ? h('p', { text: hint }) : null, note ? h('p', { class: 'admin-sync-note' }, h('span', { class: 'admin-live-dot', 'aria-hidden': 'true' }), note) : null), actions.length ? h('div', { class: 'admin-page-actions' }, actions) : null);
const stat = (label, value, tone) => h('div', { class: 'admin-stat' + (tone ? ' is-' + tone : '') }, h('span', { text: label }), h('strong', { text: value }));
const skeleton = (n = 3) => h('div', { class: 'admin-skeleton', role: 'status', 'aria-label': t().loading }, Array.from({ length: n }, () => h('div')));

// ---- Tiny DOM builder (textContent only; no HTML strings) ----
function h(tag, props, ...children) {
 const el = document.createElement(tag);
 for (const [k, v] of Object.entries(props || {})) {
  if (v === undefined || v === null || v === false) continue;
  if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
  else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (v === true) el.setAttribute(k, ''); else el.setAttribute(k, String(v));
 }
 for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
 return el;
}
// replaceChildren would print null/false as text; skip them like h() does.
const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k !== null && k !== undefined && k !== false));
const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// ---- State ----
let lang = (() => { try { const v = localStorage.getItem('mav_admin_lang'); if (COPY[v]) return v; } catch {} const n = (navigator.language || '').toLowerCase(); return n.startsWith('zh') ? 'zh' : n.startsWith('en') ? 'en' : 'fr'; })();
let tab = ['enquiries', 'accounts', 'listings', 'stats', 'audit', 'invite'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'enquiries';
let staffEmail = '', staffRole = '', gateNotice = '', timers = [], signedIn = null, screen = 'login';
// Email links land here as #set=TOKEN (password link) or #invite=TOKEN. Capture and clear at once.
let linkToken = '';
{ const m = /^#(set|invite)=([A-Za-z0-9_-]{43})$/.exec(location.hash); if (m) { linkToken = m[2]; tab = 'enquiries'; try { history.replaceState(null, '', location.pathname); } catch { location.hash = ''; } } }
const t = () => COPY[lang];
// Lets the public site show its admin shortcut bar; the bar itself re-checks /api/admin/me.
const staffFlag = on => { try { on ? localStorage.setItem('mav-staff', '1') : localStorage.removeItem('mav-staff'); } catch {} };

class Failure extends Error { constructor(status, code) { super(code || String(status)); this.status = status; this.code = code; } }
async function api(path, payload) {
 const init = { credentials: 'same-origin', headers: {} };
 if (payload) { init.method = 'POST'; init.headers['Content-Type'] = 'application/json'; init.headers['X-MAV-Admin'] = '1'; init.body = JSON.stringify(payload); }
 let r;
 try { r = await fetch('/api/admin/' + path, init); } catch { throw new Failure(0, 'network'); }
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Failure(r.status, data.error);
 return data;
}
// A rejected session sends the user back to the sign-in screen; anything else is shown in place.
function handle(error) {
 if (error && error.status === 401 && error.code === 'signin_required') { staffFlag(false); signedIn = false; staffEmail = ''; gateNotice = t().expired; render(); return true; }
 return false;
}

// ---- Layout ----
function langSwitch() {
 return h('div', { class: 'admin-lang', role: 'group', 'aria-label': 'Langue / Language / 语言' }, Object.keys(COPY).map(l => h('button', { type: 'button', 'aria-pressed': String(l === lang), onclick: () => { lang = l; try { localStorage.setItem('mav_admin_lang', l); } catch {} render(); } }, LANG_NAMES[l])));
}
function setDocLang() { document.documentElement.lang = { fr: 'fr-CA', en: 'en-CA', zh: 'zh-Hans' }[lang]; document.title = t().title + ' | Motel à vendre'; }
function clearTimers() { for (const id of timers) clearInterval(id); timers = []; }
const errorText = error => { const c = t(); return error.code === 'rate' ? c.rate : error.code === 'link_invalid' ? c.badLink : error.code === 'weak_password' ? c.weak : error.code === 'invalid_credentials' ? c.badLogin : c.unavailable; };

// kind: 'login' | 'link' | 'set' | 'retry'
function gate(title, text, kind) {
 const c = t(), children = [h('div', { class: 'admin-gate-top' }, h('div', { class: 'admin-gate-brand' }, brandMark(36), h('strong', {}, 'Motel à vendre', h('small', { text: c.staffArea }))), langSwitch()), h('h1', { text: title }), h('p', { class: 'admin-gate-lead', text: text })];
 const err = h('p', { role: 'alert', hidden: !gateNotice, text: gateNotice });
 const field = (label, attrs) => { const input = h('input', attrs); return [h('label', {}, label, input), input]; };
 const textLink = (text, onclick) => h('button', { type: 'button', class: 'admin-text-link', onclick, text });
 if (kind === 'login') {
  const [emailLabel, email] = field(c.email, { type: 'email', autocomplete: 'username', required: true, maxlength: 150 });
  const [passLabel, password] = field(c.password, { type: 'password', autocomplete: 'current-password', required: true, maxlength: 128 });
  const submit = h('button', { class: 'admin-primary', type: 'submit', text: c.login });
  children.push(h('form', { class: 'admin-login', onsubmit: async e => {
   e.preventDefault(); submit.disabled = true; err.hidden = true;
   try { await api('login', { email: email.value.trim(), password: password.value }); gateNotice = ''; await start(); }
   catch (error) { err.textContent = errorText(error); err.hidden = false; submit.disabled = false; password.value = ''; password.focus(); }
  } }, emailLabel, passLabel, err, submit, textLink(c.forgot, () => { screen = 'link'; gateNotice = ''; render(); })));
 } else if (kind === 'link') {
  const [emailLabel, email] = field(c.email, { type: 'email', autocomplete: 'username', required: true, maxlength: 150 });
  const submit = h('button', { class: 'admin-primary', type: 'submit', text: c.sendLink });
  const done = h('p', { role: 'status', class: 'admin-message success', hidden: true, text: c.linkSent });
  children.push(h('form', { class: 'admin-login', onsubmit: async e => {
   e.preventDefault(); submit.disabled = true; err.hidden = true; done.hidden = true;
   try { await api('password-link', { email: email.value.trim(), language: lang }); done.hidden = false; }
   catch (error) { err.textContent = errorText(error); err.hidden = false; }
   submit.disabled = false;
  } }, emailLabel, err, done, submit, textLink(c.backToLogin, () => { screen = 'login'; gateNotice = ''; render(); })));
 } else if (kind === 'set') {
  const [p1Label, p1] = field(c.newPassword, { type: 'password', autocomplete: 'new-password', required: true, minlength: 10, maxlength: 128 });
  const [p2Label, p2] = field(c.confirmPassword, { type: 'password', autocomplete: 'new-password', required: true, minlength: 10, maxlength: 128 });
  const submit = h('button', { class: 'admin-primary', type: 'submit', text: c.save });
  children.push(h('form', { class: 'admin-login', onsubmit: async e => {
   e.preventDefault(); err.hidden = true;
   if (p1.value !== p2.value) { err.textContent = c.mismatch; err.hidden = false; return; }
   submit.disabled = true;
   try { await api('set-password', { token: linkToken, password: p1.value }); linkToken = ''; screen = 'login'; gateNotice = ''; await start(); }
   catch (error) { err.textContent = errorText(error); err.hidden = false; submit.disabled = false; }
  } }, p1Label, p2Label, err, submit, textLink(c.linkTitle, () => { linkToken = ''; screen = 'link'; gateNotice = ''; render(); })));
 } else if (kind === 'retry') {
  children.push(h('button', { class: 'admin-primary', type: 'button', onclick: start }, icon('refresh', 16), c.refresh));
 }
 return h('main', { class: 'admin-gate' }, h('div', { class: 'admin-gate-card' }, children), h('a', { class: 'admin-gate-back', href: '/' + lang + '/' }, icon('back', 14), c.back));
}

async function signOut() {
 clearTimers(); staffFlag(false); staffEmail = ''; staffRole = ''; signedIn = false; screen = 'login';
 try { await api('logout', {}); } catch {}
 render();
}

async function start() {
 fill(root, h('main', { class: 'admin-gate', 'aria-busy': 'true', text: t().loading }));
 try { const me = await api('me'); staffEmail = me.email; staffRole = me.role; signedIn = true; staffFlag(true); }
 catch (error) {
  if (error.status === 401) { staffFlag(false); signedIn = false; render(); return; }
  setDocLang(); fill(root, gate(t().title, t().unavailable, 'retry')); return;
 }
 render();
}

let pendingBadgeEl = null;
function refreshPending() {
 const el = pendingBadgeEl; if (!el) return;
 api('enquiries?' + new URLSearchParams({ filter: 'pending', offset: '0' })).then(d => { const n = d.enquiries.length; el.textContent = n ? n + (d.more ? '+' : '') : ''; el.hidden = !n; }).catch(() => {});
}

function render() {
 setDocLang(); clearTimers();
 const c = t();
 if (linkToken) { fill(root, gate(c.setTitle, c.setText, 'set')); return; }
 if (signedIn === null) { start(); return; }
 if (!signedIn) { fill(root, screen === 'link' ? gate(c.linkTitle, c.linkText, 'link') : gate(c.loginTitle, c.loginText, 'login')); return; }
 if (tab === 'invite' && staffRole !== 'owner') tab = 'enquiries';
 const titles = { enquiries: INBOX[lang].title, accounts: ACCOUNTS[lang].title, listings: LISTINGS[lang].title, stats: LISTINGS[lang].statsTitle, audit: c.audit, invite: INVITE[lang].tab };
 const nav = (id, name, label, badge) => h('button', { type: 'button', class: tab === id ? 'active' : '', 'aria-current': tab === id ? 'page' : null, onclick: () => { tab = id; history.replaceState(null, '', '#' + id); render(); } }, icon(name, 18), h('span', { class: 'admin-nav-label', text: label }), badge || null);
 const pendingBadge = pendingBadgeEl = h('span', { class: 'admin-nav-badge', hidden: true });
 const panel = h('div', { class: 'admin-panel-host', 'aria-live': 'polite' });
 const role = staffRole === 'owner' ? INVITE[lang].owner : INVITE[lang].operator;
 fill(root, h('div', { class: 'admin-app' },
  h('aside', { class: 'admin-sidebar' },
   h('div', { class: 'admin-brand' }, brandMark(32), h('strong', {}, 'Motel à vendre', h('small', { text: c.console }))),
   h('nav', { 'aria-label': c.title },
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.work }), nav('enquiries', 'message', INBOX[lang].title, pendingBadge)),
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.management }), nav('accounts', 'users', ACCOUNTS[lang].title), nav('listings', 'home', LISTINGS[lang].title), nav('stats', 'eye', LISTINGS[lang].statsTitle), nav('audit', 'history', c.audit), staffRole === 'owner' ? nav('invite', 'userPlus', INVITE[lang].tab) : null)),
   h('a', { href: '/' + lang + '/', class: 'admin-back', target: '_blank', rel: 'noopener' }, icon('external', 15), c.back)),
  h('div', { class: 'admin-main' },
   h('header', { class: 'admin-topbar' },
    h('div', { class: 'admin-crumbs' }, h('span', { text: c.console }), h('span', { class: 'admin-crumb-sep', 'aria-hidden': 'true', text: '/' }), h('strong', { text: titles[tab] })),
    h('div', { class: 'admin-account' }, langSwitch(),
     h('div', { class: 'admin-user' }, avatar(staffEmail), h('span', { class: 'admin-who' }, h('strong', { text: staffEmail }), h('small', { text: role }))),
     h('button', { type: 'button', class: 'admin-icon-button', title: c.signOut, 'aria-label': c.signOut, onclick: signOut }, icon('logout', 17)))),
   h('section', { class: 'admin-content' },
    local ? h('p', { class: 'admin-local' }, icon('shield', 15), c.local) : null,
    panel))));
 // Pending count for the sidebar badge (first page only: 50+ when there are more).
 refreshPending();
 ({ enquiries: enquiriesTab, accounts: accountsTab, listings: listingsTab, stats: statsTab, audit: auditTab, invite: inviteTab })[tab](panel);
}

const date = v => new Date(v).toLocaleString(LOCALES[lang]);
const shortDate = v => new Date(v).toLocaleString(LOCALES[lang], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const day = v => new Date(v).toLocaleDateString(LOCALES[lang], { year: 'numeric', month: 'short', day: 'numeric' });
const money = v => new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(Number(v));
const propertyPath = ref => '/' + lang + '/proprietes/' + ref + '/';

// ---- Buyer enquiries (buyer-enquiries.tsx) ----
function enquiriesTab(panel) {
 const tx = INBOX[lang], a = ACTION[lang], pc = PROPERTY[lang];
 let filter = 'active', offset = 0, rows = [], more = false, loading = true, error = false, busy = null, confirmDelete = null, actionError = false, generation = 0, inFlight = false;
 const section = h('section', { class: 'admin-page buyer-enquiries' });
 fill(panel, section);

 async function load() {
  if (inFlight) return; inFlight = true; const version = ++generation; error = false;
  try { 
  const data = await api('enquiries?' + new URLSearchParams({ filter, offset: String(offset) })); if (version !== generation) return; rows = data.enquiries; more = data.more; }
  catch (e) { if (handle(e)) return; if (version === generation) error = true; }
  finally { inFlight = false; if (version === generation) { loading = false; draw(); } }
 }
 async function review(row, action) {
  if (busy) return; busy = row.id; actionError = false; generation++; draw();
  try { await api('enquiries/review', { id: row.id, revision: row.revision ?? 0, action }); confirmDelete = null; rows = rows.filter(r => r.id !== row.id); }
  catch (e) { if (handle(e)) return; actionError = true; }
  finally { busy = null; draw(); load(); refreshPending(); }
 }
 function exportCsv() {
  const cols = ['created_at', 'kind', 'name', 'email', 'phone', 'city', 'address', 'propertyType', 'budgetMin', 'budgetMax', 'expectedPrice', 'requirements', 'timeline', 'service', 'assistance', 'contactLanguage', 'contactMethod', 'contactTime', 'listingReference', 'language'];
  const cell = v => { let s = String(v ?? ''); if (/^[\s﻿]*[=+@-]/.test(s) || /^[\t\r\n]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"', '""') + '"'; };
  const csv = '﻿' + [cols, ...rows.map(r => cols.map(k => k === 'created_at' ? r.created_at : r.payload[k]))].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = h('a', { href: url, download: 'motel-enquiries.csv' }); link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 }
 const value = (p, key) => {
  const v = p[key]; if (!v) return '—';
  if (key === 'contactLanguage') return { en: 'English', fr: 'Français', zh: '中文' }[v] || v;
  if (key === 'contactMethod') return v === 'email' ? tx.email : v === 'phone' ? tx.phone : v;
  if (['budgetMin', 'budgetMax', 'expectedPrice'].includes(key) && /^\d+$/.test(v)) return money(v);
  return v;
 };
 function property(p) {
  if (!p.listingReference) return h('div', { class: 'buyer-enquiry-property is-general' }, h('span', { class: 'buyer-enquiry-property-label', text: pc.heading }), h('strong', { class: 'buyer-enquiry-address', text: pc.general }));
  const ref = p.listingNumber || p.listingReference, safe = /^\d{1,12}$/.test(ref);
  const price = p.listingPrice && Number.isFinite(Number(p.listingPrice)) ? money(p.listingPrice) : '';
  return h('div', { class: 'buyer-enquiry-property' },
   h('div', { class: 'buyer-enquiry-property-heading' }, h('span', { class: 'buyer-enquiry-property-label', text: pc.heading }), h('span', { class: 'buyer-enquiry-reference', text: '#' + ref }), (p.requirements || '').startsWith('[NDA]') ? h('span', { class: 'buyer-enquiry-nda', text: pc.nda }) : null),
   p.listingStatus === 'linked' ? [
    h('div', { class: 'buyer-enquiry-property-title' }, h('strong', { class: 'buyer-enquiry-address', text: p.listingAddress || pc.unpublished }), safe ? h('a', { href: propertyPath(ref), target: '_blank', rel: 'noopener noreferrer' }, pc.view, icon('arrowUp', 14)) : null),
    h('div', { class: 'buyer-enquiry-property-meta' }, p.listingCity ? h('span', { text: p.listingCity }) : null, price ? h('strong', { text: price }) : null),
    p.listingSnapshotSource === 'backfill' ? h('small', { class: 'buyer-enquiry-context-note', text: pc.recovered }) : null
   ] : safe ? h('div', { class: 'buyer-enquiry-property-title' }, h('a', { href: propertyPath(ref), target: '_blank', rel: 'noopener noreferrer' }, pc.view, icon('arrowUp', 14))) : h('small', { class: 'buyer-enquiry-context-note', text: pc.unavailable }));
 }
 function card(row) {
  const p = row.payload || {}, status = row.deleted_at ? 'deleted' : row.review_status === 'accepted' ? 'accepted' : 'pending';
  const fields = ['budgetMin', 'budgetMax', 'expectedPrice', 'address', 'requirements', 'timeline', 'contactLanguage', 'contactMethod', 'contactTime'].filter(k => !!p[k]);
  const label = k => ({ budgetMin: tx.min, budgetMax: tx.max }[k] || tx[k]);
  const btn = (cls, name, text, fn) => h('button', { type: 'button', class: 'admin-secondary ' + cls, disabled: !!busy, onclick: fn }, icon(name, 14), text);
  return h('article', { class: 'buyer-enquiry-card', 'aria-labelledby': 'enquiry-person-' + row.id },
   h('header', { class: 'buyer-enquiry-header' },
    h('div', { class: 'buyer-enquiry-meta' }, h('span', { class: 'buyer-enquiry-status is-' + status, text: a[status] }), h('span', { class: 'buyer-enquiry-kind is-' + (p.kind === 'seller' ? 'seller' : 'buyer'), text: p.kind === 'seller' ? tx.seller : tx.buyer }), h('time', { datetime: row.created_at, title: date(row.created_at) }, icon('clock', 13), shortDate(row.created_at))),
    h('div', { class: 'buyer-enquiry-actions' },
     row.deleted_at ? btn('enquiry-restore', 'undo', a.restore, () => review(row, 'restore'))
      : [btn('enquiry-accept', row.review_status === 'accepted' ? 'undo' : 'check', row.review_status === 'accepted' ? a.reopen : a.accept, () => review(row, row.review_status === 'accepted' ? 'reopen' : 'accept')),
         btn('enquiry-delete', 'trash', a.remove, () => { confirmDelete = row.id; draw(); })],
     busy === row.id ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: a.saving }) : null)),
   confirmDelete === row.id ? h('div', { class: 'buyer-enquiry-confirm', role: 'group', 'aria-label': a.remove }, h('p', { text: a.confirm }),
    h('button', { type: 'button', class: 'admin-secondary enquiry-delete', disabled: !!busy, onclick: () => review(row, 'delete'), text: a.yes }),
    h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => { confirmDelete = null; draw(); }, text: a.cancel })) : null,
   h('div', { class: 'buyer-enquiry-topline' },
    h('div', { class: 'buyer-enquiry-person' }, avatar(p.name || p.email), h('h3', { id: 'enquiry-person-' + row.id, text: p.name || '—' }),
     p.email ? h('a', { href: 'mailto:' + p.email }, icon('mail', 14), p.email) : null,
     p.phone ? h('span', {}, icon('phone', 14), p.phone) : null),
    property(p)),
   p.city ? h('p', { class: 'buyer-enquiry-preference' }, h('span', { text: tx.city }), p.city) : null,
   h('details', { class: 'buyer-enquiry-details' }, h('summary', {}, tx.details, icon('chevron', 14)),
    fields.length ? h('dl', { class: 'buyer-enquiry-fields' }, fields.map(k => h('div', { class: k === 'requirements' ? 'is-message' : null }, h('dt', { text: label(k) }), h('dd', { text: value(p, k) }))))
     : h('p', { class: 'buyer-enquiry-context-note', text: pc.noDetails })));
 }
 function draw() {
  if (!section.isConnected) return;
  fill(section, 
   pageHead(tx.title, tx.hint, tx.autoRefresh, h('button', { type: 'button', class: 'admin-secondary buyer-enquiry-export', disabled: loading || !rows.length, onclick: exportCsv }, icon('download', 15), pc.export)),
   h('div', { class: 'buyer-enquiry-filters', role: 'group', 'aria-label': tx.title }, ['active', 'pending', 'accepted', 'deleted'].map(key => h('button', { type: 'button', class: 'admin-secondary', 'aria-pressed': String(filter === key), disabled: !!busy, onclick: () => { if (key === filter) return; filter = key; offset = 0; rows = []; loading = true; confirmDelete = null; actionError = false; generation++; inFlight = false; draw(); load(); } }, a[key]))),
   actionError ? h('p', { class: 'admin-message error', role: 'alert', text: a.error }) : null,
   error ? h('p', { class: 'admin-message error', role: 'alert', text: tx.error }) : null,
   loading && !rows.length ? skeleton(3) : !rows.length && !error ? h('div', { class: 'admin-empty' }, icon('message', 26), h('p', { text: tx.empty })) : rows.length ? h('div', { class: 'buyer-enquiry-list' }, rows.map(card)) : null,
   h('div', { class: 'buyer-enquiry-pagination' },
    h('button', { class: 'admin-secondary', disabled: loading || !!busy || offset === 0, onclick: () => { offset = Math.max(0, offset - 50); loading = true; generation++; inFlight = false; draw(); load(); }, text: COPY[lang].previous }),
    h('button', { class: 'admin-secondary', disabled: loading || !!busy || !more || error, onclick: () => { offset += 50; loading = true; generation++; inFlight = false; draw(); load(); }, text: COPY[lang].next })));
 }
 draw(); load();
 timers.push(setInterval(() => { if (document.visibilityState !== 'hidden' && !busy && confirmDelete === null) { load(); refreshPending(); } }, 15000));
}

// ---- Buyer accounts (D1) ----
function accountsTab(panel) {
 const c = COPY[lang], tx = ACCOUNTS[lang];
 let filter = 'all', q = '', offset = 0, data = null, error = '', notice = '', busy = null, confirmDelete = null, generation = 0;
 const section = h('section', { class: 'admin-page' });
 fill(panel, section);
 async function load() {
  const version = ++generation;
  try { const r = await api('accounts?' + new URLSearchParams({ filter, q, offset: String(offset) })); if (version === generation) { data = r; error = ''; } }
  catch (e) { if (handle(e)) return; if (version === generation) error = e.status === 503 ? c.unavailable : c.error; }
  draw();
 }
 async function act(user, action) {
  busy = user.id; notice = ''; draw();
  try { await api('accounts/' + action, { id: user.id }); notice = action === 'confirm' ? tx.confirmed : tx.deleted; confirmDelete = null; }
  catch (e) { if (handle(e)) return; error = c.saveError; }
  busy = null; load();
 }
 const search = h('input', { type: 'search', placeholder: tx.search, 'aria-label': tx.search, maxlength: 100 });
 let debounce;
 search.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { q = search.value.trim(); offset = 0; load(); }, 300); });
 const select = h('select', { 'aria-label': tx.status, onchange: () => { filter = select.value; offset = 0; load(); } }, ['all', 'verified', 'unverified'].map(k => h('option', { value: k, text: tx[k] })));
 const controls = h('div', { class: 'admin-search' }, h('label', { class: 'admin-search-field' }, icon('search', 16), search), select);
 function draw() {
  if (!section.isConnected) return;
  const body = [];
  const table = [];
  if (!data && !error) table.push(skeleton(4));
  if (data) {
   body.push(h('div', { class: 'admin-stats' }, stat(tx.total, data.totals.total), stat(tx.confirmedCount, data.totals.verified, 'ok'), stat(tx.unverified, data.totals.total - data.totals.verified, 'warn')));
   if (!data.accounts.length) table.push(h('div', { class: 'admin-empty' }, icon('users', 26), h('p', { text: tx.empty })));
   else table.push(h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.person, tx.status, tx.created, tx.lastSignin, tx.activity, tx.actions].map(x => h('th', { text: x })))),
    h('tbody', {}, data.accounts.map(u => {
     const profile = [u.full_name, u.phone].filter(Boolean).join(' · ');
     const prefs = [u.buyer_budget ? tx.budget + ' ' + money(u.buyer_budget) : '', u.buyer_regions ? tx.regions + ' ' + u.buyer_regions : ''].filter(Boolean).join(' · ');
     return h('tr', {},
      h('td', {}, h('div', { class: 'admin-person' }, avatar(u.full_name || u.email), h('div', {}, h('a', { href: 'mailto:' + u.email, text: u.email }), profile ? h('small', { text: profile }) : null, prefs ? h('small', { text: prefs }) : null))),
      h('td', {}, h('span', { class: 'admin-badge' + (u.verified_at ? ' is-ok' : ''), text: u.verified_at ? tx.verified : tx.unverified })),
      h('td', { class: 'admin-nowrap', text: day(u.created_at * 1000) }),
      h('td', { class: 'admin-nowrap', text: u.last_signin ? shortDate(u.last_signin * 1000) : tx.never }),
      h('td', {}, h('div', { class: 'admin-counters' }, [['bookmark', u.saved, tx.saved], ['search', u.searches, tx.searches], ['message', u.enquiries, tx.enquiries]].map(([n, v, label]) => h('span', { title: label, 'aria-label': label + ' ' + v, class: v ? null : 'is-zero' }, icon(n, 13), String(v))))),
      h('td', {}, confirmDelete === u.id
       ? h('div', { class: 'buyer-enquiry-confirm', role: 'group' }, h('p', { text: fmt(tx.confirmDelete, { email: u.email }) }), h('button', { type: 'button', class: 'admin-secondary enquiry-delete', disabled: !!busy, onclick: () => act(u, 'delete'), text: tx.yes }), h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => { confirmDelete = null; draw(); }, text: c.cancel }))
       : h('div', { class: 'admin-row-actions' },
         u.verified_at ? null : h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => act(u, 'confirm') }, icon('check', 14), tx.confirmBtn),
         h('button', { type: 'button', class: 'admin-secondary is-danger is-icon', title: tx.deleteBtn, 'aria-label': tx.deleteBtn + ' ' + u.email, disabled: !!busy, onclick: () => { confirmDelete = u.id; draw(); } }, icon('trash', 14)),
         busy === u.id ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: c.saving }) : null)));
    })))));
   if (offset > 0 || data.more) table.push(h('div', { class: 'buyer-enquiry-pagination' },
    h('button', { class: 'admin-secondary', disabled: offset === 0, onclick: () => { offset = Math.max(0, offset - 50); load(); }, text: c.previous }),
    h('button', { class: 'admin-secondary', disabled: !data.more, onclick: () => { offset += 50; load(); }, text: c.next })));
  }
  fill(section, 
   pageHead(tx.title, tx.hint),
   notice ? h('p', { class: 'admin-message success', role: 'status', text: notice }) : null,
   error ? h('p', { class: 'admin-message error', role: 'alert', text: error }) : null,
   body,
   h('div', { class: 'admin-card' }, h('div', { class: 'admin-card-toolbar' }, controls), table));
 }
 draw(); load();
}

// ---- Listings on this site (main catalogue + D1 display settings) ----
const LISTING_LANGS = ['fr', 'en', 'zh'], LISTING_LANG_NAMES = { fr: 'Français', en: 'English', zh: '中文' };

// Browser-side resize + WebP conversion keeps the Worker's CPU use low (no server-side image work).
async function preparePhoto(file) {
 const bitmap = await createImageBitmap(file);
 const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
 const canvas = document.createElement('canvas');
 canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
 canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
 const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
 if (blob && blob.type === 'image/webp') return blob;
 return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85)); // browsers without WebP encoding
}
async function uploadPhoto(reference, blob) {
 let r;
 try { r = await fetch('/api/admin/listings/photo?reference=' + encodeURIComponent(reference), { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': blob.type, 'X-MAV-Admin': '1' }, body: blob }); }
 catch { throw new Failure(0, 'network'); }
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Failure(r.status, data.error);
 return data.path;
}

function listingsTab(panel) {
 const c = COPY[lang], tx = LISTINGS[lang];
 let listings = null, error = '', notice = '', busy = null, editing = null;
 const section = h('section', { class: 'admin-page' });
 fill(panel, section);
 const failMessage = e => tx.errors[e.code] || (e.status === 503 ? c.unavailable : c.error);
 async function load() {
  try { listings = (await api('listings')).listings; error = ''; }
  catch (e) { if (handle(e)) return; error = failMessage(e); }
  draw();
 }
 async function set(item, change) {
  busy = item.reference; notice = ''; draw();
  try { await api('listings', { reference: item.reference, ...change }); }
  catch (e) { if (handle(e)) return; error = c.saveError; }
  busy = null; load();
 }
 async function status(item, action) {
  busy = item.reference; notice = ''; error = ''; draw();
  try { await api('listings/status', { reference: item.reference, revision: item.revision, action }); }
  catch (e) { if (handle(e)) return; error = failMessage(e); }
  busy = null; load();
 }
 const freeText = l => l.free_until ? fmt(tx.freeUntil, { date: day(l.free_until * 1000) }) : null;
 function table() {
  return h('div', { class: 'admin-card' }, h('div', { class: 'admin-table-wrap' }, h('table', { class: 'admin-listings' },
   h('thead', {}, h('tr', {}, [tx.ref, tx.place, tx.price, tx.photos, tx.status, tx.state, tx.actions].map(x => h('th', { text: x })))),
   h('tbody', {}, listings.map(l => h('tr', { class: l.hidden || l.status !== 'published' ? 'is-hidden' : null },
    h('td', {}, h('code', { text: '#' + l.reference })),
    h('td', {}, h('strong', { class: 'admin-cell-title', text: l.item.city || '—' }), h('small', { text: tx.types[l.item.type] + (l.item.region ? ' · ' + l.item.region : '') })),
    h('td', { class: 'is-num', text: l.item.price === null ? '—' : money(l.item.price) }),
    h('td', {}, String(l.item.photos.length), l.item.illustrative ? h('small', { text: tx.illustrative }) : null),
    h('td', {}, h('div', { class: 'admin-badges' }, h('span', { class: 'admin-badge' + (l.status === 'published' ? ' is-ok' : l.status === 'expired' ? ' is-muted' : ''), text: tx[l.status] })),
     freeText(l) ? h('small', { text: freeText(l) }) : null),
    h('td', {}, h('div', { class: 'admin-badges' }, h('span', { class: 'admin-badge' + (l.hidden ? ' is-muted' : ' is-ok'), text: l.hidden ? tx.hidden : tx.shown }), l.pinned ? h('span', { class: 'admin-badge is-accent' }, icon('pin', 11), tx.pinned) : null),
     l.updated_by ? h('small', { text: l.updated_by + ' · ' + shortDate(l.updated_at * 1000) }) : null),
    h('td', {}, h('div', { class: 'admin-row-actions' },
     h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => { editing = { listing: l }; notice = ''; error = ''; draw(); } }, tx.edit),
     l.status === 'draft' ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => status(l, 'publish') }, icon('check', 14), tx.publish) : null,
     l.status === 'published' ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => status(l, 'unpublish') }, tx.unpublish) : null,
     l.free && l.status !== 'draft' ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => status(l, 'renew') }, icon('refresh', 14), tx.renew) : null,
     l.status === 'published' ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => set(l, { hidden: !l.hidden }) }, icon(l.hidden ? 'eye' : 'eyeOff', 14), l.hidden ? tx.show : tx.hide) : null,
     l.status === 'published' ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy || l.hidden, onclick: () => set(l, { pinned: !l.pinned }) }, icon('pin', 14), l.pinned ? tx.unpin : tx.pin) : null,
     l.status === 'published' && !l.hidden ? h('a', { class: 'admin-secondary', href: propertyPath(l.reference), target: '_blank', rel: 'noopener noreferrer' }, tx.view, icon('arrowUp', 14)) : null,
     busy === l.reference ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: c.saving }) : null))))))));
 }
 function editor() {
  const l = editing.listing, item = l ? l.item : { type: 'motel', city: '', region: '', price: null, rooms: null, acres: null, parking: null, season: 'unknown', tenure: null, illustrative: false, photos: [], copy: {} };
  const photos = editing.photos || (editing.photos = [...item.photos]);
  const input = (name, value, attrs = {}) => h('input', { name, value: value ?? '', ...attrs });
  const field = (label, control, wide) => h('label', { class: 'admin-field' + (wide ? ' is-wide' : '') }, h('span', { text: label }), control);
  const select = (name, options, value) => { const s = h('select', { name }, Object.entries(options).map(([v, label]) => h('option', { value: v, text: label }))); s.value = value; return s; };
  const area = (name, value, rows) => { const a = h('textarea', { name, rows }); a.value = value || ''; return a; };
  const own = item.copy || {};
  const form = h('form', { class: 'admin-listing-form', onsubmit: async e => {
   e.preventDefault(); const f = new FormData(form), n = k => f.get(k) === '' ? null : Number(f.get(k));
   const payload = { type: f.get('type'), city: f.get('city'), region: f.get('region'), price: n('price'), rooms: n('rooms'), acres: n('acres'), parking: n('parking'), season: f.get('season'), tenure: f.get('tenure') ? 'freehold' : null, illustrative: !!f.get('illustrative'), photos,
    copy: Object.fromEntries(LISTING_LANGS.map(x => [x, { short: f.get('short_' + x), description: f.get('description_' + x), features: f.get('features_' + x) }])),
    seller: { name: f.get('seller_name'), email: f.get('seller_email'), language: f.get('seller_language') }, free: !!f.get('free') };
   if (l) { payload.reference = l.reference; payload.revision = l.revision; }
   busy = 'save'; error = ''; notice = ''; draw();
   try { const r = await api('listings/save', payload); editing = { listing: r.listing }; notice = tx.saved; }
   catch (err) { if (handle(err)) return; error = failMessage(err); if (err.code === 'revision_conflict') { editing = null; load(); } }
   busy = null; draw();
  } });
  const copyBlocks = LISTING_LANGS.map(x => h('fieldset', { class: 'admin-listing-copy' }, h('legend', { text: LISTING_LANG_NAMES[x] + (x === 'fr' ? ' *' : '') }),
   field(tx.short, area('short_' + x, l && (x === 'fr' || own[x]?.short !== own.fr?.short) ? own[x]?.short : '', 2), true),
   field(tx.description, area('description_' + x, l && (x === 'fr' || own[x]?.description !== own.fr?.description) ? own[x]?.description : '', 6), true),
   field(tx.features, area('features_' + x, l && (x === 'fr' || JSON.stringify(own[x]?.features) !== JSON.stringify(own.fr?.features)) ? (own[x]?.features || []).join('\n') : '', 4), true)));
  const photoList = h('div', { class: 'admin-photo-grid' }, photos.length ? photos.map((p, i) => h('figure', {},
   h('img', { src: '/' + p, alt: '', loading: 'lazy' }),
   h('figcaption', {}, i === 0 ? h('strong', { text: '★' }) : null,
    h('button', { type: 'button', class: 'admin-icon-button', title: tx.up, 'aria-label': tx.up, disabled: i === 0, onclick: () => { [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]]; draw(); } }, '↑'),
    h('button', { type: 'button', class: 'admin-icon-button', title: tx.down, 'aria-label': tx.down, disabled: i === photos.length - 1, onclick: () => { [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]]; draw(); } }, '↓'),
    h('button', { type: 'button', class: 'admin-icon-button', title: tx.remove, 'aria-label': tx.remove, onclick: () => { photos.splice(i, 1); draw(); } }, icon('trash', 14))))) : h('p', { class: 'admin-help', text: tx.noPhotos }));
  const picker = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onchange: async e => {
   const files = [...e.target.files]; e.target.value = '';
   for (let i = 0; i < files.length; i++) {
    busy = fmt(tx.uploading, { n: (i + 1) + '/' + files.length }); error = ''; draw();
    try { photos.push(await uploadPhoto(l.reference, await preparePhoto(files[i]))); }
    catch (err) { if (handle(err)) return; error = failMessage(err); break; }
   }
   busy = null; draw();
  } });
  const seller = (l && l.seller) || { name: '', email: '', language: 'fr' };
  fill(form,
   h('div', { class: 'admin-card admin-listing-section' }, h('div', { class: 'admin-listing-grid' },
    field(tx.type, select('type', tx.types, item.type)), field(tx.city + ' *', input('city', item.city, { required: true, maxlength: 120 })), field(tx.region, input('region', l ? item.region : '', { maxlength: 120 })),
    field(tx.priceField, input('price', item.price, { type: 'number', min: 0, step: 1 })), field(tx.rooms, input('rooms', item.rooms, { type: 'number', min: 1, step: 1 })), field(tx.acres, input('acres', item.acres, { type: 'number', min: 0, step: 'any' })),
    field(tx.parking, input('parking', item.parking, { type: 'number', min: 0, step: 1 })), field(tx.season, select('season', tx.seasons, item.season))),
    h('label', { class: 'admin-check' }, h('input', { type: 'checkbox', name: 'tenure', checked: item.tenure === 'freehold' }), tx.freehold),
    h('label', { class: 'admin-check' }, h('input', { type: 'checkbox', name: 'illustrative', checked: !!item.illustrative }), tx.illustrativeField)),
   h('div', { class: 'admin-card admin-listing-section' }, h('h2', { text: tx.copyTitle }), h('p', { class: 'admin-help', text: tx.copyHint }), copyBlocks),
   h('div', { class: 'admin-card admin-listing-section' }, h('h2', { text: tx.photosTitle }), h('p', { class: 'admin-help', text: l ? tx.photosHint : tx.photosFirst }), photoList,
    l ? h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => picker.click() }, icon('download', 14), tx.addPhotos) : null, picker),
   h('div', { class: 'admin-card admin-listing-section' }, h('h2', { text: tx.sellerTitle }), h('p', { class: 'admin-help', text: tx.sellerHint }), h('div', { class: 'admin-listing-grid' },
    field(tx.sellerName, input('seller_name', seller.name, { maxlength: 120, autocomplete: 'off' })), field(tx.sellerEmail, input('seller_email', seller.email, { type: 'email', maxlength: 254, autocomplete: 'off' })),
    field(tx.sellerLang, select('seller_language', LISTING_LANG_NAMES, seller.language))),
    h('label', { class: 'admin-check' }, h('input', { type: 'checkbox', name: 'free', checked: l ? !!l.free : false }), tx.free),
    h('p', { class: 'admin-help', text: l && l.free_until ? freeText(l) : tx.freeNote })),
   h('div', { class: 'admin-page-actions' }, h('button', { type: 'submit', class: 'admin-primary', disabled: !!busy }, busy === 'save' ? c.saving : tx.save),
    typeof busy === 'string' && busy !== 'save' ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: busy }) : null));
  return form;
 }
 function draw() {
  if (!section.isConnected) return;
  const messages = [error ? h('p', { class: 'admin-message error', role: 'alert', text: error }) : null, notice ? h('p', { class: 'admin-message', role: 'status', text: notice }) : null];
  if (editing) {
   const l = editing.listing;
   fill(section, pageHead(l ? fmt(tx.editTitle, { ref: l.reference }) : tx.newTitle, l ? tx[l.status] + (freeText(l) ? ' · ' + freeText(l) : '') : '', null,
    h('button', { type: 'button', class: 'admin-secondary', onclick: () => { editing = null; error = ''; notice = ''; listings = null; draw(); load(); } }, icon('back', 15), tx.back)), messages, editor());
   return;
  }
  const body = [];
  if (!listings && !error) body.push(h('div', { class: 'admin-card' }, skeleton(4)));
  if (listings && !listings.length) body.push(h('div', { class: 'admin-card' }, h('div', { class: 'admin-empty' }, icon('home', 26), h('p', { text: tx.empty }))));
  if (listings && listings.length) {
   body.push(h('div', { class: 'admin-stats' }, stat(tx.statTotal, listings.length), stat(tx.statShown, listings.filter(l => l.status === 'published').length, 'ok'), stat(tx.statHidden, listings.filter(l => l.status === 'draft').length, 'muted'), stat(tx.statPinned, listings.filter(l => l.free && l.status === 'published').length, 'accent')));
   body.push(table());
  }
  fill(section,
   pageHead(tx.title, tx.hint, tx.delay,
    h('button', { type: 'button', class: 'admin-primary', onclick: () => { editing = { listing: null }; error = ''; notice = ''; draw(); } }, tx.add),
    h('button', { type: 'button', class: 'admin-secondary buyer-enquiry-export', onclick: () => { listings = null; error = ''; draw(); load(); } }, icon('refresh', 15), c.refresh)),
   messages, body);
 }
 draw(); load();
}

function statsTab(panel) {
 const c = COPY[lang], tx = LISTINGS[lang];
 const section = h('section', { class: 'admin-page' });
 fill(panel, section);
 let data = null, error = '';
 (async () => { try { data = await api('stats?days=30'); } catch (e) { if (handle(e)) return; error = e.status === 503 ? c.unavailable : c.error; } draw(); })();
 function draw() {
  if (!section.isConnected) return;
  const total = name => Number((data.byEvent.find(r => r.event === name) || {}).n || 0);
  const list = (title, rows, label) => h('div', { class: 'admin-card' }, h('h2', { class: 'admin-card-title', text: title }),
   rows.length ? h('div', { class: 'admin-table-wrap' }, h('table', {}, h('tbody', {}, rows.map(r => h('tr', {}, h('td', { text: label(r) }), h('td', { class: 'is-num', text: String(r.n) })))))) : h('p', { class: 'admin-help', text: tx.noStats }));
  fill(section, pageHead(tx.statsTitle, tx.statsHint),
   error ? h('p', { class: 'admin-message error', role: 'alert', text: error }) : null,
   !data && !error ? h('div', { class: 'admin-card' }, skeleton(3)) : null,
   data ? [h('div', { class: 'admin-stats' }, stat(tx.pageViews, total('page_view')), stat(tx.propertyViews, total('property_view'), 'ok'), stat(tx.guideViews, total('guide_view'), 'accent')),
    list(tx.sources, data.bySource, r => r.source), list(tx.topListings, data.byListing, r => '#' + r.reference)] : null);
 }
 draw();
}

// ---- Activity log ----
function auditTab(panel) {
 const c = COPY[lang];
 const head = () => pageHead(c.audit, c.auditHint);
 const section = h('section', { class: 'admin-page' }, head(), h('div', { class: 'admin-card' }, skeleton(5)));
 fill(panel, section);
 api('audit').then(({ events }) => {
  const tone = a => /delete|deactivate|hide/.test(a) ? 'danger' : /accept|activate|confirm|show|password/.test(a) ? 'ok' : 'neutral';
  fill(section, head(), h('div', { class: 'admin-card' }, !events.length ? h('div', { class: 'admin-empty' }, icon('history', 26), h('p', { text: c.emptyAudit })) : h('div', { class: 'admin-table-wrap' }, h('table', {},
   h('thead', {}, h('tr', {}, [c.date, c.action, c.actor, c.target].map(x => h('th', { text: x })))),
   h('tbody', {}, events.map(e => h('tr', {}, h('td', { class: 'admin-nowrap', text: shortDate(e.at * 1000) }), h('td', {}, h('span', { class: 'admin-event is-' + tone(e.action), text: c.actions[e.action] || e.action })), h('td', {}, h('div', { class: 'admin-person is-compact' }, avatar(e.actor), h('span', { text: e.actor }))), h('td', {}, h('code', { text: e.target })))))))));
 }).catch(e => { if (!handle(e)) fill(section, head(), h('p', { class: 'admin-message error', role: 'alert', text: c.error })); });
}

// ---- Invite a member (owner only) ----
function inviteTab(panel) {
 const c = COPY[lang], tx = INVITE[lang];
 let members = null, message = null, busy = false, confirm = null;
 const input = h('input', { type: 'email', required: true, maxlength: 150, autocomplete: 'off' });
 const section = h('section', { class: 'admin-card admin-invite' }), list = h('section', { class: 'admin-card' });
 fill(panel, h('section', { class: 'admin-page' }, pageHead(tx.tab, tx.text), h('div', { class: 'admin-invite-layout' }, section, list)));
 async function loadTeam() { try { members = (await api('team')).members; } catch (e) { if (handle(e)) return; members = []; } drawTeam(); }
 async function act(m, action) {
  busy = true; message = null; drawTeam();
  try { const r = await api('team/' + action, { id: m.id }); confirm = null; if (action === 'resend') message = { text: fmt(r.mailed ? tx.resent : tx.sentNoMail, { email: m.email }), error: !r.mailed }; }
  catch (e) { if (handle(e)) return; message = { text: e.code === 'rate' ? c.rate : tx.error, error: true }; }
  busy = false; draw(); loadTeam();
 }
 function drawTeam() {
  if (!list.isConnected) return;
  fill(list, h('h2', { class: 'admin-card-title' }, tx.team, members ? h('span', { class: 'admin-count', text: members.length }) : null),
   !members ? skeleton(3) : h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.email, tx.role, tx.state, tx.since, ''].map(x => h('th', { text: x })))),
    h('tbody', {}, members.map(m => h('tr', { class: m.active ? null : 'is-hidden' },
     h('td', {}, h('div', { class: 'admin-person is-compact' }, avatar(m.email), h('span', { text: m.email }))),
     h('td', { text: tx[m.role] || m.role }),
     h('td', {}, h('span', { class: 'admin-badge' + (!m.active ? ' is-muted' : m.pending ? '' : ' is-ok'), text: !m.active ? tx.inactive : m.pending ? tx.pending : tx.activeLabel })),
     h('td', { class: 'admin-nowrap', text: day(m.created_at * 1000) }),
     h('td', {}, m.role === 'owner' ? null : confirm === m.id
      ? h('div', { class: 'buyer-enquiry-confirm', role: 'group' }, h('p', { text: fmt(tx.confirmDeactivate, { email: m.email }) }), h('button', { type: 'button', class: 'admin-secondary enquiry-delete', disabled: busy, onclick: () => act(m, 'deactivate'), text: tx.yes }), h('button', { type: 'button', class: 'admin-secondary', disabled: busy, onclick: () => { confirm = null; drawTeam(); }, text: c.cancel }))
      : h('div', { class: 'admin-row-actions' },
        m.active ? h('button', { type: 'button', class: 'admin-secondary', disabled: busy, onclick: () => act(m, 'resend') }, icon('mail', 14), tx.resend) : null,
        m.active ? h('button', { type: 'button', class: 'admin-secondary is-danger', disabled: busy, onclick: () => { confirm = m.id; drawTeam(); }, text: tx.deactivate })
         : h('button', { type: 'button', class: 'admin-secondary', disabled: busy, onclick: () => act(m, 'activate'), text: tx.activate })))))))));
 }
 const submit = h('button', { class: 'admin-primary', type: 'submit', text: tx.send });
 const form = h('form', { onsubmit: async e => {
  e.preventDefault(); if (busy) return; busy = true; message = null; draw();
  const email = input.value.trim();
  try { const r = await api('invite', { email, language: lang }); message = { text: fmt(r.mailed ? tx.sent : tx.sentNoMail, { email }), error: !r.mailed }; input.value = ''; loadTeam(); }
  catch (err) { if (handle(err)) return; message = { text: err.code === 'already_staff' ? tx.already : err.code === 'invalid_input' ? tx.invalid : err.code === 'rate' ? c.rate : tx.error, error: true }; }
  busy = false; draw();
 } }, h('label', { class: 'admin-field' }, tx.email, input), h('p', { class: 'admin-help', text: tx.hint }), submit);
 function draw() {
  submit.disabled = busy; input.disabled = busy; fill(submit, icon('mail', 15), busy ? c.loading : tx.send);
  fill(section, h('span', { class: 'admin-card-icon' }, icon('userPlus', 20)), h('h2', { class: 'admin-card-title', text: tx.title }),
   message ? h('p', { class: 'admin-message ' + (message.error ? 'error' : 'success'), role: message.error ? 'alert' : 'status', text: message.text }) : null,
   form);
 }
 draw(); drawTeam(); loadTeam();
}

window.addEventListener('hashchange', () => { const link = /^#(set|invite)=([A-Za-z0-9_-]{43})$/.exec(location.hash); if (link) { linkToken = link[2]; try { history.replaceState(null, '', location.pathname); } catch {} render(); return; } const v = location.hash.slice(1); if (v !== tab && ['enquiries', 'accounts', 'listings', 'stats', 'audit', 'invite'].includes(v)) { tab = v; render(); } });
render();
})();
