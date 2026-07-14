@echo off
chcp 65001 > nul
rem ===== 見積PDF検索 サーバー初期セットアップ =====
rem このバッチをサーバー機で1回だけ実行する（Node.js 24以上が必要）
cd /d "%~dp0"

echo === Node.js バージョン確認 ===
node -v
if errorlevel 1 (
  echo [エラー] Node.js が見つかりません。https://nodejs.org/ から v24 以上を入れてください。
  pause & exit /b 1
)

echo.
echo === 依存パッケージのインストール ===
cd web
call npm install
if errorlevel 1 ( echo [エラー] npm install に失敗しました。 & pause & exit /b 1 )

echo.
echo === 本番ビルド ===
call npm run build
if errorlevel 1 ( echo [エラー] ビルドに失敗しました。 & pause & exit /b 1 )

echo.
echo ============================================
echo セットアップ完了。
echo   ・索引を作る/更新する : update-index.bat  （要 Python + pymupdf）
echo   ・サーバーを起動する   : start-server.bat
echo   ・他PCからのアクセス   : http://（このPCのIP）:3100
echo ============================================
pause
