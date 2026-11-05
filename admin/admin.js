// Motel à vendre staff workspace. Same structure, wording and styles as the
// Propriété En Vente admin (frontend/src/admin.tsx, buyer-enquiries.tsx), without a framework.
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
  loading: 'Chargement…', work: 'Travail', management: 'Gestion', signOut: 'Déconnexion', administration: 'Administration', viewSite: 'Voir le site', refresh: 'Actualiser', original: 'Administration Propriété En Vente',
  error: 'Impossible de charger les données. Réessayez après avoir vérifié votre connexion et vos droits d’accès.', unavailable: 'Service momentanément indisponible. Réessayez dans un instant.',
  previous: 'Précédent', next: 'Suivant', cancel: 'Annuler', saving: 'Enregistrement…', saveError: 'Enregistrement impossible. Les données ont été actualisées.',
  status: 'Rôle', audit: 'Journal des opérations', emptyAudit: 'Aucune opération à afficher.', date: 'Date', action: 'Opération', actor: 'Compte responsable', target: 'Élément',
  actions: { staff_invite: 'Membre invité', staff_deactivate: 'Membre désactivé', staff_activate: 'Membre réactivé', staff_resend: 'Courriel renvoyé', staff_password: 'Mot de passe défini', enquiry_accept: 'Demande acceptée', enquiry_reopen: 'Demande remise à traiter', enquiry_delete: 'Demande supprimée', enquiry_restore: 'Demande restaurée', account_confirm: 'Compte confirmé manuellement', account_delete: 'Compte supprimé', listing_hide: 'Annonce masquée', listing_show: 'Annonce affichée', listing_pin: 'Annonce épinglée', listing_unpin: 'Annonce désépinglée' },
  local: 'Aperçu local : toutes les données viennent de la base locale de ce poste. Les courriels restent dans le journal local.'
 },
 en: {
  title: 'Admin workspace', eyebrow: 'MOTELAVENDRE · TEAM', intro: 'Handle Motel à vendre enquiries, buyer accounts and listing display from one place.',
  back: 'Back to website', login: 'Sign in', loginTitle: 'Sign in with your team account', loginText: 'This area is reserved for authorized members of the Motel à vendre team.',
  email: 'Email', password: 'Password', forgot: 'First sign-in or forgot your password?', linkTitle: 'Get a link by email', linkText: 'Enter your team email. You will receive a link to choose your password (valid for one hour).', sendLink: 'Send link', linkSent: 'If this address is on the team, an email has just been sent. Use the most recent link.', setTitle: 'Choose your password', setText: 'At least 10 characters. It is used only for the Motel à vendre admin.', newPassword: 'New password', confirmPassword: 'Confirm password', save: 'Save and sign in', mismatch: 'The two passwords do not match.', weak: 'Use at least 10 characters, different from your email.', badLink: 'This link has expired, was already used or was replaced. Ask for a new link.', rate: 'Too many attempts. Try again in a few minutes.', backToLogin: 'Back to sign-in', badLogin: 'Incorrect email or password.',
  noAccess: 'Team access only', noAccessText: 'This account is not an active admin account. Ask the platform owner for an invitation.',
  setup: 'Server connection required', setupText: 'The site configuration has no service address.', expired: 'Your session expired. Please sign in again.',
  loading: 'Loading…', work: 'Work', management: 'Management', signOut: 'Sign out', administration: 'Administration', viewSite: 'View the website', refresh: 'Refresh', original: 'Propriété En Vente admin',
  error: 'Could not load data. Check your connection and access rights, then try again.', unavailable: 'Service temporarily unavailable. Try again shortly.',
  previous: 'Previous', next: 'Next', cancel: 'Cancel', saving: 'Saving…', saveError: 'Could not save. The data has been refreshed.',
  status: 'Role', audit: 'Activity log', emptyAudit: 'No activity to show.', date: 'Date', action: 'Action', actor: 'Account', target: 'Item',
  actions: { staff_invite: 'Staff invited', staff_deactivate: 'Member deactivated', staff_activate: 'Member reactivated', staff_resend: 'Email resent', staff_password: 'Password set', enquiry_accept: 'Enquiry accepted', enquiry_reopen: 'Enquiry marked pending', enquiry_delete: 'Enquiry deleted', enquiry_restore: 'Enquiry restored', account_confirm: 'Account confirmed manually', account_delete: 'Account deleted', listing_hide: 'Listing hidden', listing_show: 'Listing shown', listing_pin: 'Listing pinned', listing_unpin: 'Listing unpinned' },
  local: 'Local preview: all data comes from this computer’s local database. Emails stay in the local log.'
 },
 zh: {
  title: '管理工作台', eyebrow: 'MOTELAVENDRE · 团队', intro: '在同一个入口处理 Motel à vendre 的买家咨询、买家账户和房源展示。',
  back: '返回网站', login: '登录', loginTitle: '使用团队账号登录', loginText: '此区域仅向 Motel à vendre 授权团队成员开放。',
  email: '邮箱', password: '密码', forgot: '首次登录或忘记密码？', linkTitle: '通过邮件获取链接', linkText: '输入您的团队邮箱，我们会发送一个设置密码的链接（1 小时内有效）。', sendLink: '发送链接', linkSent: '如果这是团队成员的邮箱，邮件已经发出。请使用最新的一封。', setTitle: '设置您的密码', setText: '至少 10 个字符，只用于 Motel à vendre 管理后台。', newPassword: '新密码', confirmPassword: '确认密码', save: '保存并登录', mismatch: '两次输入的密码不一致。', weak: '请至少使用 10 个字符，并且不要和邮箱相同。', badLink: '链接已过期、已使用或已被新链接取代。请重新获取链接。', rate: '尝试次数过多，请几分钟后再试。', backToLogin: '返回登录', badLogin: '邮箱或密码不正确。',
  noAccess: '仅限授权团队成员', noAccessText: '此账号不是有效的管理员账号。请向平台所有者申请邀请。',
  setup: '需要配置后端连接', setupText: '网站配置中缺少服务地址。', expired: '登录已过期，请重新登录。',
  loading: '加载中…', work: '工作', management: '管理', signOut: '退出登录', administration: '管理后台', viewSite: '查看网站', refresh: '刷新', original: 'Propriété En Vente 主站后台',
  error: '无法加载资料。请检查网络和账号权限后重试。', unavailable: '服务暂时不可用，请稍后再试。',
  previous: '上一页', next: '下一页', cancel: '取消', saving: '正在保存…', saveError: '保存失败，已重新获取最新数据。',
  status: '角色', audit: '操作记录', emptyAudit: '暂无操作记录。', date: '时间', action: '操作', actor: '操作账号', target: '对象',
  actions: { staff_invite: '邀请团队成员', staff_deactivate: '停用成员', staff_activate: '重新启用成员', staff_resend: '重新发送邮件', staff_password: '设置密码', enquiry_accept: '通过咨询', enquiry_reopen: '咨询改为待处理', enquiry_delete: '删除咨询', enquiry_restore: '恢复咨询', account_confirm: '手动确认账户', account_delete: '删除账户', listing_hide: '隐藏房源', listing_show: '显示房源', listing_pin: '置顶房源', listing_unpin: '取消置顶' },
  local: '本地预览：所有数据来自本机的本地数据库，邮件只写入本地日志。'
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
 fr: { tab: 'Inviter un membre', title: 'Inviter un administrateur des opérations', text: 'L’invitation donne accès aux demandes, aux comptes acheteurs et aux annonces de Motel à vendre. Elle ne permet pas d’inviter d’autres administrateurs.', email: 'Adresse courriel professionnelle', send: 'Envoyer l’invitation', hint: 'La personne reçoit un courriel pour choisir son mot de passe (lien valide 7 jours). Aucun compte préalable n’est nécessaire.', sent: 'Invitation envoyée à {email}.', sentNoMail: 'Membre ajouté ({email}), mais le courriel n’a pas pu être envoyé. Utilisez « Renvoyer » plus tard.', already: 'Ce compte fait déjà partie de l’équipe.', invalid: 'Adresse invalide, ou c’est votre propre compte.', error: 'L’opération n’a pas pu être finalisée. Réessayez dans un instant.', team: 'Membres de l’équipe', role: 'Rôle', state: 'État', since: 'Depuis', owner: 'Propriétaire', operator: 'Administrateur', activeLabel: 'Actif', pending: 'Invitation en attente', inactive: 'Désactivé', resend: 'Renvoyer', deactivate: 'Désactiver', activate: 'Réactiver', resent: 'Courriel renvoyé à {email}.', confirmDeactivate: 'Désactiver {email} ? Ses sessions sont fermées immédiatement. Vous pourrez le réactiver.', yes: 'Désactiver' },
 en: { tab: 'Invite a member', title: 'Invite an operations administrator', text: 'The invitation gives access to Motel à vendre enquiries, buyer accounts and listings. It does not allow inviting other administrators.', email: 'Work email address', send: 'Send invitation', hint: 'They receive an email to choose their password (link valid for 7 days). No existing account is needed.', sent: 'Invitation sent to {email}.', sentNoMail: 'Member added ({email}), but the email could not be sent. Use “Resend” later.', already: 'This account is already on the team.', invalid: 'Invalid address, or this is your own account.', error: 'The action could not be completed. Try again shortly.', team: 'Team members', role: 'Role', state: 'Status', since: 'Since', owner: 'Owner', operator: 'Administrator', activeLabel: 'Active', pending: 'Invitation pending', inactive: 'Deactivated', resend: 'Resend', deactivate: 'Deactivate', activate: 'Reactivate', resent: 'Email resent to {email}.', confirmDeactivate: 'Deactivate {email}? Their sessions end immediately. You can reactivate them later.', yes: 'Deactivate' },
 zh: { tab: '邀请成员', title: '邀请运营管理员', text: '受邀成员可以处理 Motel à vendre 的咨询、买家账户和房源，但不能再邀请其他管理员。', email: '工作邮箱', send: '发送邀请', hint: '对方会收到一封邮件，点链接设置密码即可开通（链接 7 天内有效），不需要事先注册任何账号。', sent: '邀请已发送至 {email}。', sentNoMail: '已添加成员（{email}），但邀请邮件没有发出，请稍后点“重新发送”。', already: '这个账号已经是团队成员。', invalid: '邮箱无效，或者这是您自己的账号。', error: '操作未能完成，请稍后再试。', team: '团队成员', role: '角色', state: '状态', since: '加入时间', owner: '所有者', operator: '管理员', activeLabel: '已开通', pending: '等待接受邀请', inactive: '已停用', resend: '重新发送', deactivate: '停用', activate: '重新启用', resent: '已重新发送邮件给 {email}。', confirmDeactivate: '停用 {email}？对方会立即被退出登录，之后可以重新启用。', yes: '确认停用' }
};
const STORY = {
 fr: { eyebrow: 'MOTEL À VENDRE · ESPACE ÉQUIPE', title: 'Votre équipe,\nà chaque demande.', intro: 'Traitez les demandes, les comptes acheteurs et l’affichage des annonces. Chaque membre de l’équipe a son propre accès.', benefits: ['Un courriel à chaque nouvelle demande', 'L’affichage des annonces à votre main', 'Des accès d’équipe contrôlés'], privacy: 'Les comptes d’administration sont personnels et réservés à l’équipe.', home: 'Retour à l’accueil' },
 en: { eyebrow: 'MOTEL À VENDRE · TEAM SPACE', title: 'Your team,\non every enquiry.', intro: 'Handle enquiries, buyer accounts and how listings appear. Each team member has their own access.', benefits: ['An email for every new enquiry', 'Listing display under your control', 'Controlled team access'], privacy: 'Admin accounts are personal and reserved for the team.', home: 'Back to home' },
 zh: { eyebrow: 'MOTEL À VENDRE · 团队空间', title: '您的团队，\n不错过每条咨询。', intro: '集中处理买家咨询、买家账户和本站房源展示，团队成员各自使用独立账号。', benefits: ['每条新咨询都有邮件提醒', '房源展示随时调整', '团队成员与权限可控'], privacy: '后台账号仅供团队成员本人使用。', home: '返回首页' }
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
 checkCircle: ['M22 11.08V12a10 10 0 1 1-5.93-9.14', 'm9 11 3 3L22 4'],
 arrowRight: ['M5 12h14', 'm12 5 7 7-7 7'],
 key: ['M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z', 'M16.5 7.5a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z'],
 globe: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', 'M2 12h20'],
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
let lang = (() => { try { const v = localStorage.getItem('mav_admin_lang'); if (COPY[v]) return v; } catch {} const n = (navigator.language || '').toLowerCase(); return n.startsWith('zh') ? 'zh' : n.startsWith('en') ? 'en' : 'fr'; })();
let tab = ['enquiries', 'accounts', 'listings', 'audit', 'invite'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'enquiries';
let staffEmail = '', staffRole = '', gateNotice = '', timers = [], signedIn = null, screen = 'login';
// Email links land here as #set=TOKEN (password link) or #invite=TOKEN. Capture and clear at once.
let linkToken = '';
{ const m = /^#(set|invite)=([A-Za-z0-9_-]{43})$/.exec(location.hash); if (m) { linkToken = m[2]; tab = 'enquiries'; try { history.replaceState(null, '', location.pathname); } catch { location.hash = ''; } } }
const t = () => COPY[lang];

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
 if (error && error.status === 401 && error.code === 'signin_required') { signedIn = false; staffEmail = ''; gateNotice = t().expired; render(); return true; }
 return false;
}

// ---- Layout ----
function langSwitch() {
 return h('div', { class: 'admin-lang', role: 'group', 'aria-label': 'Langue / Language / 语言' }, Object.keys(COPY).map(l => h('button', { type: 'button', 'aria-pressed': String(l === lang), onclick: () => { lang = l; try { localStorage.setItem('mav_admin_lang', l); } catch {} render(); } }, LANG_NAMES[l])));
}
function setDocLang() { document.documentElement.lang = { fr: 'fr-CA', en: 'en-CA', zh: 'zh-Hans' }[lang]; document.title = t().title + ' | Motel à vendre'; }
function clearTimers() { for (const id of timers) clearInterval(id); timers = []; }
const errorText = error => { const c = t(); return error.code === 'rate' ? c.rate : error.code === 'link_invalid' ? c.badLink : error.code === 'weak_password' ? c.weak : error.code === 'invalid_credentials' ? c.badLogin : c.unavailable; };

// ---- Site header (Propriété En Vente: site-header workspace-header admin-site-header) ----
function siteHeader(signed) {
 const c = t();
 return h('header', { class: 'site-header workspace-header admin-site-header' },
  h('a', { href: '/' + lang + '/', class: 'brand', 'aria-label': 'Motel à vendre' }, h('span', { class: 'brand-mark' }, icon('home', 20)), h('span', { text: 'Motel à vendre' })),
  h('div', { class: 'header-actions' },
   h('div', { class: 'language-switch', 'aria-label': 'Language' }, icon('globe', 16), Object.keys(COPY).map(l => h('button', { type: 'button', lang: l, class: l === lang ? 'active' : '', 'aria-current': l === lang ? 'page' : null, onclick: () => { lang = l; try { localStorage.setItem('mav_admin_lang', l); } catch {} render(); } }, LANG_NAMES[l]))),
   signed ? h('div', { class: 'header-account' },
    h('a', { class: 'header-account-info', href: '#enquiries', title: staffEmail }, icon('key', 16), h('span', { text: c.administration })),
    h('button', { class: 'header-logout', type: 'button', onclick: signOut, text: c.signOut })) : null));
}

// ---- Sign-in pages (Propriété En Vente auth.tsx: auth-page, auth-story, auth-card) ----
// kind: 'login' | 'link' | 'set' | 'retry' | 'noaccess'
function gate(title, text, kind) {
 const c = t(), s = STORY[lang];
 if (kind === 'retry') {
  return h('div', {}, siteHeader(false), h('main', { class: 'admin-gate' }, icon('lock', 32), h('h1', { text: title }), h('p', { text: text }),
   h('button', { class: 'admin-primary', type: 'button', onclick: start }, icon('refresh', 16), c.refresh), h('a', { href: '/' + lang + '/', text: c.back })));
 }
 const err = h('div', { class: 'auth-error', role: 'alert', hidden: !gateNotice, text: gateNotice });
 const field = (label, attrs, withIcon) => { const input = h('input', attrs); return [h('label', {}, label, withIcon ? h('span', { class: 'auth-input-wrap' }, icon('mail', 18), input) : input), input]; };
 const primary = label => h('button', { class: 'auth-primary', type: 'submit' }, label, icon('arrowRight', 18));
 const card = [h('div', { class: 'auth-symbol' }, icon('lock', 25)), h('h2', { id: 'auth-title', text: title }), h('p', { class: 'auth-subtitle', text: text })];
 if (kind === 'login') {
  const [emailLabel, email] = field(c.email, { type: 'email', name: 'email', autocomplete: 'username', required: true, maxlength: 150 }, true);
  const [passLabel, password] = field(c.password, { type: 'password', name: 'password', autocomplete: 'current-password', required: true, maxlength: 128 });
  const submit = primary(c.login);
  card.push(h('form', { class: 'auth-form', onsubmit: async e => {
   e.preventDefault(); submit.disabled = true; err.hidden = true;
   try { await api('login', { email: email.value.trim(), password: password.value }); gateNotice = ''; await start(); }
   catch (error) { err.textContent = errorText(error); err.hidden = false; submit.disabled = false; password.value = ''; password.focus(); }
  } }, emailLabel, passLabel, h('a', { class: 'auth-forgot', href: '#', onclick: e => { e.preventDefault(); screen = 'link'; gateNotice = ''; render(); }, text: c.forgot }), err, submit));
 } else if (kind === 'link') {
  const [emailLabel, email] = field(c.email, { type: 'email', name: 'email', autocomplete: 'username', required: true, maxlength: 150 }, true);
  const submit = primary(c.sendLink);
  const done = h('div', { class: 'auth-notice', role: 'status', hidden: true, text: c.linkSent });
  card.push(h('form', { class: 'auth-form', onsubmit: async e => {
   e.preventDefault(); submit.disabled = true; err.hidden = true; done.hidden = true;
   try { await api('password-link', { email: email.value.trim(), language: lang }); done.hidden = false; }
   catch (error) { err.textContent = errorText(error); err.hidden = false; }
   submit.disabled = false;
  } }, emailLabel, err, done, submit), h('a', { class: 'auth-back', href: '#', onclick: e => { e.preventDefault(); screen = 'login'; gateNotice = ''; render(); }, text: c.backToLogin }));
 } else if (kind === 'set') {
  const [p1Label, p1] = field(c.newPassword, { type: 'password', autocomplete: 'new-password', required: true, minlength: 10, maxlength: 128 });
  const [p2Label, p2] = field(c.confirmPassword, { type: 'password', autocomplete: 'new-password', required: true, minlength: 10, maxlength: 128 });
  const submit = primary(c.save);
  card.push(h('form', { class: 'auth-form', onsubmit: async e => {
   e.preventDefault(); err.hidden = true;
   if (p1.value !== p2.value) { err.textContent = c.mismatch; err.hidden = false; return; }
   submit.disabled = true;
   try { await api('set-password', { token: linkToken, password: p1.value }); linkToken = ''; screen = 'login'; gateNotice = ''; await start(); }
   catch (error) { err.textContent = errorText(error); err.hidden = false; submit.disabled = false; }
  } }, p1Label, p2Label, err, submit), h('a', { class: 'auth-back', href: '#', onclick: e => { e.preventDefault(); linkToken = ''; screen = 'link'; gateNotice = ''; render(); }, text: c.linkTitle }));
 }
 card.push(h('p', { class: 'auth-privacy' }, icon('shield', 16), s.privacy), h('a', { class: 'auth-home', href: '/' + lang + '/', text: s.home }));
 return h('div', {}, siteHeader(false), h('main', { class: 'auth-page' },
  h('section', { class: 'auth-story' },
   h('span', { class: 'auth-eyebrow', text: s.eyebrow }),
   h('h1', {}, s.title.split('\n').map(line => h('span', { text: line }))),
   h('p', { text: s.intro }),
   h('ul', {}, s.benefits.map(b => h('li', {}, icon('checkCircle', 19), b))),
   h('div', { class: 'auth-story-mark' }, icon('home', 35), h('span', {}, 'La technologie pour avancer.', h('br'), 'Un humain pour décider.'))),
  h('section', { class: 'auth-card', 'aria-labelledby': 'auth-title' }, card)));
}

async function signOut() {
 clearTimers(); staffEmail = ''; staffRole = ''; signedIn = false; screen = 'login';
 try { await api('logout', {}); } catch {}
 render();
}

async function start() {
 fill(root, h('main', { class: 'admin-gate', 'aria-busy': 'true', text: t().loading }));
 try { const me = await api('me'); staffEmail = me.email; staffRole = me.role; signedIn = true; }
 catch (error) {
  if (error.status === 401) { signedIn = false; render(); return; }
  setDocLang(); fill(root, gate(t().title, t().unavailable, 'retry')); return;
 }
 render();
}

function render() {
 setDocLang(); clearTimers();
 const c = t();
 if (linkToken) { fill(root, gate(c.setTitle, c.setText, 'set')); return; }
 if (signedIn === null) { start(); return; }
 if (!signedIn) { fill(root, screen === 'link' ? gate(c.linkTitle, c.linkText, 'link') : gate(c.loginTitle, c.loginText, 'login')); return; }
 const nav = (id, name, label) => h('button', { type: 'button', class: tab === id ? 'active' : '', 'aria-current': tab === id ? 'page' : null, onclick: () => { tab = id; history.replaceState(null, '', '#' + id); render(); } }, icon(name, 18), label);
 const panel = h('div', { 'aria-live': 'polite' });
 fill(root, siteHeader(true), h('main', { class: 'admin-app admin-horizontal' },
  h('header', { class: 'admin-sidebar admin-toolbar' },
   h('a', { href: '/' + lang + '/', class: 'admin-back' }, icon('back'), c.back),
   h('div', { class: 'admin-brand' }, icon('shield', 30), h('strong', {}, 'Motel à vendre', h('small', { text: c.title }))),
   h('nav', { 'aria-label': c.title },
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.work }), nav('enquiries', 'message', INBOX[lang].title)),
    h('div', { class: 'admin-nav-section' }, h('span', { class: 'admin-nav-heading', text: c.management }), nav('accounts', 'users', ACCOUNTS[lang].title), nav('listings', 'home', LISTINGS[lang].title), nav('audit', 'history', c.audit), staffRole === 'owner' ? nav('invite', 'userPlus', INVITE[lang].tab) : null)),
   h('a', { class: 'admin-seller-link', href: '/' + lang + '/', target: '_blank', rel: 'noopener' }, c.viewSite, icon('external', 14))),
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
  try { 
  const data = await api('enquiries?' + new URLSearchParams({ filter, offset: String(offset) })); if (version !== generation) return; rows = data.enquiries; more = data.more; }
  catch (e) { if (handle(e)) return; if (version === generation) error = true; }
  finally { inFlight = false; if (version === generation) { loading = false; draw(); } }
 }
 async function review(row, action) {
  if (busy) return; busy = row.id; actionError = false; generation++; draw();
  try { await api('enquiries/review', { id: row.id, revision: row.revision ?? 0, action }); confirmDelete = null; rows = rows.filter(r => r.id !== row.id); }
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

// ---- Invite a member (owner only) ----
function inviteTab(panel) {
 const c = COPY[lang], tx = INVITE[lang];
 let members = null, message = null, busy = false, confirm = null;
 const input = h('input', { type: 'email', required: true, maxlength: 150, autocomplete: 'off' });
 const section = h('section', { class: 'admin-panel admin-invite' }), list = h('section', { class: 'admin-panel buyer-enquiries' });
 fill(panel, section, list);
 async function loadTeam() { try { members = (await api('team')).members; } catch (e) { if (handle(e)) return; members = []; } drawTeam(); }
 async function act(m, action) {
  busy = true; message = null; drawTeam();
  try { const r = await api('team/' + action, { id: m.id }); confirm = null; if (action === 'resend') message = { text: fmt(r.mailed ? tx.resent : tx.sentNoMail, { email: m.email }), error: !r.mailed }; }
  catch (e) { if (handle(e)) return; message = { text: e.code === 'rate' ? c.rate : tx.error, error: true }; }
  busy = false; draw(); loadTeam();
 }
 function drawTeam() {
  if (!list.isConnected) return;
  fill(list, h('h2', {}, tx.team, ' ', members ? h('span', { class: 'admin-count', text: members.length }) : null),
   !members ? h('p', { role: 'status', text: c.loading }) : h('div', { class: 'admin-table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, [tx.email, tx.role, tx.state, tx.since, ''].map(x => h('th', { text: x })))),
    h('tbody', {}, members.map(m => h('tr', { class: m.active ? null : 'is-hidden' },
     h('td', { text: m.email }),
     h('td', { text: tx[m.role] || m.role }),
     h('td', {}, h('span', { class: 'admin-badge' + (!m.active ? ' is-muted' : m.pending ? '' : ' is-ok'), text: !m.active ? tx.inactive : m.pending ? tx.pending : tx.activeLabel })),
     h('td', { text: day(m.created_at * 1000) }),
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
  submit.disabled = busy; input.disabled = busy; submit.textContent = busy ? c.loading : tx.send;
  fill(section, icon('userPlus', 28), h('h2', { text: tx.title }), h('p', { text: tx.text }),
   message ? h('p', { class: 'admin-message ' + (message.error ? 'error' : 'success'), role: message.error ? 'alert' : 'status', text: message.text }) : null,
   form);
 }
 draw(); drawTeam(); loadTeam();
}

window.addEventListener('hashchange', () => { const link = /^#(set|invite)=([A-Za-z0-9_-]{43})$/.exec(location.hash); if (link) { linkToken = link[2]; try { history.replaceState(null, '', location.pathname); } catch {} render(); return; } const v = location.hash.slice(1); if (v !== tab && ['enquiries', 'accounts', 'listings', 'audit', 'invite'].includes(v)) { tab = v; render(); } });
render();
})();
