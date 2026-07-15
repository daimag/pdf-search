# 引き継ぎメモ（Claude Code / 開発者向け）

別マシンでこのプロジェクトを続ける人（および、そのマシンで動かす Claude Code）が、
すぐ状況を把握して作業を続けられるようにするためのメモ。

## これは何か

NAS上の見積PDF（無数）を、**日付・商品名・仕入先・見積番号など**でブラウザ検索するツール。
- 対象: `\\nas13b87a\daimag_SHR\0600.見積PDF`（構成: `受領見積書/YYMM/[仕入先/]*.pdf`、約495件）
- 見積フォーマットは3種類（C&S / SNC / ダイワボウ 他）
- GitHub: https://github.com/daimag/pdf-search.git

## 構成（なぜこうしたか）

- **抽出とWebを分離**: 「索引作成バッチ(Python)」と「検索Web(Next.js)」を分ける。
  検索のたびにNASを読まない設計。→ 検索は一瞬・NASが落ちても検索は動く。
- **抽出エンジン = PyMuPDF(fitz)**。poppler/pdftotext は Adobe-Japan1(90ms-RKSJ-H) CMap不足で
  日本語が抜けないため不採用。PyMuPDFなら3フォーマット全部クリーンに抽出できることを実証済み。
- **検索 = LIKE部分一致**（NFKC正規化 + 小文字、`search_text`カラム）。
  FTS5 trigram は3文字未満クエリが空振りするため不採用。495件ならLIKEで十分高速。
- **Web = Next.js 14 + node:sqlite（Node24組み込み）**。
  better-sqlite3 は Node24用prebuilt無く VSも要るため回避 → ネイティブビルド不要の node:sqlite に。
  **要 Node.js 24以上**。
- **index.db はマシン間で使い回せる**（中はNASのUNCパス格納なので、同じLANならどのPCでも同じPDFを開ける）。
  → サーバーにPythonを入れずに「別PCで作ったindex.dbをコピー」でも検索は動く。

## ディレクトリ

```
indexer/index.py   … NAS走査→PyMuPDF抽出→SQLite(data/index.db)。差分更新・削除反映あり
data/index.db      … 索引（.gitignore。cloneには含まれない！ 別途生成 or コピーが必要）
web/               … Next.js。app/api/{search,meta,pdf}, app/page.jsx, lib/{db,config}.js
setup.bat / start-server.bat / update-index.bat … ダブルクリック運用スクリプト
SETUP-SERVER.md    … 社内サーバー設置手順（Apache不要/NSSM/IIS/自動起動/索引定期更新）
```

## 現在の状態（2026-07-15 時点）

- 初版完成。別のWin11共有サーバーへ設置し**稼働成功済み**。ポート3100（`http://サーバーIP:3100`）。
- まだ「ポート別・root」で運用中。IIS等での集約(イントラ化)は未着手。
- アップロード機能は無い（不要。PDFはNASに置く運用のまま）。

## 検討中／未決の論点

1. **索引 vs バッチ無し**: 全文検索(中身も検索)を続けるなら索引は必須。
   バッチ負担を減らすなら「タスクスケジューラで夜間自動＋アプリに"今すぐ更新"ボタン」。
   ファイル名/仕入先/日付だけで足りるなら索引なし(ファイル名ライブ検索)も選択肢だがNAS常時接続が前提。
2. **イントラ化**: IISを玄関にしてNodeアプリを裏に置く案（ARR/URL Rewriteでリバースプロキシ、
   Next.jsは `basePath` 設定+再ビルド、ポータルページ）。ユーザーはIIS経験あり。今は情報収集段階。
3. **サービス化**: NSSMでWindowsサービス化推奨。ただし**NASアクセス可能なユーザーで実行**すること
   （SYSTEMだとNAS共有が見えないことがある）。prod/devフォルダは分けること。

## すぐ動かす手順（要約）

1. `git clone` → `setup.bat`（要 Node24+）
2. `data\index.db` を用意（別PCからコピー or `update-index.bat`=要 Python+pymupdf）
3. `start-server.bat` → `http://localhost:3100` で確認
（詳細・常時稼働化は SETUP-SERVER.md 参照）
