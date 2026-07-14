import { DatabaseSync } from "node:sqlite";
import { DB_PATH } from "./config.js";

let _db = null;

export function getDb() {
  if (!_db) {
    _db = new DatabaseSync(DB_PATH, { readOnly: true });
  }
  return _db;
}

// 検索用正規化: NFKC(全角半角統一) + 小文字。indexer の norm() と揃える。
export function normalize(s) {
  return (s || "").normalize("NFKC").toLowerCase();
}
