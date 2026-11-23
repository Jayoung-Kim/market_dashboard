// 경제 신호 지표 (네이버 증권, 비공식)
// - 미국 장단기 금리차(10년-2년), 한국 국고채 3년/10년, 코스피·코스닥 투자자별 순매수(억원)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const num = v => { if (v == null || v === '') return null; const n = parseFloat(String(v).replace(/[,+]/g, '')); return isNaN(n) ? null : n; };
const get = async url => {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
};

async function bond(code) {
  const j = await get('https://api.stock.naver.com/marketindex/bond/' + encodeURIComponent(code));
  const v = num(j.closePrice), chg = num(j.fluctuations);
  let c = chg;
  if (c != null && c > 0 && /FALLING/.test(j.fluctuationsType?.name || '')) c = -c;
  return { name: j.name, value: v, change: c, time: j.localTradedAt ? Math.floor(new Date(j.localTradedAt).getTime() / 1000) : null, status: j.marketStatus || null };
}

async function flow(index) {
  const j = await get(`https://m.stock.naver.com/api/index/${index}/integration`);
  const d = j.dealTrendInfo || {};
  return { date: d.bizdate || null, personal: num(d.personalValue), foreign: num(d.foreignValue), institutional: num(d.institutionalValue) };
}

const safe = p => p.catch(e => ({ error: String(e.message || e) }));

module.exports = async (req, res) => {
  const [us10, us2, kr3, kr10, kospi, kosdaq] = await Promise.all([
    safe(bond('US10YT=RR')), safe(bond('US2YT=RR')), safe(bond('KR3YT=RR')), safe(bond('KR10YT=RR')),
    safe(flow('KOSPI')), safe(flow('KOSDAQ')),
  ]);
  let spread = { error: 'no data' };
  if (us10.value != null && us2.value != null) {
    const value = us10.value - us2.value;
    const prev = (us10.change != null && us2.change != null) ? (us10.value - us10.change) - (us2.value - us2.change) : null;
    spread = { value, prev, us10: us10.value, us2: us2.value, time: Math.max(us10.time || 0, us2.time || 0) || null };
  }
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
  res.status(200).json({ time: Date.now() / 1000, spread, kr3, kr10, kospi, kosdaq });
};
