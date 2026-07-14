@echo off
chcp 65001 > nul
rem ===== 見積PDF検索 サーバー起動 =====
rem 事前に setup.bat を実行済みであること。
cd /d "%~dp0web"

echo 見積PDF検索サーバーを起動します...
echo   このPCのIP:  で他PCからは  http://（このPCのIP）:3100
ipconfig | findstr /C:"IPv4"
echo   ローカル確認: http://localhost:3100
echo   （このウィンドウを閉じるとサーバーが止まります）
echo.
call npm run start
pause
