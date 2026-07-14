import { NextResponse } from "next/server";
import { getDb, normalize } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 本文からヒット箇所前後を抜き出してスニペットを作る
function makeSnippet(text, nq) {
  if (!text) return "";
  const hay = text.toLowerCase();
  const pos = nq ? hay.indexOf(nq) : -1;
  const clean = (s) => s.replace(/\s+/g, " ").trim();
  if (pos < 0) return clean(text.slice(0, 120));
  const start = Math.max(0, pos - 40);
  const end = Math.min(text.length, pos + nq.length + 80);
  return (start > 0 ? "…" : "") + clean(text.slice(start, end)) + (end < text.length ? "…" : "");
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const vendor = searchParams.get("vendor") || "";
  const from = searchParams.get("from") || ""; // 'YYYY-MM'
  const to = searchParams.get("to") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10), 0);

  const db = getDb();
  const where = [];
  const params = {};

  // スペース区切りは AND 検索
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  terms.forEach((t, i) => {
    where.push(`search_text LIKE @t${i}`);
    params[`t${i}`] = `%${t}%`;
  });
  if (vendor) {
    where.push("vendor = @vendor");
    params.vendor = vendor;
  }
  if (from) {
    where.push("ym >= @from");
    params.from = from;
  }
  if (to) {
    where.push("ym <= @to");
    params.to = to;
  }

  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";

  const total = db
    .prepare(`SELECT COUNT(*) n FROM docs ${whereSql}`)
    .get(params).n;

  const rows = db
    .prepare(
      `SELECT rowid AS id, filename, rel, vendor, ym, yymm, pages, size, text
       FROM docs ${whereSql}
       ORDER BY ym DESC, filename ASC
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit, offset });

  const firstTerm = terms[0] || "";
  const results = rows.map((r) => ({
    id: r.id,
    filename: r.filename,
    rel: r.rel,
    vendor: r.vendor,
    ym: r.ym,
    pages: r.pages,
    size: r.size,
    snippet: makeSnippet(r.text, firstTerm),
  }));

  return NextResponse.json({ total, limit, offset, results });
}
