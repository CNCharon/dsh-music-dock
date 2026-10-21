# 音乐播放器 · DSH Music Player

一个嵌在 **左侧菜单栏底部** 的音乐播放器：接入 **网易云音乐 / QQ 音乐**，登录后同步你**收藏与创建的全部歌单**，支持上一首、暂停、下一首、播放模式（顺序 / 随机 / 单曲循环），并显示歌手、歌名与滚动歌词。

## 功能

- **嵌在侧栏里**：播放器嵌在左侧栏底部、其他插件按钮的上方，宽度与侧栏内容对齐——侧栏变窄成 56px 导轨时，播放器退化为底栏里的一个按钮。
- **缩小化**：平时显示**封面、歌名和当前歌词**（底部一条播放进度）；鼠标移入后歌词淡出、换成 **上一首、播放暂停、下一首、播放模式** 与展开按钮，移出又淡回歌词。点封面/歌词或展开按钮可展开完整面板（封面、歌名、歌手、进度、歌词、歌单），再点向下箭头或点击面板外任意处即可收起。
- **歌词优先**：完整面板里，鼠标移出显示歌词行，移入切换为控制按钮（进度条、音量、播放模式）。
- **两个平台**
  - 网易云音乐：扫码登录或粘贴 Cookie，同步「创建的歌单」「收藏的歌单」，逐首播放与歌词。
  - QQ 音乐：粘贴 Cookie 登录，同步创建歌单、收藏歌单与「我喜欢的音乐」；播放地址走 `vkey` 接口。
- **登录即同步**：登录成功立即拉取歌单；账号保存在本机，重启后自动恢复并后台刷新。
- **歌词偏移**：`−0.5s / +0.5s` 按曲目记忆，解决歌词整体超前或滞后。
- **设置页**：`设置 → 音乐播放器`，集中管理两个平台的登录与歌单浏览。

## 登录方式

插件通过 Host 侧的同源反向代理访问各平台接口（浏览器直连会被 CORS 拦截，Cookie 也不应暴露给页面脚本）。

### 网易云音乐

1. 在浏览器打开 `music.163.com` 并登录；
2. 开发者工具 → Network → 任意请求 → 复制请求头里的 `Cookie`（必须含 `MUSIC_U`）；
3. 粘贴到插件「Cookie 登录」。

也可以点「扫码登录」，用网易云 App 扫描弹窗里的二维码。

### QQ 音乐

点「扫码登录」，用 QQ 或微信扫描弹窗里的二维码，手机上确认即可——插件走 QQ 官方的 `ptlogin2` 票据流程，扫码成功后自动换回 `uin` / `p_skey` 等登录凭据，不需要复制 Cookie。

若扫码后 QQ 音乐没有下发凭据（极少数账号会遇到），弹窗会提示改用 Cookie 登录：

1. 在 `y.qq.com` 登录；
2. 复制完整 `Cookie`（必须含 `uin`，以及 `p_skey` / `qm_keyst` 之一）；
3. 粘贴到「Cookie 登录」。

## 播放能力说明

能否播放取决于平台返回的地址，插件不会伪造：

- 免费曲目通常可直接播放；
- 会员 / 版权受限曲目会显示「需要会员」等具体原因，顺序播放时自动跳过；
- 网易云对未授权曲目返回 `-110`，QQ 返回 `result 104003`——都会在播放器里给出可读提示。

## 技术结构

```
dsh-music-player/
├─ index.js              Host 半：注册 /music/player 前缀路由
├─ lib/
│  ├─ routes.js          同源 HTTP 接口 + 音频流转发（支持 Range）
│  ├─ service.js         平台适配器注册、账号态、同步
│  ├─ http.js            带超时的 fetch 封装
│  ├─ store.js           账号持久化（仅 Cookie 与账号名）
│  ├─ qr.js              网易云扫码；二维码用随包 MIT 编码器绘制
│  ├─ vendor/            qrcode-generator（MIT，见文件头）
│  └─ providers/         netease.js / qq.js
├─ client.js             Client 半：侧栏底部播放器 + 设置页（单文件模块）
├─ locale/zh.json        插件显示名与描述
├─ icon.svg              插件图标
└─ test/                 路由 / 适配器 / 静态检查
```

### Host 接口（同源）

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/music/player/state` | 两个平台的登录态与歌单 |
| GET | `/music/player/hydrate` | 恢复账号后重建歌单 |
| GET | `/music/player/adapters` | 平台清单 |
| GET | `/music/player/login/qr/create?provider=` | 生成二维码 |
| GET | `/music/player/login/qr/check?provider=&key=` | 轮询扫码状态 |
| POST | `/music/player/sign-in` | Cookie 登录 |
| POST | `/music/player/sign-out` | 退出 |
| POST | `/music/player/sync` | 重新拉取歌单 |
| POST | `/music/player/tracks` | 歌单曲目 |
| POST | `/music/player/lyric` | 歌词 |
| POST | `/music/player/audio` | 解析播放地址 |
| GET | `/music/player/stream` | 同源转发音频（含 `Range`） |

## 自检

```powershell
node test/routes-smoke.mjs   # HTTP 契约、错误信封、音频字节
node test/host-smoke.mjs     # 适配器直连各平台
node test/client-lint.mjs    # Client 静态检查（槽位、i18n、组件解析）
```

## 数据与隐私

- 账号 Cookie 只保存在 Host 进程与 `<profile>/.dsh-music-player/accounts.json`（仅 Cookie + 账号名，权限 0600）；
- 页面脚本无法读取 Cookie，所有平台请求都由 Host 转发；
- 路由只接受同源请求。

## 已知限制

- 会员曲目需要对应平台的有效会员 Cookie 才能播放；
- QQ 空间「背景音乐」是 `dir` 目录而不是普通歌单，网页 Cookie 登录读不到它的曲目，点开时会给出说明；
- 极少数 QQ 账号扫码后拿不到 `qm_keyst`，此时回退到 Cookie 登录（弹窗会提示）。
