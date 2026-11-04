# 用户中心交接说明（给负责 UI 的开发者 / ChatGPT）

本地修复补充（尚未发布）：账户页新增确认邮件重发入口。过期、已使用或已被替换的确认链接会显示重发、登录和找回密码入口；同一标签页打开新的邮件链接也会处理。不要退回为仅在页面首次加载时读取链接。发送受原有验证码及每邮箱共享频率限制保护，429 响应带 `Retry-After`。本地预览会明确提示邮件只写入本机日志，账户及链接与正式站分离。

后端、数据库、发信和部署都已完成并上线（版本 1.9.0）。这份文档说明：现有用户中心的代码在哪、后端接口怎么调用、改 UI 时**必须遵守**的规则。新 UI 只需要替换"外观"，接口和安全机制不用重做。

仓库：`YuJieMichael/motel-a-vendre`。**推送到 `main` 会自动上线**（Cloudflare Workers Builds），所以请在新分支上改，测试通过后再合并到 `main`。

---

## 1. 架构一览

- 纯静态 + Cloudflare Worker，**没有框架、没有 npm 依赖、没有打包工具**。页面由 `templates/site.html` + `lib/page-renderer.cjs` 预渲染，Worker 在线上用同一套渲染器。
- 三种语言：法语（默认）、英语、中文。用户中心页面地址：`/fr/compte/`、`/en/account/`、`/zh/account/`。
- 账户数据：Cloudflare D1 数据库 `motel-a-vendre-accounts`，由本站 Worker 的 `/api/account/*` 提供接口（同域名，不跨域）。
- 发信：Resend，发件人 `Motel à vendre <compte@mail.motelavendre.ca>`。

## 2. 用户中心相关文件

| 文件 | 作用 | 改 UI 时 |
|---|---|---|
| `lib/account-view.js` | 用户中心页面的 HTML 结构（服务端渲染） | **主要改这里** |
| `account.js` | 页面交互：登录/注册/找回密码表单、资料保存、收藏/搜索/记录列表、导出、删除 | 如改了元素 ID 或结构，同步改这里 |
| `direction.css` 末尾 `/* Account centre */` 段 | 用户中心样式 | 可整段替换 |
| `i18n.js` 末尾三段 `Object.assign(...)` | 用户中心所有文案（`acct*` 开头，共 67 个键） | 新增/修改文案时三种语言都要加 |
| `lib/account-core.js` | 浏览器端接口客户端 `MAVAccount` | **不要改**，直接调用 |
| `deployment/account-api.mjs` | 后端接口（Worker） | 不要改 |
| `d1/migrations/` | 数据库结构 | 不要改 |
| `templates/site.html` | 顶部菜单和页脚里的"我的账户"链接 | 可调整样式/位置 |
| `app.js` | 收藏同步、首页"保存搜索"按钮、咨询表单预填 | 一般不用动 |

`account.js` 当前用到的元素 ID（改结构时要么保留，要么同步改 `account.js`）：

`account-page` `account-status` `account-unavailable` `account-guest` `tab-signin` `tab-signup` `tab-recover` `form-signin` `signin-email` `signin-password` `form-signup` `signup-email` `signup-password` `signup-consent` `form-recover` `recover-email` `form-new-password` `new-password` `account-member` `account-email` `account-signout` `form-profile` `profile-name` `profile-phone` `profile-language` `profile-budget` `profile-regions` `profile-timeline` `account-saved` `account-saved-empty` `account-searches` `account-searches-empty` `account-history` `account-history-empty` `account-export` `account-delete-open` `account-delete-dialog` `form-delete` `delete-password`

## 3. 必须遵守的规则（否则线上会直接失效）

1. **不能引用任何外部资源**：网站的安全策略（CSP）是 `script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data: blob:`。不能用 CDN 上的 React/Vue/Tailwind/Bootstrap/Google Fonts/图标库，所有代码、样式、图标必须放在仓库里。
2. **不能写内联脚本和内联样式**：不要 `<script>…</script>`、`onclick="…"`、`style="…"`、`<style>`。事件用 `addEventListener`，样式写进 CSS 文件。
3. **所有文案走 `i18n.js`**，并且法语/英语/中文**三种都要有**，否则 `npm run build` 会报错。在 `account-view.js` 里用 `c.键名`，在 `account.js` 里用 `t('键名')`。
4. **插入页面的数据一律转义**：用已有的 `e()`/`esc()` 函数，不要直接把用户输入拼进 `innerHTML`。
5. **不要自己用 `fetch` 调接口**，统一用 `window.MAVApp.account`（见第 4 节），它已经处理好请求头、登录状态和错误码。
6. **不要把登录令牌存进 localStorage**。登录状态在 HttpOnly Cookie 里，前端读不到也不需要读。`localStorage['mav-account']` 里只有 `{id, email}` 提示信息。
7. 改完必须运行 `npm run build && npm run prepare:release && npm test`，最后显示 `# fail 0` 才能合并。

## 4. 前端接口（`window.MAVApp.account`）

在用户中心页面上，`account.js` 通过 `window.MAVApp` 拿到所有工具：

```js
const App = window.MAVApp;
const account = App.account;   // 账户未开启时为 null
App.t('acctTitle')             // 当前语言的文案
App.language()                 // 'fr' | 'en' | 'zh'
App.accountMessage(error)      // 把错误转成当前语言的提示文字
App.byReference('100021')      // 根据编号取房源 → 名称用 App.nameOf(p)，价格用 App.money(p.price)
App.pageURL(lang, 'property', ref)  // 房源页链接
App.shareURL(criteria)         // 已保存搜索 → 首页筛选链接
App.setSavedReferences(refs)   // 收藏变动后同步到页面其他位置
App.clearPersonalData()        // 退出/删除账户后清掉本机收藏、草稿
```

