# -*- coding: utf-8 -*-
"""
見積PDF インデクサ
  NAS の見積PDFフォルダを走査し、PyMuPDF で全文テキストを抽出して
  SQLite(docs テーブル) に格納する。パス+更新日時+サイズで差分更新。

使い方:
  python index.py                 # 既定のNASパスを走査
  python index.py --base <dir>    # 別フォルダを走査
  python index.py --full          # 差分を無視して全再構築
"""
import argparse
import os
import re
import sqlite3
import unicodedata
from datetime import datetime, timezone

import fitz  # PyMuPDF

DEFAULT_BASE = r"\\nas13b87a\daimag_SHR\0600.見積PDF"
DEFAULT_DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "index.db")

YYMM_RE = re.compile(r"^\d{4}$")


def norm(s: str) -> str:
    """検索用に正規化: NFKC(全角半角統一)+小文字。"""
    return unicodedata.normalize("NFKC", s or "").lower()


def detect_vendor(rel_parts, filename, text):
    """フォルダ構造→無ければ本文シグネチャから仕入先(3種類)を判定。"""
    # rel_parts 例: ["受領見積書", "2606", "C&S", "xxx.pdf"]
    if len(rel_parts) >= 4:  # YYMM の下に仕入先フォルダがある
        folder = rel_parts[-2]
        if folder not in ("",):
            return folder
    t = text or ""
    if "ダイワボウ情報システム" in t:
        return "ダイワボウ"
    if "C&S" in t or "Quotation" in t:
        return "C&S"
    if "エスエヌシー" in t or filename.upper().startswith("SNC"):
        return "SNC"
    return "その他"


def extract_yymm(rel_parts):
    for p in rel_parts:
        if YYMM_RE.match(p):
            return p
    return None


def yymm_to_date(yymm):
    """'2411' -> '2024-11' """
    if not yymm:
        return None
    yy, mm = int(yymm[:2]), yymm[2:]
    return f"20{yy:02d}-{mm}"


def init_db(conn):
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS docs (
            path        TEXT PRIMARY KEY,   -- NAS上の絶対UNCパス
            rel         TEXT,               -- baseからの相対パス(表示用)
            filename    TEXT,
            vendor      TEXT,               -- 仕入先(C&S/SNC/ダイワボウ/その他)
            yymm        TEXT,               -- フォルダ由来 年月 (2411)
            ym          TEXT,               -- 2024-11
            size        INTEGER,
            mtime       REAL,               -- ファイル更新時刻(epoch)
            pages       INTEGER,
            text        TEXT,               -- 抽出全文(原文)
            search_text TEXT,               -- 正規化済み(検索用) filename+text
            indexed_at  TEXT
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_vendor ON docs(vendor)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ym ON docs(ym)")
    conn.commit()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=DEFAULT_BASE)
    ap.add_argument("--db", default=DEFAULT_DB)
    ap.add_argument("--full", action="store_true", help="差分を無視して全再構築")
    args = ap.parse_args()

    os.makedirs(os.path.dirname(args.db), exist_ok=True)
    conn = sqlite3.connect(args.db)
    init_db(conn)

    existing = {}
    if not args.full:
        for path, mtime, size in conn.execute("SELECT path, mtime, size FROM docs"):
            existing[path] = (mtime, size)

    seen = set()
    added = updated = skipped = failed = 0

    for root, _dirs, files in os.walk(args.base):
        for name in files:
            if not name.lower().endswith(".pdf"):
                continue
            full = os.path.join(root, name)
            seen.add(full)
            try:
                st = os.stat(full)
            except OSError as e:
                print("STAT ERR", full, e)
                failed += 1
                continue

            if not args.full and full in existing:
                old_mtime, old_size = existing[full]
                if abs(old_mtime - st.st_mtime) < 1 and old_size == st.st_size:
                    skipped += 1
                    continue

            rel = os.path.relpath(full, args.base)
            rel_parts = rel.split(os.sep)
            try:
                doc = fitz.open(full)
                text = "\n".join(page.get_text() for page in doc)
                pages = doc.page_count
                doc.close()
            except Exception as e:  # noqa: BLE001
                print("PDF ERR", rel, e)
                failed += 1
                continue

            yymm = extract_yymm(rel_parts)
            vendor = detect_vendor(rel_parts, name, text)
            row = (
                full,
                rel,
                name,
                vendor,
                yymm,
                yymm_to_date(yymm),
                st.st_size,
                st.st_mtime,
                pages,
                text,
                norm(name + "\n" + text),
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
            )
            conn.execute(
                """INSERT INTO docs
                   (path,rel,filename,vendor,yymm,ym,size,mtime,pages,text,search_text,indexed_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(path) DO UPDATE SET
                     rel=excluded.rel, filename=excluded.filename, vendor=excluded.vendor,
                     yymm=excluded.yymm, ym=excluded.ym, size=excluded.size, mtime=excluded.mtime,
                     pages=excluded.pages, text=excluded.text, search_text=excluded.search_text,
                     indexed_at=excluded.indexed_at""",
                row,
            )
            if full in existing:
                updated += 1
            else:
                added += 1

    # NASから消えたファイルをDBからも削除
    removed = 0
    if not args.full:
        for (path,) in conn.execute("SELECT path FROM docs").fetchall():
            if path not in seen:
                conn.execute("DELETE FROM docs WHERE path=?", (path,))
                removed += 1

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM docs").fetchone()[0]
    conn.close()
    print(f"完了: 追加{added} 更新{updated} スキップ{skipped} 削除{removed} 失敗{failed} / DB総数{total}")


if __name__ == "__main__":
    main()
