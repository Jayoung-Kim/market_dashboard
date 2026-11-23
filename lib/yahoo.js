// Yahoo Finance 비공식 차트/검색 API 호출 도우미 (Vercel 서버리스 함수에서 사용)
const HOSTS = (process.env.YF_HOSTS || 'https://query1.finance.yahoo.com,https://query2.finance.yahoo.com').split(',');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const INTERVALS = { '1d': '5m', '5d': '30m', '1mo': '1d', '6mo': '1d', '1y': '1d', '5y': '1wk' };

const cache = new Map(); // 함수 인스턴스가 살아있는 동안만 유지되는 짧은 캐시

async function get(path, ttl) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.t < ttl * 1000) return hit.d;
  let lastErr;
  for (const host of HOSTS) {
    try {
      const r = await fetch(host.replace(/\/$/, '') + path, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
        signal: AbortSignal.timeout(9000),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json();
      cache.set(path, { t: Date.now(), d });
      return d;
    } catch (e) { lastErr = e; }
  }
  if (hit) return hit.d;
  throw lastErr;
}

async function chart(symbol, range, interval, ttl) {
  const q = new URLSearchParams({ range, interval, includePrePost: 'false' });
  const d = await get(`/v8/finance/chart/${encodeURIComponent(symbol)}?${q}`, ttl);
  const res = d?.chart?.result;
  if (!res || !res.length) throw new Error(d?.chart?.error?.description || 'no data');
  return res[0];
}

function points(r) {
  const ts = r.timestamp || [];
  const cl = r.indicators?.quote?.[0]?.close || [];
  const out = [];
  ts.forEach((t, i) => { if (cl[i] != null) out.push([t, cl[i]]); });
  return out;
}

async function build(symbol, range) {
  const interval = INTERVALS[range] || '1d';
  const ttl = range === '1d' || range === '5d' ? 30 : 120;
  const [main, daily] = await Promise.all([
    chart(symbol, range, interval, ttl),
    chart(symbol, '5d', '1d', 30).catch(() => null),
  ]);
  const meta = main.meta || {};
  const pts = points(main);

  // 전일 종가: 최근 5일 일봉에서 계산
  let prev = null;
  if (daily) {
    const dp = points(daily);
    const off = meta.gmtoffset || 0;
    const day = t => new Date((t + off) * 1000).toISOString().slice(0, 10);
    if (dp.length) {
      if (meta.regularMarketTime && day(dp[dp.length - 1][0]) === day(meta.regularMarketTime)) {
        prev = dp.length > 1 ? dp[dp.length - 2][1] : null;
      } else prev = dp[dp.length - 1][1];
    }
  }
  if (prev == null) prev = meta.previousClose ?? meta.chartPreviousClose ?? null;

  const tp = meta.currentTradingPeriod?.regular || {};
  return {
    symbol: meta.symbol || symbol,
    name: meta.shortName || meta.longName || symbol,
    currency: meta.currency,
    exchange: meta.fullExchangeName || meta.exchangeName,
    tz: meta.exchangeTimezoneName,
    type: meta.instrumentType,
    price: meta.regularMarketPrice ?? (pts.length ? pts[pts.length - 1][1] : null),
    prevClose: prev,
    dayHigh: meta.regularMarketDayHigh,
    dayLow: meta.regularMarketDayLow,
    high52: meta.fiftyTwoWeekHigh,
    low52: meta.fiftyTwoWeekLow,
    marketTime: meta.regularMarketTime,
    tradingStart: tp.start,
    tradingEnd: tp.end,
    ts: pts.map(p => p[0]),
    close: pts.map(p => p[1]),
  };
}

async function batch(symbols, range) {
  const out = {};
  await Promise.all(symbols.map(async s => {
    try { out[s] = await build(s, range); }
    catch (e) { out[s] = { symbol: s, error: String(e.message || e) }; }
  }));
  return out;
}

async function search(q) {
  const p = new URLSearchParams({ q, quotesCount: 8, newsCount: 0, listsCount: 0 });
  const d = await get('/v1/finance/search?' + p, 300);
  return (d.quotes || []).filter(i => i.symbol).map(i => ({
    symbol: i.symbol,
    name: i.shortname || i.longname || i.symbol,
    exchange: i.exchDisp || i.exchange,
    type: i.typeDisp || i.quoteType,
  }));
}

module.exports = { INTERVALS, batch, search };
