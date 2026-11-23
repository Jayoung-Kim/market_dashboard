const { INTERVALS, batch } = require('../lib/yahoo');

module.exports = async (req, res) => {
  const symbols = String(req.query.symbols || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 40);
  let range = String(req.query.range || '1mo');
  if (!INTERVALS[range]) range = '1mo';
  try {
    const data = await batch(symbols, range);
    // Vercel CDN이 30초간 같은 요청을 캐시 → 여러 사람이 봐도 Yahoo 호출이 늘지 않음
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    res.status(200).json({ time: Date.now() / 1000, data });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
