// Motel à vendre staff workspace. Same structure, wording and styles as the
// Propriété En Vente admin (frontend/src/admin.tsx, buyer-enquiries.tsx), without a framework.
// Sign-in uses the existing staff accounts (Supabase Auth). The access token is kept in
// sessionStorage for this tab only and sent to Supabase and /api/admin/*.
(function () {
'use strict';
// site-config.js declares a top-level const, visible to this classic script but not on window.
const SITE = (typeof MAV_SITE !== 'undefined' && MAV_SITE) || {};
const SB = SITE.endpoint ? new URL(SITE.endpoint).origin : '';
const KEY = SITE.publishableKey || '';
const MAIN_ADMIN = 'https://proprieteenvente.ca/#admin';
const root = document.getElementById('admin-root');
const local = ['127.0.0.1', 'localhost'].includes(location.hostname);

// ---- Copy (wording follows the main admin and its buyer inbox) ----
const COPY = {
 fr: {
  title: 'Espace administration', eyebrow: 'MOTELAVENDRE · ÉQUIPE', intro: 'Traitez les demandes, les comptes acheteurs et l’affichage des annonces de Motel à vendre depuis un seul endroit.',
  back: 'Retour au site', login: 'Se connecter', loginTitle: 'Connectez-vous avec votre compte d’équipe', loginText: 'Cet espace est réservé aux membres autorisés. Utilisez le même compte que l’administration de Propriété En Vente.',
  email: 'Courriel', password: 'Mot de passe', forgot: 'Mot de passe oublié ? Réinitialisez-le depuis l’administration de Propriété En Vente.', badLogin: 'Courriel ou mot de passe incorrect.',
  noAccess: 'Accès réservé à l’équipe', noAccessText: 'Ce compte n’est pas un compte d’administration actif. Demandez une invitation au propriétaire de la plateforme.',
  setup: 'Connexion au serveur à configurer', setupText: 'La configuration du site ne contient pas l’adresse du service.', expired: 'Votre session a expiré. Connectez-vous de nouveau.',
  loading: 'Chargement…', work: 'Travail', management: 'Gestion', signOut: 'Se déconnecter', refresh: 'Actualiser', original: 'Administration Propriété En Vente',
  error: 'Impossible de charger les données. Réessayez après avoir vérifié votre connexion et vos droits d’accès.', unavailable: 'Service momentanément indisponible. Réessayez dans un instant.',
  previous: 'Précédent', next: 'Suivant', cancel: 'Annuler', saving: 'Enregistrement…', saveError: 'Enregistrement impossible. Les données ont été actualisées.',
  status: 'Rôle', audit: 'Journal des opérations', emptyAudit: 'Aucune opération à afficher.', date: 'Date', action: 'Opération', actor: 'Compte responsable', target: 'Élément',
  actions: { staff_invite: 'Membre invité', account_confirm: 'Compte confirmé manuellement', account_delete: 'Compte supprimé', listing_hide: 'Annonce masquée', listing_show: 'Annonce affichée', listing_pin: 'Annonce épinglée', listing_unpin: 'Annonce désépinglée' },
  local: 'Aperçu local : comptes acheteurs et réglages d’annonces de ce poste (base locale). Les demandes viennent du service réel.'
 },
 en: {
  title: 'Admin workspace', eyebrow: 'MOTELAVENDRE · TEAM', intro: 'Handle Motel à vendre enquiries, buyer accounts and listing display from one place.',
  back: 'Back to website', login: 'Sign in', loginTitle: 'Sign in with your team account', loginText: 'This area is reserved for authorized members. Use the same account as the Propriété En Vente admin.',
  email: 'Email', password: 'Password', forgot: 'Forgot your password? Reset it from the Propriété En Vente admin.', badLogin: 'Incorrect email or password.',
  noAccess: 'Team access only', noAccessText: 'This account is not an active admin account. Ask the platform owner for an invitation.',
  setup: 'Server connection required', setupText: 'The site configuration has no service address.', expired: 'Your session expired. Please sign in again.',
  loading: 'Loading…', work: 'Work', management: 'Management', signOut: 'Sign out', refresh: 'Refresh', original: 'Propriété En Vente admin',
  error: 'Could not load data. Check your connection and access rights, then try again.', unavailable: 'Service temporarily unavailable. Try again shortly.',
  previous: 'Previous', next: 'Next', cancel: 'Cancel', saving: 'Saving…', saveError: 'Could not save. The data has been refreshed.',
  status: 'Role', audit: 'Activity log', emptyAudit: 'No activity to show.', date: 'Date', action: 'Action', actor: 'Account', target: 'Item',
  actions: { staff_invite: 'Staff invited', account_confirm: 'Account confirmed manually', account_delete: 'Account deleted', listing_hide: 'Listing hidden', listing_show: 'Listing shown', listing_pin: 'Listing pinned', listing_unpin: 'Listing unpinned' },
  local: 'Local preview: buyer accounts and listing settings come from this computer’s local database. Enquiries come from the live service.'
 },
 zh: {
  title: '管理工作台', eyebrow: 'MOTELAVENDRE · 团队', intro: '在同一个入口处理 Motel à vendre 的买家咨询、买家账户和房源展示。',
  back: '返回网站', login: '登录', loginTitle: '使用团队账号登录', loginText: '此区域仅向获得授权的工作人员开放。请使用与 Propriété En Vente 管理后台相同的账号。',
  email: '邮箱', password: '密码', forgot: '忘记密码？请在 Propriété En Vente 管理后台重置。', badLogin: '邮箱或密码不正确。',
  noAccess: '仅限授权团队成员', noAccessText: '此账号不是有效的管理员账号。请向平台所有者申请邀请。',
  setup: '需要配置后端连接', setupText: '网站配置中缺少服务地址。', expired: '登录已过期，请重新登录。',
  loading: '加载中…', work: '工作', management: '管理', signOut: '退出登录', refresh: '刷新', original: 'Propriété En Vente 主站后台',
  error: '无法加载资料。请检查网络和账号权限后重试。', unavailable: '服务暂时不可用，请稍后再试。',
  previous: '上一页', next: '下一页', cancel: '取消', saving: '正在保存…', saveError: '保存失败，已重新获取最新数据。',
  status: '角色', audit: '操作记录', emptyAudit: '暂无操作记录。', date: '时间', action: '操作', actor: '操作账号', target: '对象',
  actions: { staff_invite: '邀请团队成员', account_confirm: '手动确认账户', account_delete: '删除账户', listing_hide: '隐藏房源', listing_show: '显示房源', listing_pin: '置顶房源', listing_unpin: '取消置顶' },
  local: '本地预览：买家账户和房源设置来自本机的本地数据库；买家咨询来自正式服务。'
 }
};
// Buyer inbox copy: Propriété En Vente buyer-enquiries.tsx, with Motel seller fields added.
const INBOX = {
 en: { title: 'Buyer enquiries', hint: 'Each enquiry sent from motelavendre.ca appears individually. Each enquiry is emailed individually when email delivery is configured.', autoRefresh: 'Updates automatically every 15 seconds and when you return to this page.', loading: 'Loading…', error: 'Could not sync enquiries. The system will retry automatically.', empty: 'No enquiries yet.', date: 'Submitted', name: 'Name', email: 'Email', phone: 'Phone', city: 'Preferred cities', min: 'Minimum budget (CAD)', max: 'Maximum budget (CAD)', expectedPrice: 'Expected price (CAD)', address: 'Address', requirements: 'Requirements', timeline: 'Timeline', contactLanguage: 'Contact language', contactMethod: 'Contact method', contactTime: 'Contact availability', details: 'View request', seller: 'Seller', buyer: 'Buyer' },
 fr: { title: 'Demandes d’achat', hint: 'Chaque demande envoyée depuis motelavendre.ca apparaît individuellement. Chaque demande est envoyée individuellement lorsque le service courriel est configuré.', autoRefresh: 'Mise à jour automatique toutes les 15 secondes et à votre retour sur la page.', loading: 'Chargement…', error: 'Impossible de synchroniser les demandes. Une nouvelle tentative sera faite automatiquement.', empty: 'Aucune demande pour le moment.', date: 'Date de réception', name: 'Nom', email: 'Courriel', phone: 'Téléphone', city: 'Villes recherchées', min: 'Budget minimum (CAD)', max: 'Budget maximum (CAD)', expectedPrice: 'Prix souhaité (CAD)', address: 'Adresse', requirements: 'Critères', timeline: 'Échéancier', contactLanguage: 'Langue de contact', contactMethod: 'Moyen de contact', contactTime: 'Disponibilités', details: 'Voir la demande', seller: 'Vendeur', buyer: 'Acheteur' },
 zh: { title: '买家咨询', hint: '在 motelavendre.ca 提交的每条咨询都会单独显示。配置发信服务后，每条咨询另行发送邮件通知。', autoRefresh: '每 15 秒自动同步；返回此页面时也会立即更新。', loading: '正在加载…', error: '咨询暂时无法同步，系统会自动重试。', empty: '目前还没有咨询。', date: '提交时间', name: '姓名', email: '邮箱', phone: '电话', city: '意向城市', min: '最低预算（加元）', max: '最高预算（加元）', expectedPrice: '期望售价（加元）', address: '地址', requirements: '购房要求', timeline: '计划时间', contactLanguage: '联系语言', contactMethod: '联系方式', contactTime: '方便联系的时间', details: '查看需求', seller: '卖家', buyer: '买家' }
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
 en: { title: 'Buyer accounts', hint: 'Accounts created on motelavendre.ca. Unconfirmed accounts are removed automatically after 7 days.', search: 'Search by email, name or phone', all: 'All', verified: 'Confirmed', unverified: 'Not confirmed', total: 'Accounts', confirmedCount: 'Confirmed', empty: 'No matching accounts.', person: 'Account', status: 'Status', created: 'Created', lastSignin: 'Last sign-in', activity: 'Saved · searches · enquiries', actions: 'Actions', confirmBtn: 'Confirm manually', deleteBtn: 'Delete', confirmDelete: 'Permanently delete {email}? Their profile, saved listings, saved searches and enquiry history are erased. This cannot be undone.', yes: 'Delete permanently', confirmed: 'Account confirmed. The buyer can sign in now.', deleted: 'Account deleted.', never: 'Never', budget: 'Budget', regions: 'Regions' },
 fr: { title: 'Comptes acheteurs', hint: 'Comptes créés sur motelavendre.ca. Les comptes non confirmés sont supprimés automatiquement après 7 jours.', search: 'Rechercher par courriel, nom ou téléphone', all: 'Tous', verified: 'Confirmés', unverified: 'Non confirmés', total: 'Comptes', confirmedCount: 'Confirmés', empty: 'Aucun compte correspondant.', person: 'Compte', status: 'État', created: 'Création', lastSignin: 'Dernière connexion', activity: 'Favoris · recherches · demandes', actions: 'Actions', confirmBtn: 'Confirmer manuellement', deleteBtn: 'Supprimer', confirmDelete: 'Supprimer définitivement {email} ? Le profil, les favoris, les recherches et l’historique des demandes seront effacés. Action irréversible.', yes: 'Supprimer définitivement', confirmed: 'Compte confirmé. L’acheteur peut maintenant se connecter.', deleted: 'Compte supprimé.', never: 'Jamais', budget: 'Budget', regions: 'Régions' },
 zh: { title: '买家账户', hint: '在 motelavendre.ca 注册的账户。未确认邮箱的账户会在 7 天后自动删除。', search: '按邮箱、姓名或电话搜索', all: '全部', verified: '已确认', unverified: '未确认', total: '账户总数', confirmedCount: '已确认', empty: '没有符合条件的账户。', person: '账户', status: '状态', created: '注册时间', lastSignin: '最近登录', activity: '收藏 · 搜索 · 咨询', actions: '操作', confirmBtn: '手动确认', deleteBtn: '删除', confirmDelete: '永久删除 {email}？其资料、收藏、保存的搜索和咨询记录都会被清除，无法恢复。', yes: '永久删除', confirmed: '账户已确认，买家现在可以登录了。', deleted: '账户已删除。', never: '从未', budget: '预算', regions: '意向地区' }
};
const LISTINGS = {
 en: { title: 'Listings on this site', hint: 'Hotel and motel listings published on Propriété En Vente. Hiding or pinning only affects motelavendre.ca; edit the listing itself in the main admin.', delay: 'Changes appear on the public site within one minute.', empty: 'No published hotel or motel listings.', ref: 'Listing', place: 'Location', price: 'Price', photos: 'Photos', published: 'Published', state: 'On this site', actions: 'Actions', shown: 'Shown', hidden: 'Hidden', pinned: 'Pinned', illustrative: 'Illustrative photo', hide: 'Hide', show: 'Show', pin: 'Pin to top', unpin: 'Unpin', view: 'View', catalogue: 'The main catalogue is unavailable right now. Try again shortly.', counts: '{shown} shown · {hidden} hidden · {pinned} pinned' },
 fr: { title: 'Annonces sur ce site', hint: 'Annonces d’hôtels et de motels publiées sur Propriété En Vente. Masquer ou épingler ne concerne que motelavendre.ca; modifiez l’annonce elle-même dans l’administration principale.', delay: 'Les changements apparaissent sur le site public en moins d’une minute.', empty: 'Aucune annonce d’hôtel ou de motel publiée.', ref: 'Annonce', place: 'Lieu', price: 'Prix', photos: 'Photos', published: 'Publication', state: 'Sur ce site', actions: 'Actions', shown: 'Affichée', hidden: 'Masquée', pinned: 'Épinglée', illustrative: 'Photo d’illustration', hide: 'Masquer', show: 'Afficher', pin: 'Épingler en tête', unpin: 'Désépingler', view: 'Voir', catalogue: 'Le catalogue principal est momentanément indisponible. Réessayez dans un instant.', counts: '{shown} affichées · {hidden} masquées · {pinned} épinglées' },
 zh: { title: '本站房源', hint: '在 Propriété En Vente 发布的酒店/汽车旅馆房源。隐藏和置顶只影响 motelavendre.ca；修改房源内容请到主站后台。', delay: '修改会在 1 分钟内同步到公开网站。', empty: '目前没有已发布的酒店/汽车旅馆房源。', ref: '房源', place: '位置', price: '价格', photos: '照片', published: '发布时间', state: '本站状态', actions: '操作', shown: '显示中', hidden: '已隐藏', pinned: '已置顶', illustrative: '示意图', hide: '隐藏', show: '显示', pin: '置顶', unpin: '取消置顶', view: '查看', catalogue: '主站房源目录暂时无法读取，请稍后再试。', counts: '显示 {shown} · 隐藏 {hidden} · 置顶 {pinned}' }
};
const INVITE = {
 fr: { tab: 'Inviter un membre', title: 'Inviter un administrateur des opérations', text: 'L’invitation donne accès aux demandes, aux comptes acheteurs et aux annonces de Motel à vendre, ainsi qu’à l’administration de Propriété En Vente. Elle ne permet pas d’inviter d’autres administrateurs.', email: 'Adresse courriel professionnelle', send: 'Envoyer l’invitation', hint: 'La personne doit d’abord avoir un compte confirmé sur proprieteenvente.ca. Elle reçoit ensuite un courriel et se connecte ici avec ce même compte.', sent: 'Accès accordé. Un courriel a été envoyé à {email}.', sentNoMail: 'Accès accordé à {email}, mais le courriel n’a pas pu être envoyé. Prévenez la personne directement.', notFound: 'Aucun compte Propriété En Vente ne correspond à cette adresse. Demandez à la personne de créer un compte sur proprieteenvente.ca et de confirmer son courriel, puis réessayez.', already: 'Ce compte fait déjà partie de l’équipe.', invalid: 'Adresse invalide, ou c’est votre propre compte.', error: 'L’invitation n’a pas pu être finalisée. Réessayez dans un instant.', team: 'Membres de l’équipe', owner: 'Propriétaire', operator: 'Administrateur', inactive: 'Inactif', since: 'Depuis', signup: 'Créer un compte sur proprieteenvente.ca' },
 en: { tab: 'Invite a member', title: 'Invite an operations administrator', text: 'The invitation gives access to Motel à vendre enquiries, buyer accounts and listings, and to the Propriété En Vente admin. It does not allow inviting other administrators.', email: 'Work email address', send: 'Send invitation', hint: 'The person must first have a confirmed account on proprieteenvente.ca. They then receive an email and sign in here with that same account.', sent: 'Access granted. An email was sent to {email}.', sentNoMail: 'Access granted to {email}, but the email could not be sent. Let them know directly.', notFound: 'No Propriété En Vente account matches this address. Ask the person to create an account on proprieteenvente.ca and confirm their email, then try again.', already: 'This account is already on the team.', invalid: 'Invalid address, or this is your own account.', error: 'The invitation could not be completed. Try again shortly.', team: 'Team members', owner: 'Owner', operator: 'Administrator', inactive: 'Inactive', since: 'Since', signup: 'Create an account on proprieteenvente.ca' },
 zh: { tab: '邀请成员', title: '邀请运营管理员', text: '受邀成员可以处理 Motel à vendre 的咨询、买家账户和房源，也可以使用 Propriété En Vente 主站后台，但不能再邀请其他管理员。', email: '工作邮箱', send: '发送邀请', hint: '对方需要先在 proprieteenvente.ca 注册账号并确认邮箱。邀请成功后对方会收到邮件，用同一个账号在这里登录。', sent: '已开通权限，并已向 {email} 发送通知邮件。', sentNoMail: '已为 {email} 开通权限，但通知邮件没有发出，请直接告诉对方。', notFound: '这个邮箱还没有 Propriété En Vente 账号。请对方先在 proprieteenvente.ca 注册并确认邮箱，然后再邀请。', already: '这个账号已经是团队成员。', invalid: '邮箱无效，或者这是您自己的账号。', error: '邀请未能完成，请稍后再试。', team: '团队成员', owner: '所有者', operator: '管理员', inactive: '已停用', since: '加入时间', signup: '在 proprieteenvente.ca 注册账号' }
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
 userPlus: ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M19 8v6', 'M22 11h-6']
};
function icon(name, size = 16) {
 const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
 for (const [k, v] of Object.entries({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', class: 'admin-icon' })) svg.setAttribute(k, v);
 for (const d of ICONS[name]) { const p = document.createElementNS(ns, 'path'); p.setAttribute('d', d); svg.appendChild(p); }
 return svg;
}

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
const store = { get(k) { try { return sessionStorage.getItem(k); } catch { return null; } }, set(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch {} } };
let lang = (() => { try { const v = localStorage.getItem('mav_admin_lang'); if (COPY[v]) return v; } catch {} const n = (navigator.language || '').toLowerCase(); return n.startsWith('zh') ? 'zh' : n.startsWith('en') ? 'en' : 'fr'; })();
let session = (() => { try { return JSON.parse(store.get('mav_admin_session') || 'null'); } catch { return null; } })();
let tab = ['enquiries', 'accounts', 'listings', 'audit', 'invite'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'enquiries';
let staffEmail = '', staffRole = '', gateNotice = '', timers = [];
const t = () => COPY[lang];

class Failure extends Error { constructor(status, code) { super(code || String(status)); this.status = status; this.code = code; } }

// ---- Supabase Auth (password grant, same accounts as the main admin) ----
async function auth(grant, body) {
 const r = await fetch(SB + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Failure(r.status, data.error_code || data.error || 'auth');
 return { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: Date.now() + (Number(data.expires_in) || 3600) * 1000 };
}
function saveSession(s) { session = s; store.set('mav_admin_session', s ? JSON.stringify(s) : null); }
let refreshing = null;
async function token() {
 if (!session) throw new Failure(401, 'signin_required');
 if (session.expires_at - Date.now() > 60000) return session.access_token;
 refreshing = refreshing || auth('refresh_token', { refresh_token: session.refresh_token }).then(saveSession).finally(() => { refreshing = null; });
 try { await refreshing; } catch { saveSession(null); throw new Failure(401, 'signin_required'); }
 return session.access_token;
}
async function rpc(name, args) {
 const r = await fetch(SB + '/rest/v1/rpc/' + name, { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + await token(), 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
 const data = await r.json().catch(() => null);
 if (!r.ok) throw new Failure(r.status, data && data.message);
 return data;
}
async function api(path, payload) {
 const init = { headers: { Authorization: 'Bearer ' + await token() } };
 if (payload) { init.method = 'POST'; init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(payload); }
 const r = await fetch('/api/admin/' + path, init);
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Failure(r.status, data.error);
 return data;
}
// A rejected session sends the user back to the sign-in screen; anything else is shown in place.
function handle(error) {
 if (error && (error.status === 401 || error.code === 'signin_required')) { saveSession(null); gateNotice = t().expired; render(); return true; }
 if (error && error.status === 403 && error.code === 'staff_required') { staffEmail = ''; clearTimers(); fill(root, gate(t().noAccess, t().noAccessText)); return true; }
 return false;
}

// ---- Layout ----
function langSwitch() {
 return h('div', { class: 'admin-lang', role: 'group', 'aria-label': 'Langue / Language / 语言' }, Object.keys(COPY).map(l => h('button', { type: 'button', 'aria-pressed': String(l === lang), onclick: () => { lang = l; try { localStorage.setItem('mav_admin_lang', l); } catch {} render(); } }, LANG_NAMES[l])));
}
function setDocLang() { document.documentElement.lang = { fr: 'fr-CA', en: 'en-CA', zh: 'zh-Hans' }[lang]; document.title = t().title + ' | Motel à vendre'; }
function clearTimers() { for (const id of timers) clearInterval(id); timers = []; }

function gate(title, text, form) {
 const c = t(), children = [langSwitch(), icon('lock', 32), h('h1', { text: title }), h('p', { text: text })];
 if (form) {
  const err = h('p', { role: 'alert', hidden: !gateNotice, text: gateNotice });
  const email = h('input', { type: 'email', name: 'email', autocomplete: 'username', required: true, maxlength: 254 });
  const password = h('input', { type: 'password', name: 'password', autocomplete: 'current-password', required: true, maxlength: 128 });
  const submit = h('button', { class: 'admin-primary', type: 'submit', text: c.login });
  children.push(h('form', { class: 'admin-login', onsubmit: async e => {
   e.preventDefault(); submit.disabled = true; err.hidden = true;
   try { saveSession(await auth('password', { email: email.value.trim(), password: password.value })); gateNotice = ''; await start(); }
   catch (error) { err.textContent = error.status === 400 || error.status === 401 ? c.badLogin : c.unavailable; err.hidden = false; submit.disabled = false; password.value = ''; password.focus(); }
  } }, h('label', {}, c.email, email), h('label', {}, c.password, password), err, submit, h('a', { href: MAIN_ADMIN, rel: 'noopener', text: c.forgot })));
 } else if (session) {
  children.push(h('button', { class: 'admin-primary', type: 'button', onclick: signOut }, c.signOut));
 }
 children.push(h('a', { href: '/' + lang + '/', text: c.back }));
 return h('main', { class: 'admin-gate' }, children);
}

async function signOut() {
 const s = session; saveSession(null); staffEmail = ''; staffRole = ''; clearTimers();
 if (s) fetch(SB + '/auth/v1/logout', { method: 'POST', headers: { apikey: KEY, Authorization: 'Bearer ' + s.access_token } }).catch(() => {});
 render();
}

async function start() {
 fill(root, h('main', { class: 'admin-gate', 'aria-busy': 'true', text: t().loading }));
 try { const me = await api('me'); staffEmail = me.email; staffRole = me.role; }
 catch (error) {
  if (error.status === 403 && error.code === 'staff_required') { staffEmail = ''; fill(root, gate(t().noAccess, t().noAccessText)); return; }
  if (error.status === 401) { saveSession(null); gateNotice = t().expired; render(); return; }
  // Service down: show a retry screen instead of looping.
  const screen = gate(t().title, t().unavailable);
  screen.insertBefore(h('button', { class: 'admin-primary', type: 'button', onclick: start }, icon('refresh', 16), t().refresh), screen.lastChild);
  fill(root, screen); return;
 }
 render();
}

function render() {
 setDocLang(); clearTimers();
 const c = t();
 if (!SB || !KEY) { fill(root, gate(c.setup, c.setupText)); return; }
 if (!session) { fill(root, gate(c.loginTitle, c.loginText, true)); return; }
 if (!staffEmail) { start(); return; }
 const nav = (id, name, label) => h('button', { type: 'button', class: tab === id ? 'active' : '', 'aria-current': tab === id ? 'page' : null, onclick: () => { tab = id; history.replaceState(null, '', '#' + id); render(); } }, icon(name, 18), label);
 const panel = h('div', { 'aria-live': 'polite' });
 fill(root, h('main', { class: 'admin-app admin-horizontal' },
  h('header', { class: 'admin-sidebar admin-toolbar' },
   h('a', { href: '/' + lang + '/', class: 'admin-back' }, icon('back'), c.back),
   h('div', { class: 'admin-brand' }, icon('shield', 30), h('strong', {}, 'Motel à vendre', h('small', { text: c.title }))),
   h('nav', { 'aria-label': c.title },
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.work }), nav('enquiries', 'message', INBOX[lang].title)),
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.management }), nav('accounts', 'users', ACCOUNTS[lang].title), nav('listings', 'home', LISTINGS[lang].title), nav('audit', 'history', c.audit), staffRole === 'owner' ? nav('invite', 'userPlus', INVITE[lang].tab) : null)),
   h('a', { class: 'admin-seller-link', href: MAIN_ADMIN, rel: 'noopener' }, c.original, icon('external', 14)),
   h('div', { class: 'admin-account' }, langSwitch(), h('span', { class: 'admin-who', text: staffEmail }), h('button', { type: 'button', class: 'admin-secondary', onclick: signOut, text: c.signOut }))),
  h('section', { class: 'admin-content' },
   h('header', { class: 'admin-heading' }, h('div', {}, h('span', { text: c.eyebrow }), h('h1', { text: c.title }), h('p', { text: c.intro }))),
   local ? h('p', { class: 'admin-local', text: c.local }) : null,
   panel)));
 if (tab === 'invite' && staffRole !== 'owner') tab = 'enquiries';
 ({ enquiries: enquiriesTab, accounts: accountsTab, listings: listingsTab, audit: auditTab, invite: inviteTab })[tab](panel);
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
 const section = h('section', { class: 'admin-panel buyer-enquiries' });
 fill(panel, section);

 async function load() {
  if (inFlight) return; inFlight = true; const version = ++generation; error = false;
  try { const data = await rpc('list_motel_enquiries', { p_filter: filter, p_offset: offset }) || []; if (version !== generation) return; rows = data.slice(0, 50); more = data.length > 50; }
  catch (e) { if (handle(e)) return; if (version === generation) error = true; }
  finally { inFlight = false; if (version === generation) { loading = false; draw(); } }
 }
 async function review(row, action) {
  if (busy) return; busy = row.id; actionError = false; generation++; draw();
  try { await rpc('review_motel_enquiry', { p_id: row.id, p_revision: row.revision ?? 0, p_action: action }); confirmDelete = null; rows = rows.filter(r => r.id !== row.id); }
  catch (e) { if (handle(e)) return; actionError = true; }
  finally { busy = null; draw(); load(); }
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
    h('div', { class: 'buyer-enquiry-meta' }, h('span', { class: 'buyer-enquiry-status is-' + status, text: a[status] }), p.kind === 'seller' ? h('span', { class: 'buyer-enquiry-reference', text: tx.seller }) : null, h('time', { datetime: row.created_at, title: date(row.created_at) }, icon('clock', 13), shortDate(row.created_at))),
    h('div', { class: 'buyer-enquiry-actions' },
     row.deleted_at ? btn('enquiry-restore', 'undo', a.restore, () => review(row, 'restore'))
      : [btn('enquiry-accept', row.review_status === 'accepted' ? 'undo' : 'check', row.review_status === 'accepted' ? a.reopen : a.accept, () => review(row, row.review_status === 'accepted' ? 'reopen' : 'accept')),
         btn('enquiry-delete', 'trash', a.remove, () => { confirmDelete = row.id; draw(); })],
     busy === row.id ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: a.saving }) : null)),
   confirmDelete === row.id ? h('div', { class: 'buyer-enquiry-confirm', role: 'group', 'aria-label': a.remove }, h('p', { text: a.confirm }),
    h('button', { type: 'button', class: 'admin-secondary enquiry-delete', disabled: !!busy, onclick: () => review(row, 'delete'), text: a.yes }),
    h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => { confirmDelete = null; draw(); }, text: a.cancel })) : null,
   h('div', { class: 'buyer-enquiry-topline' },
    h('div', { class: 'buyer-enquiry-person' }, h('h3', { id: 'enquiry-person-' + row.id, text: p.name || '—' }),
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
   h('div', { class: 'buyer-enquiries-heading' }, h('div', {}, h('h2', { text: tx.title }), h('p', { text: tx.hint }), h('p', { class: 'admin-sync-note', text: tx.autoRefresh })),
    h('button', { type: 'button', class: 'admin-secondary buyer-enquiry-export', disabled: loading || !rows.length, onclick: exportCsv }, icon('download', 15), pc.export)),
   h('div', { class: 'buyer-enquiry-filters', role: 'group', 'aria-label': tx.title }, ['active', 'pending', 'accepted', 'deleted'].map(key => h('button', { type: 'button', class: 'admin-secondary', 'aria-pressed': String(filter === key), disabled: !!busy, onclick: () => { if (key === filter) return; filter = key; offset = 0; rows = []; loading = true; confirmDelete = null; actionError = false; generation++; inFlight = false; draw(); load(); } }, a[key]))),
   actionError ? h('p', { role: 'alert', text: a.error }) : null,
   error ? h('p', { role: 'alert', text: tx.error }) : null,
   loading && !rows.length ? h('p', { role: 'status', text: tx.loading }) : !rows.length && !error ? h('p', { text: tx.empty }) : rows.length ? h('div', { class: 'buyer-enquiry-list' }, rows.map(card)) : null,
   h('div', { class: 'buyer-enquiry-pagination' },
    h('button', { class: 'admin-secondary', disabled: loading || !!busy || offset === 0, onclick: () => { offset = Math.max(0, offset - 50); loading = true; generation++; inFlight = false; draw(); load(); }, text: COPY[lang].previous }),
    h('button', { class: 'admin-secondary', disabled: loading || !!busy || !more || error, onclick: () => { offset += 50; loading = true; generation++; inFlight = false; draw(); load(); }, text: COPY[lang].next })));
 }
 draw(); load();
 timers.push(setInterval(() => { if (document.visibilityState !== 'hidden' && !busy && confirmDelete === null) load(); }, 15000));
}

