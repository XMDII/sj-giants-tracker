// Vercel serverless function — proxies MLB Stats API
// Deployed at /api/mlb on your Vercel project

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });

  const allowed = [
    'schedule',
    'game/boxscore',
    'game/linescore',
    'teams',
  ];

  const isAllowed = allowed.some(e => endpoint.startsWith(e));
  if (!isAllowed) return res.status(403).json({ error: 'endpoint not allowed' });

  const qs = new URLSearchParams(params).toString();
  const url = `https://statsapi.mlb.com/api/v1/${endpoint}${qs ? '?' + qs : ''}`;

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'SJGiantsTracker/1.0' }
    });
    const data = await response.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
