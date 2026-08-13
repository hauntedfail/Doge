# Doge for Even G2

Even G2でXのHome、Following、Bookmarks、threadを読むための、TypeScript製read-onlyアプリです。

X API keyは使いません。Mac上のログイン済みブラウザを[`twitter_api_safe_relay`](https://github.com/fa0311/twitter_api_safe_relay)が操作し、このプロジェクトのgatewayが必要な読み取り結果だけを固定DTOへ変換してEven G2へ渡します。

> [!IMPORTANT]
> `twitter_api_safe_relay`をインターネットへ直接公開しないでください。このアプリにも投稿、Like、Repost、Followなどのwrite endpointはありません。本番構成でもTunnelへ接続するのはBearer認証付きread-only gatewayだけです。

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

- `apps/g2` — Even Hub SDK、576×288 glasses UI、投稿者icon・投稿画像、iPhone companion UI
- `apps/gateway` — Hono/Node.jsのread-only gateway、Xレスポンス正規化、avatar・投稿画像proxy
- `packages/contracts` — frontendとgatewayで共有するZod schema
- `scripts` — relay catalog同期とproduction origin生成

## 操作

| 入力           | 動作                               |
| -------------- | ---------------------------------- |
| 上スワイプ     | 本文の続き / 読了後に次の投稿      |
| 下スワイプ     | 本文の前ページ / 前の投稿          |
| 右glassesをtap | threadを開く / 戻る / error時retry |
| R1をtap        | Home → Following → Bookmarks       |
| double tap     | 終了確認                           |

長い本文はG2の実フォント幅に合わせてページ分割し、文字を省略しません。画像付きポストでは本文を最後まで進めたページの直下に、縦横比を維持した画像を表示します。現時点ではポスト内の最初の写真1枚を表示します。

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

生成物は`apps/g2/doge.ehpk`です。`.ehpk`とbuild成果物はGit管理しません。

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

Quick Tunnelは実機開発専用で、可用性保証や固定URLはありません。本番運用では`doge.h1ka.ru`のnamed Tunnelを使います。

## Doge本番構成

本番originは`https://doge.h1ka.ru`です。manifestとfrontend環境を再生成する場合:

```bash
npm run configure:origin -- https://doge.h1ka.ru
npm run build
npm run pack:g2:production
```

このコマンドはGit管理外の次の2ファイルを生成します。

- `apps/g2/.env.production.local` — frontendのgateway origin
- `apps/g2/app.production.json` — Even Hub network whitelist

Cloudflare Tunnelで公開するのはgatewayの`127.0.0.1:8787`だけです。Safe Relayのport `6900`はTunnelへ接続しません。

初回にDoge access keyを生成し、クリップボードへコピーします。key自体はterminalへ表示せず、`var/doge-access-key`へ権限`600`で保存します。

```bash
npm run production:key
```

Even AppのDoge画面で一度だけ貼り付けて`Pair Doge`を押します。keyはそのiPhoneのWebView local storageへ保存され、`Forget access key`を押すまで再起動後も使われます。X cookieはMacから出ません。

Safe Relayが起動中であることを確認して本番gatewayとnamed Tunnelを起動します。

```bash
npm run production:start
```

外出中もMacの電源・ネット接続、Safe Relay、`production:start`を維持してください。現在の構成ではiPhoneとG2だけでXへ直接接続するわけではなく、自宅Macがread-only backendです。

## Private buildとBeta build

推奨は**Beta build**です。Betaは公開Store審査なしで、自分のEven accountだけをtester groupへ追加できます。公開版と同じlifecycleで動き、phone lockやbackground遷移も含めた外出利用を試せます。Private buildも自分だけでinstallできますが、配布できず、lifecycleは公開版と完全には同じではありません。

1. `npm run verify && npm run pack:g2:production`
2. Even HubでBeta tester groupを作り、自分のEven account emailを追加
3. `apps/g2/doge.ehpk`をbuildとしてuploadし、そのgroupへpush
4. iPhoneのEven Appで`Me → Beta tester → Doge → Install`
5. glasses homeからDogeを起動し、phone画面でaccess keyを一度だけpair

公開審査が発生するのはStoreへsubmissionする段階です。詳細はEven Hub公式の[Beta testing](https://hub.evenrealities.com/docs/test/beta-testing)と[Private testing](https://hub.evenrealities.com/docs/test/private-testing)を参照してください。

## Security defaults

- public client routeはtimeline、thread、avatar・投稿画像のread-only `GET`のみ
- feed、cursor、post IDをschema検証
- relay base URLはloopback HTTPのみ許可
- relay operationはHomeTimeline、HomeLatestTimeline、Bookmarks、TweetDetailだけ
- XのGraphQL errorをHTTP 200でも失敗として扱う
- upstream timeout 15秒、response上限5 MB
- avatar proxyは`pbs.twimg.com/profile_images`のHTTPS画像だけを許可し、redirect禁止、5秒timeout、512 KB上限、画像content-type必須
- 投稿画像proxyは`pbs.twimg.com/media`のJPEG/PNG/WebPだけを許可し、redirect禁止、5秒timeout、4 MB上限、content-typeとfile signature一致を必須化
- responseは固定DTOへ変換し、X cookieや内部headerをclientへ返さない
- production responseは`no-store`、security headers付き
- 本番gatewayはBearer token必須。tokenを`.ehpk`へ埋め込まず、各iPhoneで一度だけpair
- installed WebViewのoriginが変わってもBearer認証を必須にしたままCORS responseを返す

## Gitに入れないもの

`.env*`、Cloudflare credentials、browser profile、relay catalog、build output、coverage、`.ehpk`を除外しています。X cookieやCloudflare tokenをrepository内へ置かないでください。

## License

[GNU Affero General Public License v3.0 only](LICENSE)。Trauma projectと同じライセンスです。
