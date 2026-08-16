# Doge for Even G2

Even G2でXのHome、Following、Bookmarks、threadを読み、Like、Repost、Bookmarkを切り替えるTypeScript製アプリです。

X API keyは使いません。Mac上のログイン済みブラウザを[`twitter_api_safe_relay`](https://github.com/fa0311/twitter_api_safe_relay)が操作し、このプロジェクトのgatewayが必要な結果だけを固定DTOへ変換してEven G2へ渡します。Xが`promotedMetadata`を付けたtimeline entryは広告として正規化前に除外します。

> [!IMPORTANT]
> `twitter_api_safe_relay`をインターネットへ直接公開しないでください。Tunnelへ接続するのはBearer認証付きgatewayだけです。write操作はLike、Repost、Bookmarkの有効化・解除だけに制限し、投稿、返信、Follow、削除などは公開しません。

## 構成

```text
Even G2 / iPhone WebView
        │ authenticated GET / PUT / DELETE
        ▼
Doge gateway :8787
        │ allowlist済み10操作だけ
        ▼
twitter_api_safe_relay :6900 (localhost only)
        │
        ▼
ログイン済みX browser profile
```

- `apps/g2` — Even Hub SDK、576×288 glasses UI、投稿者icon・投稿画像、iPhone companion UI
- `apps/gateway` — Hono/Node.js gateway、固定reaction routes、Xレスポンス正規化、avatar・投稿画像proxy
- `packages/contracts` — frontendとgatewayで共有するZod schema
- `scripts` — relay catalog同期、preview、maintainer用deployment

## 操作

起動直後はHome、Following、Bookmarksのview選択画面です。

| 場所        | 入力       | 動作                              |
| ----------- | ---------- | --------------------------------- |
| view選択    | scroll     | Home / Following / Bookmarks選択  |
| view選択    | tap        | 選択したviewを開く                |
| view選択    | double tap | Dogeを終了                        |
| 投稿view    | 上スワイプ | 本文の続き / 読了後に次の投稿     |
| 投稿view    | 下スワイプ | 本文の前ページ / 前の投稿         |
| 投稿view    | tap        | 右側のaction menuを開く           |
| 投稿view    | double tap | view選択へ戻る                    |
| action menu | scroll     | Like / Repost / Bookmark / thread |
| action menu | tap        | 選択を実行し、成功後menuを閉じる  |

G2のscrollはcontentを引っ張るnatural/inverse方式ではありません。投稿viewでは、進みたい方向へ指をslideします（下方向で次の本文page／post、上方向で前の本文page／post）。view選択とaction menuはG2 native listのscrollに従います。

長い本文はG2の実フォント幅に合わせてページ分割し、文字を省略しません。G2画面内には常設の操作guideを置かず、その領域も本文とview選択listに使います。画像付きpostでは、本文末尾の同じtimeline frame内に1〜4枚を縦横比を維持したgridとして埋め込みます。本文が短いほど画像領域を大きく取り、各slotは取得中だけ独立したloading placeholderを表示します。Galleryは画像だけを最大表示する別modeです。動画・animated GIFは静止posterを再生マーク付きで表示し、動画データの取得・再生は行いません。

取得済みmediaのBlobとG2用に変換済みのPNG tileはWebView memory内のLRU cacheへ短期間保持します。同じpostやGallery画像へ戻った場合はnetwork取得・decode・再変換を省略します。ただしEven SDKには眼鏡側の画像cacheをIDで再利用するAPIがないため、page rebuild後のBLE再送自体は必要です。icon、投稿者画像、投稿画像はG2 bridgeへencoded PNG/JPEGのbyte列として順番に渡します。高速にpostやviewを切り替えた場合、古いavatar取得結果は破棄し、最新renderだけをimage containerへ反映します。

`apps/g2/public/doge-icon.png` はiPhone側のweb app iconと、view選択後の初回loading画面で使います。特定の写真やTwitter/Xの旧logoを複製しない、このproject用のoriginal illustrationです。Even Hubの掲載iconには同じファイルを手動でuploadしてください。詳細は同directoryの `doge-icon.LICENSE.md` を参照してください。

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

初回はphone画面のGateway settingsへ`http://127.0.0.1:8787`と43文字の開発用access keyを入力して`Save and test connection`を押します。認証に成功した組だけが保存され、以後は自動復元されます。

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

このcommandは256-bitの一時tokenを生成し、Bearer認証を必須にしたscoped gatewayと使い捨てCloudflare Quick Tunnelを起動します。tokenはterminalへ出力せず、権限`600`の一時QR画像にだけ埋め込みます。URL fragmentはCloudflareへ送られません。phone画面でQRと同じHTTPS originをGateway URLとして保存・検証すると、以後のAPI requestへAuthorization headerが付与されます。`Ctrl-C`でgatewayとTunnelを終了し、QR画像を削除してtokenを失効させます。

Quick Tunnelは実機開発専用で、可用性保証や固定URLはありません。本番運用では`doge.h1ka.ru`のnamed Tunnelを使います。

## Public buildとGateway pairing

public buildは特定のGateway URLを含みません。Even Hub manifestはuserがphone画面で選ぶ任意のHTTPS serviceへの通信を許可し、Dogeは次の順序でpairingします。

1. userがGatewayのHTTPS URLと43文字のaccess keyを入力
2. DogeがBearer key付きで`GET /api/v1/session`を呼ぶ
3. 認証済みDoge Gateway protocol v1応答を確認
4. 成功したURLとkeyの組だけをEven App SDKのdevice local storageへ保存
5. 次回起動時は保存値を復元し、同じsession endpointで再確認

未設定時にtimelineやmedia requestは送信しません。keyを変更するときだけ新しい値を入力し、空欄なら保存済みkeyを維持します。`Forget access key`はURLを入力欄へ残したままkeyを削除します。旧WebView storageに保存済みのURL＋keyも初回にdevice storageへ移行します。

公開packageを作る場合:

```bash
npm run verify
npm run pack:g2:production
```

`apps/g2/app.production.json`はGit管理し、network whitelistを`https://`に固定します。build時環境変数、配布package、frontend sourceのいずれにも運用者のGateway URLやaccess keyを埋め込みません。Gateway実装の互換contractは[`docs/gateway-protocol.md`](docs/gateway-protocol.md)です。

各userはこのcontractを実装したGatewayをHTTPSで公開し、phone画面からpairingします。X cookieはGateway hostから出ません。

## Maintainer deployment

このrepositoryのmaintainer用named Tunnelは現在`https://doge.h1ka.ru`を使います。これはserver運用scriptの設定であり、Doge public buildのdefault接続先ではありません。

Cloudflare Tunnelで公開するのはgatewayの`127.0.0.1:8787`だけです。Safe Relayのport `6900`はTunnelへ接続しません。

初回にDoge access keyを生成し、クリップボードへコピーします。key自体はterminalへ表示せず、`var/doge-access-key`へ権限`600`で保存します。

```bash
npm run production:key
```

Even AppのDoge画面で`https://doge.h1ka.ru`とkeyを入力し、`Save and test connection`を押します。

Safe Relayが起動中であることを確認して本番gatewayとnamed Tunnelを起動します。

```bash
npm run production:start
```

Gateway sourceを更新して`npm run build`した場合、実行中の`production:start`も再起動してください。Node processは起動時に読み込んだ`dist/server.js`を使い続けるため、buildだけではprofileなどの新routeは反映されません。

外出中もMacの電源・ネット接続、Safe Relay、`production:start`を維持してください。現在の構成ではiPhoneとG2だけでXへ直接接続するわけではなく、自宅Macがbackendです。

## Private buildとBeta build

推奨は**Beta build**です。Betaは公開Store審査なしで、自分のEven accountだけをtester groupへ追加できます。公開版と同じlifecycleで動き、phone lockやbackground遷移も含めた外出利用を試せます。Private buildも自分だけでinstallできますが、配布できず、lifecycleは公開版と完全には同じではありません。

1. `npm run verify && npm run pack:g2:production`
2. Even HubでBeta tester groupを作り、自分のEven account emailを追加
3. `apps/g2/doge.ehpk`をbuildとしてuploadし、そのgroupへpush
4. iPhoneのEven Appで`Me → Beta tester → Doge → Install`
5. glasses homeからDogeを起動し、phone画面でaccess keyを一度だけpair

公開versionはrelease後に同じversion番号で差し替えられないため、Betaでnative settings復元、background復帰、実機profile表示を確認してから提出します。掲載iconにはrepository同梱のoriginal assetを使えます。

公開審査が発生するのはStoreへsubmissionする段階です。詳細はEven Hub公式の[Beta testing](https://hub.evenrealities.com/docs/test/beta-testing)と[Private testing](https://hub.evenrealities.com/docs/test/private-testing)を参照してください。

## Security defaults

- public client routeは認証確認、timeline、thread、profile、avatar・投稿画像の`GET`と、Like、Repost、Bookmark専用の`PUT`/`DELETE`のみ
- feed、cursor、post IDをschema検証
- relay base URLはloopback HTTPのみ許可
- relay operationは4つのread操作とFavorite/Unfavorite、Create/Delete Retweet、Create/Delete Bookmarkの6つだけ
- XのGraphQL errorをHTTP 200でも失敗として扱う
- upstream timeout 15秒、response上限5 MB
- avatar proxyは`pbs.twimg.com/profile_images`のHTTPS画像だけを許可し、redirect禁止、5秒timeout、512 KB上限、画像content-type必須
- 投稿画像proxyは`pbs.twimg.com`の写真および動画posterの固定pathだけを許可し、redirect禁止、5秒timeout、4 MB上限、JPEG/PNG/WebPのcontent-typeとfile signature一致を必須化。`video.twimg.com`やMP4/HLSは取得しない
- responseは固定DTOへ変換し、X cookieや内部headerをclientへ返さない
- production responseは`no-store`、security headers付き
- 本番gatewayはBearer token必須。tokenを`.ehpk`へ埋め込まず、各iPhoneで一度だけpair
- installed WebViewのoriginが変わってもBearer認証を必須にしたままCORS responseを返す

## Gitに入れないもの

`.env*`、Cloudflare credentials、browser profile、relay catalog、build output、coverage、`.ehpk`を除外しています。X cookieやCloudflare tokenをrepository内へ置かないでください。

## License

[GNU Affero General Public License v3.0 only](LICENSE)。Trauma projectと同じライセンスです。
