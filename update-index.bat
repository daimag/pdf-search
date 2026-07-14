@echo off
chcp 65001 > nul
rem ===== 見積PDF検索 索引更新 =====
rem NASを再スキャンして data\index.db を更新する（差分のみ）。
rem 要: Python 3 + pymupdf （初回のみ  pip install pymupdf ）
cd /d "%~dp0"

set PYTHONIOENCODING=utf-8
python indexer\index.py
if errorlevel 1 (
  echo [エラー] 索引更新に失敗しました。Python と pymupdf が入っているか確認してください。
  echo   インストール例:  pip install pymupdf
  pause & exit /b 1
)
echo 索引更新が完了しました。
