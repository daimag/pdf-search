import fs from "node:fs";
import path from "node:path";
import { getDb } from "../../../lib/db.js";
import { NAS_BASE } from "../../../lib/config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// id(docs.rowid) から NAS 上の実PDFを読み出してブラウザに配信する。
// パスは必ずDB由来 + NAS_BASE配下であることを検証（traversal対策）。
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "", 10);
  const download = searchParams.get("download") === "1";
  if (!Number.isFinite(id)) {
    return new Response("bad id", { status: 400 });
  }

  const db = getDb();
  const row = db
    .prepare("SELECT path, filename FROM docs WHERE rowid = ?")
    .get(id);
  if (!row) return new Response("not found", { status: 404 });

  const base = path.resolve(NAS_BASE).toLowerCase();
  const target = path.resolve(row.path);
  if (!target.toLowerCase().startsWith(base)) {
    return new Response("forbidden", { status: 403 });
  }
  if (!fs.existsSync(target)) {
    return new Response("file missing on NAS", { status: 410 });
  }

  const data = fs.readFileSync(target);
  const dispo = download ? "attachment" : "inline";
  const name = encodeURIComponent(row.filename || "quote.pdf");
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${dispo}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