// ---- Buyer accounts (D1) ----
function accountsTab(panel) {
 const c = COPY[lang], tx = ACCOUNTS[lang];
 let filter = 'all', q = '', offset = 0, data = null, error = '', notice = '', busy = null, confirmDelete = null, generation = 0;
 const section = h('section', { class: 'admin-panel buyer-enquiries' });
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
 const controls = h('div', { class: 'admin-search' }, search, select);
 function draw() {
  if (!section.isConnected) return;
  const body = [];
  if (!data && !error) body.push(h('p', { role: 'status', text: c.loading }));
  if (data) {
   body.push(h('p', { class: 'admin-stats' }, h('span', {}, tx.total + ' ', h('strong', { text: data.totals.total })), h('span', {}, tx.confirmedCount + ' ', h('strong', { text: data.totals.verified })), h('span', {}, tx.unverified + ' ', h('strong', { text: data.totals.total - data.totals.verified }))));
   if (!data.accounts.length) body.push(h('p', { class: 'admin-empty', text: tx.empty }));
   else body.push(h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.person, tx.status, tx.created, tx.lastSignin, tx.activity, tx.actions].map(x => h('th', { text: x })))),
    h('tbody', {}, data.accounts.map(u => {
     const profile = [u.full_name, u.phone].filter(Boolean).join(' · ');
     const prefs = [u.buyer_budget ? tx.budget + ' ' + money(u.buyer_budget) : '', u.buyer_regions ? tx.regions + ' ' + u.buyer_regions : ''].filter(Boolean).join(' · ');
     return h('tr', {},
      h('td', {}, h('a', { href: 'mailto:' + u.email, text: u.email }), profile ? h('br') : null, profile ? h('small', { text: profile }) : null, prefs ? h('br') : null, prefs ? h('small', { text: prefs }) : null),
      h('td', {}, h('span', { class: 'admin-badge' + (u.verified_at ? ' is-ok' : ''), text: u.verified_at ? tx.verified : tx.unverified })),
      h('td', { text: day(u.created_at * 1000) }),
      h('td', { text: u.last_signin ? shortDate(u.last_signin * 1000) : tx.never }),
      h('td', { text: u.saved + ' · ' + u.searches + ' · ' + u.enquiries }),
      h('td', {}, confirmDelete === u.id
       ? h('div', { class: 'buyer-enquiry-confirm', role: 'group' }, h('p', { text: fmt(tx.confirmDelete, { email: u.email }) }), h('button', { type: 'button', class: 'admin-secondary enquiry-delete', disabled: !!busy, onclick: () => act(u, 'delete'), text: tx.yes }), h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => { confirmDelete = null; draw(); }, text: c.cancel }))
       : h('div', { class: 'admin-row-actions' },
         u.verified_at ? null : h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => act(u, 'confirm') }, icon('check', 14), tx.confirmBtn),
         h('button', { type: 'button', class: 'admin-secondary is-danger', disabled: !!busy, onclick: () => { confirmDelete = u.id; draw(); } }, icon('trash', 14), tx.deleteBtn),
         busy === u.id ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: c.saving }) : null)));
    })))));
   body.push(h('div', { class: 'buyer-enquiry-pagination' },
    h('button', { class: 'admin-secondary', disabled: offset === 0, onclick: () => { offset = Math.max(0, offset - 50); load(); }, text: c.previous }),
    h('button', { class: 'admin-secondary', disabled: !data.more, onclick: () => { offset += 50; load(); }, text: c.next })));
  }
  fill(section, 
   h('div', { class: 'buyer-enquiries-heading' }, h('div', {}, h('h2', { text: tx.title }), h('p', { text: tx.hint }))),
   controls,
   notice ? h('p', { class: 'admin-message success', role: 'status', text: notice }) : null,
   error ? h('p', { class: 'admin-message error', role: 'alert', text: error }) : null,
   body);
 }
 draw(); load();
}