`account` 的方法（全部返回 Promise，失败时抛出带 `code` 的错误）：

| 方法 | 说明 |
|---|---|
| `account.user` | 已登录时 `{id, email}`，否则 `null`（同步属性） |
| `account.refresh()` | 向服务器确认登录状态，返回 `{user, profile}` 或 `null` |
| `account.signUp(email, password, language, turnstile)` | 注册请求；根据邮件说明激活新账户或登录已有账户 |
| `account.resendConfirmation(email, language, turnstile)` | 获取新确认邮件；不创建重复账户或更改密码。公开响应不透露邮箱是否已注册 |
| `account.verify(token)` | 用邮件链接里的令牌确认邮箱并登录 |
| `account.signIn(email, password)` | 登录 |
| `account.recover(email, language, turnstile)` | 发送重置密码邮件（无论邮箱是否存在都返回成功） |
| `account.resetPassword(token, password)` | 用邮件令牌设新密码并登录，其他设备会被登出 |
| `account.signOut()` | 退出 |
| `account.profile()` / `account.updateProfile(p)` | 读取 / 保存资料 |
| `account.savedReferences()` / `addSaved(ref)` / `removeSaved(ref)` / `syncSaved(localRefs)` | 收藏的房源编号 |
| `account.searches()` / `addSearch(name, criteria)` / `removeSearch(id)` | 已保存的搜索 |
| `account.history()` / `addHistory(entry)` | 咨询记录 |
| `account.exportData()` | 导出全部数据（JSON） |
| `account.deleteAccount(password)` | 永久删除账户（需要密码） |
| `account.events` | `addEventListener('change', …)`：登录状态变化时触发 |

资料字段：`full_name`（≤80）、`phone`（≤40）、`preferred_language`（fr/en/zh）、`buyer_budget`（整数或 null）、`buyer_regions`（≤120）、`buyer_timeline`（`''`/`exploring`/`0-3`/`3-6`/`6+`）。

错误码 → 文案键（`App.accountMessage` 已处理）：`invalid_credentials`→`acctErrInvalid`，`email_not_confirmed`→`acctErrNotConfirmed`，`weak_password`→`acctErrWeak`，`rate`→`acctErrRate`，`network`→`acctErrNetwork`，`session`→`acctErrSession`（需重新登录），`quota`→`acctErrQuota`，`link_invalid`→`acctErrLink`，其他→`acctErrGeneric`。

## 5. 邮件链接流程（UI 需要支持的状态）

- 注册后邮件链接：`/{lang}/compte|account/#verify=令牌` → 页面加载时调用 `account.verify()`，显示"邮箱已确认，已登录"。
- 重置密码链接：`/{lang}/compte|account/#reset=令牌` → 显示"设置新密码"表单，提交时调用 `account.resetPassword(token, 新密码)`。
- `account.js` 底部已有处理逻辑（读取后立刻从地址栏清除令牌），新 UI 保留这段逻辑即可。

页面需要的状态：**未开启**（`#account-unavailable`）→ **未登录**（登录/注册/找回密码三个标签）→ **设置新密码** → **已登录**（资料、收藏、搜索、记录、隐私与数据）。

## 6. 后端接口（仅供参考，前端请用第 4 节的方法）

同域名 `/api/account/*`，JSON 格式；每个请求必须带 `X-MAV-Account: 1` 请求头和同源 `Origin`，否则返回 403。

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `signup` | `{email, password, language, consent:true, turnstile?}` |
| POST | `resend` | `{email, language, turnstile?}`；沿用共享发信限制及验证码校验，已激活账户收到登录说明 |
| POST | `verify` | `{token}` → 设置登录 Cookie |
| POST | `login` | `{email, password}` |
| POST | `recover` | `{email, language, turnstile?}` |
| POST | `reset` | `{token, password}` |
| POST | `logout` | — |
| GET | `me` | `{user, profile}` |
| PUT | `profile` | 资料字段 |
| GET / POST | `saved` | `{references:[...]}`（最多 200 个） |
| DELETE | `saved/{编号}` | — |
| GET / POST | `searches` | `{name, criteria}`（最多 20 个） |
| DELETE | `searches/{id}` | — |
| GET / POST | `history` | `{id, kind, purpose, listing_reference, language}`（不含留言和联系方式） |
| GET | `export` | 全部数据 |
| POST | `delete` | `{password}` |

密码规则：8–128 个字符，拒绝常见弱密码。登录、注册、找回密码都有频率限制。

## 7. 本地预览

```sh
npm run build
npm start            # http://127.0.0.1:5173/fr/compte/
```

本地会用 `.local/accounts.sqlite` 代替 D1，确认邮件和重置邮件直接打印在终端里（复制链接打开即可），不会真的发信。需要 Node.js 24+。

## 8. 法规要求（不要删）

隐私与数据区块必须保留：保存了哪些数据、下载我的数据、删除账户，以及个人信息保护负责人（魁北克 Loi 25）："Propriétaire — achat.vente.garderie@gmail.com"（来自 `data/site-config.js` 的 `account.privacyContact`）。注册时的同意勾选框也必须保留。
