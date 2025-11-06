const db = require('../db');

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function ngrams(tokens, n = 2) {
  const out = [];
  for (let i = 0; i <= tokens.length - n; i++) out.push(tokens.slice(i, i + n).join(' '));
  return out;
}

function scoreRow(row, terms) {
  const fields = [
    row.qr_code, row.property_no, row.serial_no,
    row.article_type, row.category, row.brand,
    row.location, row.end_user,
    row.item_status, row.remarks,
    row.task_performed, row.notes
  ];
  const textTokens = tokenize(fields.filter(Boolean).join(' '));
  const bi = ngrams(textTokens, 2);
  const tri = ngrams(textTokens, 3);
  let score = 0;
  for (const t of terms) {
    if (textTokens.includes(t)) score += 3; // exact token
    if (bi.some(x => x.includes(t))) score += 2; // phrase overlap
    if (tri.some(x => x.includes(t))) score += 1; // longer phrase overlap
  }
  // Boost if qr_code or serial contains any term fragment
  const idText = String(row.qr_code || row.serial_no || '').toLowerCase();
  if (terms.some(t => idText.includes(t))) score += 2;
  return score;
}

async function query(sql, params = []) {
  return new Promise((resolve) => {
    db.query(sql, params, (err, rows) => {
      if (err) return resolve([]);
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

async function getRelevantContext(companyName, message, limit = 10) {
  const terms = tokenize(message).filter(w => w.length > 1).slice(0, 10);
  if (terms.length === 0) return { relevantItems: [], relevantLogs: [] };

  const [items, logs] = await Promise.all([
    query(`SELECT id, qr_code, property_no, serial_no, article_type, category, brand, item_status, location, end_user, remarks FROM items WHERE company_name = ? ORDER BY id DESC LIMIT 800`, [companyName]),
    query(`SELECT ml.id, ml.item_id, ml.maintenance_date, ml.task_performed, ml.status, ml.notes, i.qr_code, i.article_type, i.location, i.brand FROM maintenance_logs ml JOIN items i ON i.id = ml.item_id WHERE i.company_name = ? ORDER BY ml.id DESC LIMIT 800`, [companyName])
  ]);

  const scoredItems = items.map(r => ({ row: r, score: scoreRow(r, terms) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.row);

  const scoredLogs = logs.map(r => ({ row: r, score: scoreRow(r, terms) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.row);

  return { relevantItems: scoredItems, relevantLogs: scoredLogs };
}

async function getAdvancedContext(companyName, message, limits = { items: 12, logs: 12 }) {
  const baseCounts = await Promise.all([
    query(`SELECT article_type, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY article_type ORDER BY count DESC LIMIT 12`, [companyName]),
    query(`SELECT location, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY location ORDER BY count DESC LIMIT 12`, [companyName]),
    query(`SELECT item_status, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY item_status`, [companyName]),
    query(`SELECT id, qr_code, article_type, brand, item_status, location, remarks, created_at FROM items WHERE company_name = ? ORDER BY id DESC LIMIT 50`, [companyName])
  ]);
  const { relevantItems, relevantLogs } = await getRelevantContext(companyName, message, Math.max(limits.items, limits.logs));
  return {
    aggregates: {
      topTypes: baseCounts[0],
      topLocations: baseCounts[1],
      statusCounts: baseCounts[2]
    },
    recentItems: baseCounts[3],
    relevantItems,
    relevantLogs
  };
}

module.exports = { getRelevantContext, getAdvancedContext };


