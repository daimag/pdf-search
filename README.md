# 見積PDF検索

NAS上の見積PDF（3フォーマット: C&S / SNC / ダイワボウ 他）を、**日付・商品名・仕入先・見積番号など**で全文検索し、ブラウザで一覧＆PDF表示するツール。

## 構成

```
pdfsearch/
├─ indexer/index.py   … NAS走査 → PyMuPDFでテキスト抽出 → SQLite(data/index.db)。差分更新対応
├─ data/index.db      … 検索インデックス（gitignore。indexerが生成）
└─ web/               … Next.js 検索サイト（node:sqlite 使用・ネイティブビルド不要）
   ├─ app/            … 検索UI(page.jsx) と API(search / meta / pdf)
   └─ lib/            … DB接続・設定
```

処理を「**① インデックス作成バッチ**」と「**② 検索Webサイト**」に分離。検索のたびにNASを読まないので、件数が増えても一覧は一瞬。PDF表示のみNASから都度配信。

## 前提

- Python 3 + `pymupdf`（`pip install pymupdf`）
- Node.js 24 以上（組み込みの `node:sqlite` を使用）
- 実行マシンが NAS 共有 `\\nas13b87a\daimag_SHR\0600.見積PDF` にアクセスできること

## 使い方

### 1. インデックス作成（初回・更新時）

```bash
python indexer/index.py           # 差分のみ更新（追加/変更/削除を反映）
python indexer/index.py --full    # 全再構築
python indexer/index.py --base "別のフォルダ"   # 走査先を変更
```

- 約500件で初回2分程度（ほぼNAS読込時間）。2回目以降は変更分だけで高速。
- **定期実行**は Windows タスクスケジューラで夜間に `python indexer/index.py` を叩くのが手軽。

### 2. Web起動

```bash
cd web
npm install
npm run dev      # http://localhost:3100  （本番は npm run build && npm run start）
```

## 設定（環境変数で上書き可）

| 変数 | 既定 | 説明 |
|---|---|---|
| `PDF_NAS_BASE` | `\\nas13b87a\daimag_SHR\0600.見積PDF` | NASルート。PDF配信時にこの配下か検証 |
| `PDF_DB` | `../data/index.db` | SQLiteインデックスの場所 |

## 検索仕様

- 本文＋ファイル名を **部分一致**（NFKCで全角半角・大文字小文字を吸収）。2文字以下の日本語もヒット。
- スペース区切りは **AND検索**。
- 仕入先・年月（開始〜終了）で絞り込み。

## 社内LANでの公開

`web` を社内サーバーで `npm run start` し、そのサーバーがNAS共有にアクセスできればOK。
他PCのブラウザから `http://<サーバーIP>:3100` で利用。PDFはNAS上の実物をサーバー経由で配信。

## メモ

- テキスト抽出は **PyMuPDF** を使用（poppler/pdftotext は Adobe-Japan1 CMap 不足で日本語が抜けないため不採用）。
- 将来「項目単位で厳密に絞る」（期間・仕入先・品目を構造化）needが出たら、3フォーマット別の抽出ルールを indexer に追加可能。現状の全文検索基盤はそのまま活用できる。
