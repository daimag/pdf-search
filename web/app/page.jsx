"use client";
import { useEffect, useState, useCallback } from "react";
import "./globals.css";

function fmtSize(n) {
  if (!n) return "";
  return n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + "MB" : Math.round(n / 1024) + "KB";
}

export default function Page() {
  const [meta, setMeta] = useState({ vendors: [], months: [], total: 0 });
  const [q, setQ] = useState("");
  const [vendor, setVendor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch("/api/meta")
      .then((r) => r.json())
      .then(setMeta)
      .catch(() => {});
  }, []);

  const search = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    if (vendor) p.set("vendor", vendor);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    try {
      const r = await fetch("/api/search?" + p.toString());
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, [q, vendor, from, to]);

  // 初回 & フィルタ変更で自動検索
  useEffect(() => {
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendor, from, to]);

  return (
    <div className="app">
      <div className="left">
        <header>
          <h1>見積PDF検索 <span style={{ color: "#9ca3af", fontWeight: 400, fontSize: 12 }}>({meta.total}件)</span></h1>
          <div className="controls">
            <input
              type="text"
              placeholder="商品名・仕入先・日付・見積番号など（スペースでAND検索）"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button onClick={search} disabled={loading}>検索</button>
          </div>
          <div className="controls" style={{ marginTop: 8 }}>
            <select value={vendor} onChange={(e) => setVendor(e.target.value)}>
              <option value="">仕入先: すべて</option>
              {meta.vendors.map((v) => (
                <option key={v.vendor} value={v.vendor}>{v.vendor} ({v.n})</option>
              ))}
            </select>
            <select value={from} onChange={(e) => setFrom(e.target.value)}>
              <option value="">開始月</option>
              {meta.months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ color: "#9ca3af" }}>〜</span>
            <select value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">終了月</option>
              {meta.months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="hint">キーワードは本文＋ファイル名を部分一致で検索します。</div>
        </header>

        <div className="results">
          {loading && <div className="loading">検索中…</div>}
          {!loading && data && (
            <>
              <div className="count">{data.total}件ヒット{data.total > data.results.length ? `（上位${data.results.length}件表示）` : ""}</div>
              {data.results.length === 0 && <div className="noresult">該当する見積が見つかりません。</div>}
              {data.results.map((r) => (
                <div
                  key={r.id}
                  className={"item" + (selected === r.id ? " active" : "")}
                  onClick={() => setSelected(r.id)}
                >
                  <div className="fn">{r.filename}</div>
                  <div className="meta">
                    <span className="badge">{r.vendor}</span>
                    <span>{r.ym}</span>
                    <span>{r.pages}p</span>
                    <span>{fmtSize(r.size)}</span>
                  </div>
                  {r.snippet && <div className="snip">{r.snippet}</div>}
                  <div className="actions">
                    <a href={`/api/pdf?id=${r.id}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>新しいタブで開く</a>
                    <a href={`/api/pdf?id=${r.id}&download=1`} onClick={(e) => e.stopPropagation()}>ダウンロード</a>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="right">
        {selected ? (
          <iframe title="pdf" src={`/api/pdf?id=${selected}`} />
        ) : (
          <div className="empty">← 検索結果を選ぶとここにPDFが表示されます</div>
        )}
      </div>
    </div>
  );
}
