# 野鳥クイックリファレンス

大きさ・色・季節・生息地・鳴き声から野鳥を絞り込んで調べられる、GitHub Pages上で動く図鑑Webアプリです。
撮影中に「これ何の鳥だっけ」となったとき、その場でスマホから調べられます。

検索UIは[サントリー「日本の鳥百科」](https://www.suntory.co.jp/eco/birds/encyclopedia/)の構成(特徴/鳴き声/50音順の3タブ検索)を参考にしていますが、**写真・イラスト・音源はすべて自分で用意したもの**を使う前提です(同サイトの著作物は含まれていません)。

## 機能

- フリーワード検索(スペース区切りでAND検索)
- 特徴で探す(大きさ・色・季節・生息地)
- 鳴き声で探す(鳴き声タイプ・季節・生息地)
- 50音順一覧
- 詳細画面(写真・特徴・鳴き声再生・似ている種へのリンク)
- ダークモード
- オフライン対応(PWA。ホーム画面に追加してアプリのように使えます)
- 撮影記録(「この種を記録する」→ 端末保存 + 任意でGitHubに同期)

## セットアップ

### 1. リポジトリとPagesの設定

1. このフォルダの中身をPublicリポジトリにpushする
2. `Settings → Pages → Build and deployment → Source` を **「GitHub Actions」** にする
   (ブランチからの配信ではなく、`.github/workflows/deploy.yml` から配信します)
3. `main` にpushすると自動でビルド・デプロイされます

### 2. データを揃える

- `birds.json` に種を追加・編集する(スキーマは下記)
- `images/<id>.jpg` に写真を置く(自分で撮影したもの)
- 鳴き声の音源がある場合は `audio/<id>.mp3` に置き、`birds.json` の `audio` にパスを設定する

### 3. 撮影記録の同期(任意)

[`bird-log-template`](../bird-log-template) を参照して、Private リポジトリを用意すると、
撮影記録を複数端末で共有できます。設定しなくてもアプリ自体は動きます。

## birds.json のスキーマ

```json
{
  "id": "suzume",
  "name": "スズメ",
  "kana": "すずめ",
  "row": "サ",
  "size": "小",
  "colors": ["茶系", "白系", "黒系"],
  "seasons": ["春", "夏", "秋", "冬"],
  "habitats": ["市街・住宅地", "農耕地"],
  "beak": "太く短い",
  "voice_type": "単音",
  "voice_text": "チュンチュン",
  "audio": null,
  "features": "頬に黒い斑、頭は茶色",
  "similar": ["ニュウナイスズメ"],
  "image": "images/suzume.jpg"
}
```

| 項目 | 選択肢 |
|---|---|
| `size` | 特大 / 大 / 中 / 小 |
| `colors` | 茶系・白系・黒系・赤系・黄系・青系・緑系・灰系(複数可) |
| `seasons` | 春・夏・秋・冬(複数可) |
| `habitats` | 市街・住宅地 / 河川・湖沼 / 農耕地 / 海 / 森林 / 草地 / 裸地 / 高山(複数可) |
| `row` | 50音の行(ア〜ワ)。一覧の並び順・50音検索に使用 |
| `voice_type` | 単音 / 連続音 / フレーズ / 複雑なメロディ / その他 / `null` |

`scripts/validate_birds.py` で構文・必須項目・表記ゆれをチェックできます(pushすると自動でも走ります)。

```
python3 scripts/validate_birds.py
```

## スクリプト

| ファイル | 役割 |
|---|---|
| `scripts/convert_birds.py` | 旧スキーマ(v1)のbirds.jsonを新スキーマへ変換 |
| `scripts/validate_birds.py` | birds.jsonの検証(CIでも実行) |
| `scripts/optimize_images.py` | 画像を1200px+WebPに変換(CIが差分画像に対して自動実行) |

## GitHub Actions

| ワークフロー | トリガー | 内容 |
|---|---|---|
| `deploy.yml` | `main` へのpush | birds.json検証 → `sw.js` の VERSION をコミットSHAに書き換え → Pagesへデプロイ |
| `validate-birds-json.yml` | birds.jsonを触るPR | 検証のみ(マージ前に気づける) |
| `optimize-images.yml` | `images/**` の変更push | 変更画像だけ1200px+WebPに変換してコミット |

## オフライン動作の確認

1. デプロイ後、iPhoneのSafariで一度アプリを開く(ホーム画面に追加すると尚良い)
2. 機内モードにしても表示・検索・詳細表示ができることを確認する
3. `birds.json` や画像を更新してpushした場合、次にオンラインで開いたときに自動で新データがキャッシュされる
   (`sw.js` のVERSIONがデプロイごとに変わるため、手動でのキャッシュ更新操作は不要)
