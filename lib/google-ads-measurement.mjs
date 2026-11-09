const preferenceKey = 'google-ads-measurement:v1';
const denied = {
  ad_storage: 'denied', ad_user_data: 'denied',
  ad_personalization: 'denied', analytics_storage: 'denied',
};
const copy = {
  en: ['Ad measurement', 'Allow Google Ads to measure whether ads lead to an enquiry? This uses advertising cookies. Your form answers are kept separate.', 'Allow', 'Decline', 'Close'],
  fr: ['Mesure publicitaire', 'Autoriser Google Ads à mesurer si une annonce mène à une demande? Cette mesure utilise des témoins publicitaires. Les réponses au formulaire restent séparées.', 'Autoriser', 'Refuser', 'Fermer'],
  zh: ['广告衡量', '是否允许 Google Ads 使用广告 Cookie 来衡量广告是否带来询盘？表单填写内容会单独处理。', '允许', '拒绝', '关闭'],
};
let config;
let preference;
let loaded = false;
let settingsButton;
const reported = new Set();

function privacySignal() {
  return navigator.globalPrivacyControl === true || ['1', 'yes'].includes(navigator.doNotTrack);
}

function readPreference() {
  try {
    const value = localStorage.getItem(preferenceKey);
    return ['granted', 'denied'].includes(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

function command() {
  (window.dataLayer ??= []).push(arguments);
}

const granted = { ...denied, ad_storage: 'granted', ad_user_data: 'granted' };

function loadTag() {
  if (loaded || preference !== 'granted' || privacySignal()) return;
  window.gtag ??= command;
  window.gtag('consent', 'default', denied);
  window.gtag('consent', 'update', granted);
  window.gtag('js', new Date());
  window.gtag('config', config.tagId, { allow_ad_personalization_signals: false, send_page_view: false });
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=' + config.tagId;
  document.head.append(script);
  loaded = true;
}

function button(text, action) {
  const el = document.createElement('button');
  el.type = 'button';
  el.textContent = text;
  el.addEventListener('click', action);
  return el;
}

export function installGoogleAdsMeasurement(options) {
  if (location.origin !== options.origin || privacySignal()) return;
  if (config) {
    document.querySelector(options.mount)?.append(settingsButton);
    return;
  }
  const query = new URLSearchParams(location.search);
  if (query.get('qa') === '1' || !/^AW-\d+$/.test(options.tagId) ||
      ![options.buyer, options.seller].every(label => /^[A-Za-z0-9_-]+$/.test(label || ''))) return;
  const mount = document.querySelector(options.mount);
  if (!mount) return;
  config = options;
  preference = readPreference();

  const dialog = document.createElement('dialog');
  dialog.className = 'ads-measurement-dialog';
  const heading = document.createElement('h2');
  heading.id = 'ads-measurement-heading';
  dialog.setAttribute('aria-labelledby', heading.id);
  const description = document.createElement('p');
  const choose = value => {
    preference = value;
    try { localStorage.setItem(preferenceKey, value); } catch { /* Session choice still applies. */ }
    if (loaded) window.gtag('consent', 'update', value === 'granted' ? granted : denied);
    else if (value === 'granted') loadTag();
    dialog.close();
  };
  const accept = button('', () => choose('granted'));
  const decline = button('', () => choose('denied'));
  const close = button('', () => dialog.close());
  const opener = button('', () => dialog.showModal());
  opener.className = 'ads-measurement-settings';
  const renderCopy = () => {
    const lang = document.documentElement.lang.split('-')[0];
    const [title, detail, yes, no, dismiss] = copy[lang] || copy.fr;
    heading.textContent = opener.textContent = title;
    description.textContent = detail;
    accept.textContent = yes;
    decline.textContent = no;
    close.textContent = dismiss;
  };
  const choices = document.createElement('div');
  choices.append(decline, accept, close);
  dialog.append(heading, description, choices);
  settingsButton = opener;
  mount.append(opener);
  document.body.append(dialog);
  renderCopy();
  new MutationObserver(renderCopy).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  window.addEventListener('storage', event => {
    if (event.key !== preferenceKey && event.key !== null) return;
    preference = readPreference();
    if (loaded) window.gtag('consent', 'update', preference === 'granted' ? granted : denied);
    else loadTag();
  });
  if (preference === 'granted') loadTag();
  else if (!preference && (['gclid', 'gbraid', 'wbraid'].some(key => query.has(key)) ||
    (query.get('utm_source') === 'google' && query.get('utm_medium') === 'cpc'))) dialog.showModal();
}

export function trackGoogleAdsLead(kind, requestId) {
  if (!loaded || preference !== 'granted' || privacySignal() ||
      (kind !== 'buyer' && kind !== 'seller') || !/^[a-f\d-]{36}$/i.test(requestId)) return;
  const key = kind + ':' + requestId;
  if (reported.has(key)) return;
  try {
    window.gtag('event', 'conversion', { send_to: config.tagId + '/' + config[kind], transaction_id: requestId });
    reported.add(key);
  } catch { /* Measurement should never interrupt a confirmed enquiry. */ }
}
