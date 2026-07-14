import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 絞り込みUI用: 仕入先一覧と件数、年月の範囲、総件数
export async function GET() {
  const db = getDb();
  const vendors = db
    .prepare("SELECT vendor, COUNT(*) n FROM docs GROUP BY vendor ORDER BY n DESC")
    .all();
  const months = db
    .prepare("SELECT DISTINCT ym FROM docs WHERE ym IS NOT NULL ORDER BY ym DESC")
    .all()
    .map((r) => r.ym);
  const total = db.prepare("SELECT COUNT(*) n FROM docs").get().n;
  return NextResponse.json({ vendors, months, total });
}
