import path from "node:path";

// SQLite インデックスのパス（indexer が生成。既定は ../data/index.db）
export const DB_PATH =
  process.env.PDF_DB || path.join(process.cwd(), "..", "data", "index.db");

// NAS のルート。PDF配信時にパスがこの配下にあるか検証してから読む（traversal対策）
export const NAS_BASE =
  process.env.PDF_NAS_BASE || "\\\\nas13b87a\\daimag_SHR\\0600.見積PDF";
