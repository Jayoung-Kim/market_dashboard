// 국내 시세(지연 없음에 가까움): 네이버 증권 실시간 조회 API (비공식)
// /api/kr?codes=005930,000660,KOSPI,KOSDAQ,KPI200
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const INDEX = new Set(['KOSPI', 'KOSDAQ', 'KPI200']);

const num = v => {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
};

async function one(code, raw) {
  const kind = INDEX.has(code) ? 'index' : 'stock';
  const url = `https://polling.finance.naver.com/api/realtime/domestic/${kind}/${encodeURIComponent(code)}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const j = await r.json();
  if (raw) return j;
  const d = (j.datas || [])[0];
  if (!d) throw new Error('no data');
  const price = num(d.closePriceRaw ?? d.closePrice);
  let diff = num(d.compareToPreviousClosePriceRaw ?? d.compareToPreviousClosePrice);
  const dirName = d.compareToPreviousPrice?.name || d.compareToPreviousPrice?.code || '';
  if (diff != null && /FALLING|LOWER_LIMIT|^5$|^4$/.test(String(dirName)) && diff > 0) diff = -diff;
  return {
    code,
    name: d.stockName || d.indexName || code,
    price,
    prevClose: price != null && diff != null ? price - diff : null,
    ratio: num(d.fluctuationsRatioRaw ?? d.fluctuationsRatio),
    time: d.localTradedAt ? Math.floor(new Date(d.localTradedAt).getTime() / 1000) : null,
    status: d.marketStatus || null,
    high: num(d.highPriceRaw ?? d.highPrice),
    low: num(d.lowPriceRaw ?? d.lowPrice),
  };
}

module.exports = async (req, res) => {
  const codes = String(req.query.codes || '').split(',').map(s => s.trim().toUpperCase()).filter(c => /^[0-9A-Z]{4,8}$/.test(c)).slice(0, 60);
  const raw = req.query.raw === '1';
  const out = {};
  await Promise.all(codes.map(async c => {
    try { out[c] = await one(c, raw); } catch (e) { out[c] = { code: c, error: String(e.message || e) }; }
  }));
  res.setHeader('Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10');
  res.status(200).json({ time: Date.now() / 1000, data: out });
};
