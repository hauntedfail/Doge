# Even G2 X Reader

Even G2でXのHome、Following、Bookmarks、threadを読むための、TypeScript製read-onlyアプリです。

X API keyは使いません。Mac上のログイン済みブラウザを[`twitter_api_safe_relay`](https://github.com/fa0311/twitter_api_safe_relay)が操作し、このプロジェクトのgatewayが必要な読み取り結果だけを固定DTOへ変換してEven G2へ渡します。

> [!IMPORTANT]
> `twitter_api_safe_relay`をインターネットへ直接公開しないでください。このアプリにも投稿、Like、Repost、Followなどのwrite endpointはありません。Cloudflare Tunnelと認証は次の段階で構成します。それまではgatewayもlocalhostのまま使ってください。

## 構成

```text
Even G2 / iPhone WebView
        │ GET /api/v1/*
        ▼
read-only gateway :8787
        │ allowlist済み4操作だけ
        ▼
twitter_api_safe_relay :6900 (localhost only)
        │
        ▼
ログイン済みX browser profile
```

- `apps/g2` — Even Hub SDK、576×288 glasses UI、iPhone companion UI
- `apps/gateway` — Hono/Node.jsのread-only gateway、Xレスポンス正規化
- `packages/contracts` — frontendとgatewayで共有するZod schema
- `scripts` — relay catalog同期とproduction origin生成

## 操作

| 入力           | 動作                               |
| -------------- | ---------------------------------- |
| 上スワイプ     | 次の投稿                           |
| 下スワイプ     | 前の投稿                           |
| 右glassesをtap | threadを開く / 戻る / error時retry |
| R1をtap        | Home → Following → Bookmarks       |
| double tap     | 終了確認                           |

## 必要環境

- Node.js 22以降
- Even Hub対応のEven Appとpairing済みEven G2
- live X利用時のみ、別途起動した`twitter_api_safe_relay`とログイン済みbrowser profile

## すぐ試す（mock）

mockにはXへの接続が不要です。

```bash
npm install
npm run dev
```

gatewayは`http://127.0.0.1:8787`、Viteは`http://127.0.0.1:5173`で起動します。iPhone側画面はVite URL、Even Hub simulatorにも同じVite URLを指定してください。

検証とpackaging:

```bash
npm run verify
npm run pack:g2
```

生成物は`apps/g2/g2-x-reader.ehpk`です。`.ehpk`とbuild成果物はGit管理しません。

## live X relayへ切り替える

このprojectはHeliumとは別のPlaywright Chromium profileを使います。初回だけ専用browserでXへログインし、以後は`var/relay-profile`に保存されたsessionを使います。profileにはX cookieとLocal Storageが入るため、directory全体をGitから除外しています。

最初に専用Chromiumをinstallします。

```bash
npx playwright install chromium
```

Safe Relayと専用browserを起動します。

```bash
npm run relay:login
```

表示されたChromiumでXへログインし、`https://x.com/home`が表示されたらwindowを開いたままにします。別terminalで状態を確認できます。

```bash
npm run relay:check
```

続いて現在のquery IDとfeature flagsを取得し、gatewayをrelay modeで起動します。

```bash
npm run relay:sync
X_SOURCE=relay npm run dev:gateway
npm run dev:g2
```

Safe Relayは`127.0.0.1:6900`、gatewayは`127.0.0.1:8787`を使います。`3000`はこのMacのTraumaが使用中なので使いません。Safe Relayのbrowserを閉じるか`Ctrl-C`するとrelayも停止します。

relay catalogはX側の変更に追従するversion lockです。`var/requests.ndjson`はaccount由来のIDやcursorを含み得るため、`.gitignore`で除外しています。gatewayは起動後もcatalogを読み直すため、同期後の再buildは不要です。

### 認証付き実機preview

Safe Relayへログイン済みで、`npm run build`と`npm run relay:sync`が完了していれば、実Xデータ用の一時previewを起動できます。

```bash
npm run preview:live
```

このcommandは256-bitの一時tokenを生成し、Bearer認証を必須にしたread-only gatewayと使い捨てCloudflare Quick Tunnelを起動します。tokenはterminalへ出力せず、権限`600`の一時QR画像にだけ埋め込みます。URL fragmentはCloudflareへ送られず、Even WebViewがsession内でtokenを取り込み、API requestのAuthorization headerへ変換します。`Ctrl-C`でgatewayとTunnelを終了し、QR画像を削除してtokenを失効させます。

Quick Tunnelは実機開発専用で、可用性保証や固定URLはありません。本番運用では`h1ka.ru`のnamed TunnelとCloudflare Accessへ置き換えます。

## 外部URLを設定する（次の段階）

最終subdomainが決まったら、bare HTTPS originを指定します。

```bash
npm run configure:origin -- https://YOUR-SUBDOMAIN.h1ka.ru
npm run build
npm run pack:g2:production
```

このコマンドはGit管理外の次の2ファイルを生成します。

- `apps/g2/.env.production.local` — frontendのgateway origin
- `apps/g2/app.production.json` — Even Hub network whitelist

Cloudflare Tunnelで公開するのはgatewayの`127.0.0.1:8787`だけです。Safe Relayのport `6900`はTunnelへ接続しません。認証方式を決めるまでは外部公開しないでください。

gatewayのCORSは`ALLOWED_ORIGINS`に完全一致したWebView originだけを許可します。simulatorでは既定値で足ります。実機packageのoriginはEven App側の配信方式で変わり得るため、最初の接続時だけ`DEBUG_REQUESTS=1`でmethod・path・Originを確認し、その値を明示設定します。`*`にはしません。

```bash
X_SOURCE=relay \
TWITTER_RELAY_BASE_URL=http://127.0.0.1:6900 \
ALLOWED_ORIGINS=https://OBSERVED-WEBVIEW-ORIGIN.example \
npm run start --workspace @even-g2-x-reader/gateway
```

## Security defaults

- public client routeは`GET /api/v1/timeline`と`GET /api/v1/posts/:id/thread`のみ
- feed、cursor、post IDをschema検証
- relay base URLはloopback HTTPのみ許可
- relay operationはHomeTimeline、HomeLatestTimeline、Bookmarks、TweetDetailだけ
- XのGraphQL errorをHTTP 200でも失敗として扱う
- upstream timeout 15秒、response上限5 MB
- responseは固定DTOへ変換し、X cookieや内部headerをclientへ返さない
- production responseは`no-store`、security headers付き
- optional bearer tokenをgatewayで利用可能。ただしtokenをG2 bundleへ埋め込まないこと

## Gitに入れないもの

`.env*`、Cloudflare credentials、browser profile、relay catalog、build output、coverage、`.ehpk`を除外しています。X cookieやCloudflare tokenをrepository内へ置かないでください。

## License

[GNU Affero General Public License v3.0 only](LICENSE)。Trauma projectと同じライセンスです。