// ---- Listings on this site (main catalogue + D1 display settings) ----
function listingsTab(panel) {
 const c = COPY[lang], tx = LISTINGS[lang];
 let listings = null, error = '', busy = null;
 const section = h('section', { class: 'admin-panel buyer-enquiries' });
 fill(panel, section);
 async function load() {
  try { listings = (await api('listings')).listings; error = ''; }
  catch (e) { if (handle(e)) return; error = e.code === 'catalogue_unavailable' ? tx.catalogue : e.status === 503 ? c.unavailable : c.error; }
  draw();
 }
 async function set(item, change) {
  busy = item.reference; draw();
  try { const r = await api('listings', { reference: item.reference, ...change }); Object.assign(item, r); }
  catch (e) { if (handle(e)) return; error = c.saveError; }
  busy = null; load();
 }
 function draw() {
  if (!section.isConnected) return;
  const body = [];
  if (!listings && !error) body.push(h('p', { role: 'status', text: c.loading }));
  if (listings && !listings.length) body.push(h('p', { class: 'admin-empty', text: tx.empty }));
  if (listings && listings.length) {
   body.push(h('p', { class: 'admin-stats', text: fmt(tx.counts, { shown: listings.filter(l => !l.hidden).length, hidden: listings.filter(l => l.hidden).length, pinned: listings.filter(l => l.pinned && !l.hidden).length }) }));
   body.push(h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.ref, tx.place, tx.price, tx.photos, tx.published, tx.state, tx.actions].map(x => h('th', { text: x })))),
    h('tbody', {}, listings.map(l => h('tr', { class: l.hidden ? 'is-hidden' : null },
     h('td', {}, h('code', { text: '#' + l.reference })),
     h('td', {}, l.city || '—', l.region ? h('br') : null, l.region ? h('small', { text: l.region }) : null),
     h('td', { text: l.price === null ? '—' : money(l.price) }),
     h('td', {}, String(l.photos), l.illustrative ? h('br') : null, l.illustrative ? h('small', { text: tx.illustrative }) : null),
     h('td', { text: l.published_at ? day(l.published_at) : '—' }),
     h('td', {}, h('span', { class: 'admin-badge' + (l.hidden ? ' is-muted' : ' is-ok'), text: l.hidden ? tx.hidden : tx.shown }), l.pinned ? ' ' : null, l.pinned ? h('span', { class: 'admin-badge', text: tx.pinned }) : null,
      l.updated_by ? h('br') : null, l.updated_by ? h('small', { text: l.updated_by + ' · ' + shortDate(l.updated_at * 1000) }) : null),
     h('td', {}, h('div', { class: 'admin-row-actions' },
      h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy, onclick: () => set(l, { hidden: !l.hidden }), text: l.hidden ? tx.show : tx.hide }),
      h('button', { type: 'button', class: 'admin-secondary', disabled: !!busy || l.hidden, onclick: () => set(l, { pinned: !l.pinned }), text: l.pinned ? tx.unpin : tx.pin }),
      l.hidden ? null : h('a', { class: 'admin-secondary', href: propertyPath(l.reference), target: '_blank', rel: 'noopener noreferrer' }, tx.view, icon('arrowUp', 14)),
      busy === l.reference ? h('span', { class: 'buyer-enquiry-saving', role: 'status', text: c.saving }) : null))))))));
  }
  fill(section, 
   h('div', { class: 'buyer-enquiries-heading' }, h('div', {}, h('h2', { text: tx.title }), h('p', { text: tx.hint }), h('p', { class: 'admin-sync-note', text: tx.delay })),
    h('button', { type: 'button', class: 'admin-secondary buyer-enquiry-export', onclick: () => { listings = null; error = ''; draw(); load(); } }, icon('refresh', 15), c.refresh)),
   error ? h('p', { class: 'admin-message error', role: 'alert', text: error }) : null,
   body);
 }
 draw(); load();
}

