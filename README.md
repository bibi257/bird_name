# 野鳥クイックリファレンス

大きさ・色・場所・季節・くちばしから野鳥を絞り込む静的Webアプリ。GitHub Pages で公開し、PWA としてホーム画面に追加すれば圏外でも動く。

## 公開手順（GitHub Pages）

1. GitHub で公開リポジトリを作り、このフォルダの中身をすべて push する
2. リポジトリの **Settings → Pages → Build and deployment**
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)` → Save
3. 数分後 `https://<ユーザー名>.github.io/<リポジトリ名>/` で開ける

パスはすべて相対指定なので、サブディレクトリ公開でもそのまま動く。

## iPhone でオフライン確認

1. Safari で公開URLを開く → 共有 → **ホーム画面に追加**
2. 一度アプリを開いて全種を表示させる（この時点で JSON・画像がキャッシュされる）
3. 機内モードにして開き直し、一覧・絞り込み・詳細が動けばOK

## 種を追加する

`birds.json` に 1 オブジェクト追加する。

```json
{
  "id": "hibari",
  "name": "ヒバリ",
  "kana": "ひばり",
  "size": "スズメ大",
  "colors": ["茶", "白"],
  "habitat": ["田畑", "草地"],
  "season": "留鳥",
  "beak": "細く尖る",
  "features": "頭に短い冠羽。空高く舞い上がってさえずる",
  "similar": ["ホオジロ"],
  "image": "images/hibari.jpg"
}
```

| 項目 | ルール |
|---|---|
| `id` | 英小文字。画像ファイル名と合わせる |
| `kana` | ひらがな。検索用 |
| `size` | スズメ大 / ムクドリ大 / ハト大 / カラス大 / それ以上 |
| `colors` | 茶 / 黒 / 白 / 灰 / 青 / 緑 / 黄 / 赤・橙 |
| `habitat` | 市街地 / 公園 / 林 / 水辺 / 田畑 / 海岸（河川・池・藪など細かい表記も可。`app.js` の `HABITAT_ALIAS` で6区分にまとめる） |
| `season` | 留鳥 / 夏鳥 / 冬鳥 / 旅鳥 |
| `beak` | 細く尖る / 太く短い / 長い / 鉤状 / 平たい |
| `similar` | 他種の `name`。収録済みなら詳細から飛べる。未収録は灰色表示 |
| `image` | 無ければ自動で仮画像を表示 |

## 写真を差し替える

`images/<id>.jpg` を置くだけ。4:3 で横 800px 程度に縮小しておくとキャッシュが軽い。

## 更新を反映させる（重要）

`birds.json` や画像を更新したら **`sw.js` の `VERSION` を上げる**（`v1` → `v2`）。上げないと、すでにインストール済みの端末には古いキャッシュが残り続ける。

## 構成

```
index.html    画面
style.css     スタイル（ライト/ダーク自動、右上ボタンで手動切替）
app.js        読み込み・絞り込み・検索・詳細
birds.json    種データ
sw.js         Service Worker（オフラインキャッシュ）
manifest.json PWA設定
icons/        アプリアイコン
images/       写真（id.jpg）
```
