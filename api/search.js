const { search } = require('../lib/yahoo');

module.exports = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 60);
  try {
    const results = q ? await search(q) : [];
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    res.status(200).json({ results });
  } catch (e) {
    res.status(502).json({ error: String(e.message || e) });
  }
};
