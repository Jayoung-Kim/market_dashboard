// 임시: 데이터 출처 확인용 (확인 후 삭제)
const ALLOW = ['m.stock.naver.com', 'api.stock.naver.com', 'fred.stlouisfed.org', 'polling.finance.naver.com', 'finance.naver.com'];
module.exports = async (req, res) => {
  let u;
  try { u = new URL(String(req.query.u || '')); } catch { return res.status(400).json({ error: 'bad url' }); }
  if (u.protocol !== 'https:' || !ALLOW.includes(u.hostname)) return res.status(400).json({ error: 'host not allowed' });
  try {
    const r = await fetch(u, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://m.stock.naver.com/' }, signal: AbortSignal.timeout(8000) });
    const t = await r.text();
    res.status(200).json({ status: r.status, body: t.slice(0, 3000) });
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
};
