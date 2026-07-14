# 社内サーバーへの設置手順（Windows）

見積PDF検索を、社内の共有サーバー／常時起動PCに置いて全員で使うための手順。
Apache/IIS/nginx は**不要**です（Next.jsが自前のWebサーバーを内蔵）。

---

## 0. この構成の前提

- サーバー機が NAS 共有 `\\nas13b87a\daimag_SHR\0600.見積PDF` にアクセスできること
- 利用者は同じ社内LANのブラウザから `http://（サーバーIP）:3100` でアクセス
- **`data\index.db` は他PCで作ったものをコピーしてもそのまま使えます**
  （中のパスがNASのUNCなので、同じLANならどのマシンでも同じPDFを開ける）

### 必要なもの
| 用途 | 必要ソフト |
|---|---|
| Webサーバー（検索・表示） | **Node.js 24以上**（[nodejs.org](https://nodejs.org/)） |
| 索引の作成・更新 | **Python 3 + pymupdf**（`pip install pymupdf`）※下記A/Bで要否が変わる |

---

## 1. ファイルをサーバーに置く

どちらでもOK：

```powershell
# 方法1: GitHubから取得
git clone https://github.com/daimag/pdf-search.git

# 方法2: このフォルダ(pdfsearch)ごとコピーして貼り付け
```

`node_modules` と `data\index.db` はコピー不要（下で作る/入れる）。

---

## 2. セットアップ（初回1回）

サーバー機で **`setup.bat`** をダブルクリック。
→ `npm install` と本番ビルドが走ります。

---

## 3. 索引データ（index.db）を用意する ※2通り

### A案（推奨・簡単）: 索引は普段使いのPCで作り、DBだけ置く
サーバーにPythonを入れたくない場合。
1. Python+pymupdf がある方のPC（今作業したPC等）で `update-index.bat` を実行
2. できた `data\index.db` を**サーバーの `data\` にコピー**

→ サーバーはNodeだけで検索が動く。更新は新しい `index.db` を上書きコピーするだけ。

### B案（サーバーで自動更新）: サーバーにPythonを入れる
1. サーバーに Python 3 を入れ、`pip install pymupdf`
2. `update-index.bat` を実行（初回は約2分）
3. 夜間自動更新は「6. 索引の定期更新」を設定

---

## 4. 起動して動作確認

**`start-server.bat`** をダブルクリック → ウィンドウにIPが出ます。
- サーバー自身: `http://localhost:3100`
- 他のPCから: `http://（サーバーのIPv4）:3100`

このウィンドウを閉じるとサーバーは止まります。常時稼働は「5.」へ。

---

## 5. ファイアウォール開放＋自動起動

### 5-1. ポート3100を開放（管理者PowerShellで1回）
```powershell
New-NetFirewallRule -DisplayName "PDF検索(3100)" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow
```

### 5-2. 自動起動 — 方法① タスクスケジューラ（手軽）
管理者PowerShellで（`パス` は実際の設置場所に合わせて変更）:
```powershell
$bat = "C:\pdfsearch\start-server.bat"
schtasks /Create /TN "PDF検索サーバー" /TR "cmd /c \"$bat\"" /SC ONSTART /RU SYSTEM /RL HIGHEST /F
```
→ PC起動時に自動でサーバーが上がります。手動起動は `schtasks /Run /TN "PDF検索サーバー"`。

### 5-2. 自動起動 — 方法② NSSMでサービス化（推奨・堅牢）
クラッシュ時に自動再起動、ログオン不要で動く。
1. [NSSM](https://nssm.cc/) をダウンロードし `nssm.exe` を用意
2. 管理者PowerShell:
```powershell
nssm install PDFSearch "C:\Program Files\nodejs\node.exe" "C:\pdfsearch\web\node_modules\next\dist\bin\next" "start" "-H" "0.0.0.0" "-p" "3100"
nssm set PDFSearch AppDirectory "C:\pdfsearch\web"
nssm start PDFSearch
```
→ Windowsサービスとして常駐。停止は `nssm stop PDFSearch`。

---

## 6. 索引の定期更新（B案の場合）

毎晩3時にNASを再スキャンする例（管理者PowerShell）:
```powershell
schtasks /Create /TN "PDF検索_索引更新" /TR "cmd /c \"C:\pdfsearch\update-index.bat\"" /SC DAILY /ST 03:00 /RU SYSTEM /F
```

---

## 7. IPアドレスを固定に（推奨）

DHCPだとサーバーのIPが変わり、利用者のブックマークが切れます。以下のどちらかを：
- サーバーに**固定IP**を設定
- ルーター側で**DHCP予約**（MACアドレスに固定IPを割当）
- または利用者にはIPでなく**`http://（ホスト名）:3100`** を案内（例: `http://共有サーバー名:3100`）

---

## トラブルシュート

| 症状 | 対処 |
|---|---|
| 他PCから開けない | ファイアウォール(5-1)未設定 / IP違い / 別セグメント |
| PDFが表示されない | サーバー機がNAS共有にアクセスできるか確認（エクスプローラで`\\nas13b87a\...`を開けるか） |
| 起動時 `node:sqlite` エラー | Node.jsが24未満。24以上に更新 |
| 索引更新でエラー | `pip install pymupdf` 済みか確認 |
| 検索結果が古い | 索引を更新（A案:DBコピー / B案:update-index.bat） |