// ---- Activity log ----
function auditTab(panel) {
 const c = COPY[lang];
 const section = h('section', { class: 'admin-panel' }, h('h2', { text: c.audit }), h('p', { role: 'status', text: c.loading }));
 fill(panel, section);
 api('audit').then(({ events }) => {
  fill(section, h('h2', { text: c.audit }), !events.length ? h('p', { class: 'admin-empty', text: c.emptyAudit }) : h('div', { class: 'admin-table-wrap' }, h('table', {},
   h('thead', {}, h('tr', {}, [c.date, c.action, c.actor, c.target].map(x => h('th', { text: x })))),
   h('tbody', {}, events.map(e => h('tr', {}, h('td', { text: shortDate(e.at * 1000) }), h('td', { text: c.actions[e.action] || e.action }), h('td', { text: e.actor }), h('td', {}, h('code', { text: e.target }))))))));
 }).catch(e => { if (!handle(e)) fill(section, h('h2', { text: c.audit }), h('p', { class: 'admin-message error', role: 'alert', text: c.error })); });
}

// ---- Invite a member (owner only; same appointment as the main admin) ----
function inviteTab(panel) {
 const c = COPY[lang], tx = INVITE[lang];
 let members = null, message = null, busy = false;
 const input = h('input', { type: 'email', required: true, maxlength: 254, autocomplete: 'off' });
 const section = h('section', { class: 'admin-panel admin-invite' });
 const list = h('div');
 fill(panel, section, h('section', { class: 'admin-panel' }, list));
 async function loadTeam() {
  try { members = (await api('team')).members; } catch (e) { if (handle(e)) return; members = []; }
  drawTeam();
 }
 function drawTeam() {
  if (!list.isConnected) return;
  fill(list, h('h2', {}, tx.team, ' ', members ? h('span', { class: 'admin-count', text: members.length }) : null),
   !members ? h('p', { role: 'status', text: c.loading }) : h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.email, c.status || '', tx.since].map(x => h('th', { text: x })))),
    h('tbody', {}, members.map(m => h('tr', {}, h('td', { text: m.email }), h('td', {}, h('span', { class: 'admin-badge' + (m.active ? ' is-ok' : ' is-muted'), text: m.active ? tx[m.role] || m.role : tx.inactive })), h('td', { text: m.created_at ? day(m.created_at) : '—' })))))));
 }
 const submit = h('button', { class: 'admin-primary', type: 'submit', text: tx.send });
 function draw() {
  submit.disabled = busy; input.disabled = busy; submit.textContent = busy ? c.loading : tx.send;
  fill(section, icon('userPlus', 28), h('h2', { text: tx.title }), h('p', { text: tx.text }),
   message ? h('p', { class: 'admin-message ' + (message.error ? 'error' : 'success'), role: message.error ? 'alert' : 'status', text: message.text }) : null,
   form);
 }
 const form = h('form', { onsubmit: async e => {
  e.preventDefault(); if (busy) return; busy = true; message = null; draw();
  const email = input.value.trim();
  try { const r = await api('invite', { email, language: lang }); message = { text: fmt(r.mailed ? tx.sent : tx.sentNoMail, { email }), error: false }; input.value = ''; loadTeam(); }
  catch (err) { if (handle(err)) return; message = { text: err.code === 'account_not_found' ? tx.notFound : err.code === 'already_staff' ? tx.already : err.code === 'invalid_input' ? tx.invalid : tx.error, error: true }; }
  busy = false; draw();
 } }, h('label', { class: 'admin-field' }, tx.email, input), h('p', { class: 'admin-help' }, tx.hint, ' ', h('a', { href: 'https://proprieteenvente.ca/', rel: 'noopener', target: '_blank', text: tx.signup })), submit);
 draw(); drawTeam(); loadTeam();
}

window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v !== tab && ['enquiries', 'accounts', 'listings', 'audit', 'invite'].includes(v)) { tab = v; render(); } });
render();
})();
