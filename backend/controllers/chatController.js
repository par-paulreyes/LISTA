const db = require('../db');
const Item = require('../models/itemModel');

function extractQrCode(text) {
    const m = String(text || '').match(/[A-Z]{2,}-[A-Z]{2,}-\d{3,}|[A-Z]{2,}-[A-Z0-9]{2,}-\d{3,}|[A-Z]{2,}-[A-Z]{2,}\d{3,}|[A-Z]{2,}-[A-Z]{2,}-\d+/);
    return m ? m[0] : null;
}

function generateDefaultsForItem(companyName, payload) {
    const now = Date.now();
    const type = String(payload.article_type || 'Item').toUpperCase().replace(/\s+/g, '-');
    const company = String(companyName || 'DTC').toUpperCase().replace(/\s+/g, '');
    const ensure = (v, fallback) => (v && String(v).trim().length > 0 ? v : fallback);
    const qr_code = ensure(payload.qr_code, `${company}-${type}-${now.toString().slice(-6)}`);
    const property_no = ensure(payload.property_no, `${company}-PROP-${now.toString().slice(-6)}`);
    // Basic category inference from article_type
    const a = (payload.article_type || '').toLowerCase();
    let category = payload.category;
    if (!category) {
        if (['laptop','desktop computer','monitor','printer','mouse','keyboard','ups','avr'].some(t => a.includes(t))) category = 'Electronic';
        else if (a.includes('tool')) category = 'Tool';
        else if (a.includes('utility')) category = 'Utility';
        else if (a.includes('supply')) category = 'Supply';
    }
    return { qr_code, property_no, category };
}

function parseFieldUpdates(text) {
    const msg = String(text || '').toLowerCase();
    const updates = {};
    // location changes: "to DTC" / "location to HQ-3F" / "move ... to X"
    const locMatch = msg.match(/\b(location\s*(to|=)\s*|move\s+[^\n]*\s+to\s+)([a-z0-9\-\s]+)/i);
    if (locMatch && locMatch[3]) {
        updates.location = locMatch[3].trim().toUpperCase();
    }
    // status changes: "status to In Use"
    const statusMatch = msg.match(/\b(status\s*(to|=)\s*)([a-z\s]+)/i);
    if (statusMatch && statusMatch[3]) {
        updates.item_status = statusMatch[3].trim().replace(/\b\w/g, c => c.toUpperCase());
    }
    return updates;
}

function findItemIdByQr(companyName, qrCode) {
    return new Promise((resolve) => {
        if (!qrCode) return resolve(null);
        const sql = 'SELECT id FROM items WHERE company_name = ? AND qr_code = ? LIMIT 1';
        db.query(sql, [companyName, qrCode], (err, rows) => {
            if (err || !Array.isArray(rows) || rows.length === 0) return resolve(null);
            resolve(rows[0].id || null);
        });
    });
}

function extractFirstJsonObject(text) {
    if (!text) return null;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = text.slice(start, end + 1);
    try { return JSON.parse(candidate); } catch (_) { return null; }
}
function parseAddFields(text) {
    const msg = String(text || '');
    const lower = msg.toLowerCase();
    const out = {};
    // qr_code from pattern
    const qr = extractQrCode(msg);
    if (qr) out.qr_code = qr;
    // location: "at X" or "in X"
    const locMatch = lower.match(/\b(?:at|in)\s+([a-z0-9\-\s]{2,})/i);
    if (locMatch && locMatch[1]) out.location = locMatch[1].trim().toUpperCase();
    // status: "status to X" or "status X"
    const statusMatch = lower.match(/\bstatus\s*(?:to|=)?\s*([a-z\s]+)/i);
    if (statusMatch && statusMatch[1]) out.item_status = statusMatch[1].trim().replace(/\b\w/g, c => c.toUpperCase());
    // known types in message
    const typeMap = ['laptop','printer','desktop computer','monitor','mouse','keyboard','ups','avr','tool','utility','supply'];
    for (const t of typeMap) {
        if (lower.includes(t)) { out.article_type = t.replace(/\b\w/g, c => c.toUpperCase()); break; }
    }
    // brand: "brand X" or single Capitalized word before type
    const brandMatch = msg.match(/\bbrand\s+([A-Za-z0-9\- ]{2,})/);
    if (brandMatch && brandMatch[1]) out.brand = brandMatch[1].trim();
    else if (out.article_type) {
        const reg = new RegExp(`([A-Z][A-Za-z0-9\-]+)\s+${out.article_type.split(' ')[0]}`);
        const m = msg.match(reg);
        if (m && m[1]) out.brand = m[1];
    }
    return out;
}


function parseIntent(messageRaw) {
	const message = (messageRaw || '').trim().toLowerCase();
	if (!message) return { type: 'clarify', purpose: 'empty' };

	// Action intents
	if (/^add\b/.test(message)) return { type: 'action', action: 'add' };
	if (/^update\b/.test(message)) return { type: 'action', action: 'update' };
	if (/^delete\b|^remove\b/.test(message)) return { type: 'action', action: 'delete' };

	// Counts, availability
	if (/how many|count|available/.test(message)) {
		// Extract a simple noun (e.g., printers, laptops, mouse)
		const match = message.match(/how many\s+([^?\.\n]+)|count\s+([^?\.\n]+)|available\s+([^?\.\n]+)/);
		const rawTarget = (match && (match[1] || match[2] || match[3])) ? (match[1] || match[2] || match[3]) : '';
		const target = rawTarget.replace(/(are|is|do we have|in stock)/g, '').trim();
		return { type: 'query_count_available', target };
	}

	// General item type queries (show/list/find laptops, printers, etc.)
	const itemTypeKeywords = ['laptop', 'laptops', 'printer', 'printers', 'computer', 'computers', 'desktop', 'monitor', 'monitors', 'mouse', 'keyboard', 'keyboards', 'ups', 'avr', 'tablet', 'tablets'];
	const hasItemType = itemTypeKeywords.some(keyword => {
		const regex = new RegExp(`\\b${keyword}\\b`, 'i');
		return regex.test(message);
	});
	if (hasItemType) {
		if (/\b(show|list|find|search|get|display|see|view)\b/.test(message)) {
			// Extract the item type from the message
			const typeMatch = message.match(/\b(show|list|find|search|get|display|see|view)\s+([^?\.\n]+)/i);
			const rawTarget = typeMatch && typeMatch[2] ? typeMatch[2] : message.replace(/\b(show|list|find|search|get|display|see|view|all|my|the)\b/gi, '').trim();
			return { type: 'query_find_items', target: rawTarget };
		} else if (message.split(/\s+/).length <= 3) {
			// Simple queries like "laptops" or "show laptops" - treat as find query
			const cleaned = message.replace(/\b(show|list|find|search|get|display|see|view|all|my|the|me)\b/gi, '').trim();
			if (cleaned.length > 0) {
				return { type: 'query_find_items', target: cleaned };
			}
		}
	}

	// Maintenance
	if (/need(s)? servicing|need(s)? maintenance|over\s*6\s*months|due for maintenance|pending maintenance/.test(message)) {
		return { type: 'query_maintenance', scope: 'devices' };
	}

	// Summary queries - check this early to catch "summary" specifically
	const trimmedMsg = message.trim().toLowerCase();
	if (trimmedMsg === 'summary' || trimmedMsg === 'summarize' || trimmedMsg === 'overview' ||
		/\b(inventory\s+summary|inventory\s+status)\b/i.test(message) ||
		/^(show|give|get|provide)\s+(me\s+)?(a\s+)?(summary|overview)/i.test(message)) {
		return { type: 'query_summary' };
	}

	// Find/check/update/add inventory generic
	if (/\b(find|check|lookup|search)\b/.test(message)) {
		return { type: 'clarify', purpose: 'find' };
	}

	return { type: 'clarify', purpose: 'general' };
}

function normalizeTargetToPatterns(targetRaw) {
	const target = (targetRaw || '').toLowerCase().trim();
	if (!target) return [];
	// Map some common synonyms
	const map = {
		printer: ['printer', 'printers'],
		laptop: ['laptop', 'laptops', 'notebook', 'notebooks'],
		computer: ['computer', 'computers', 'desktop', 'pc', 'pcs', 'system unit'],
		mouse: ['mouse', 'mice'],
		keyboard: ['keyboard', 'keyboards'],
		monitor: ['monitor', 'monitors'],
		ups: ['ups', 'avr']
	};
	for (const key of Object.keys(map)) {
		if (map[key].some(w => target.includes(w))) return map[key];
	}
	// Fallback: split words
	return target.split(/\s+/).filter(Boolean);
}

const { generateGuidedResponse } = require('../services/gemini');
const { planAction } = require('../services/geminiPlanner');
const MaintenanceLog = require('../models/maintenanceLogModel');
const { getKnowledgeSnapshot, getRichContext, getForecast } = require('../services/knowledge');
const { getRelevantContext, getAdvancedContext } = require('../services/semantic');

exports.chat = async (req, res) => {
	const companyName = req.user?.company_name;
	let message = req.body?.message;
    const history = Array.isArray(req.body?.history) ? req.body.history : [];
    
    // Input validation and sanitization
    if (!message || typeof message !== 'string') {
        return res.status(400).json({ type: 'error', message: 'Message is required and must be a string.' });
    }
    
    // Sanitize and validate message
    message = String(message).trim();
    if (message.length === 0) {
        return res.status(400).json({ type: 'error', message: 'Message cannot be empty.' });
    }
    if (message.length > 1000) {
        return res.status(400).json({ type: 'error', message: 'Message is too long. Please keep it under 1000 characters.' });
    }
    const historyText = (() => {
        try {
            const last = history.slice(-8).map((h) => {
                const r = (h.role || '').toLowerCase();
                const t = String(h.text || '').trim();
                if (!t) return null;
                return `${r === 'user' ? 'User' : 'Assistant'}: ${t}`;
            }).filter(Boolean).join('\n');
            return last ? `History:\n${last}\n` : '';
        } catch { return ''; }
    })();
	if (!companyName) {
		return res.status(401).json({ type: 'error', message: "You're not authenticated. Please log in." });
	}

	// Lightweight greetings handler
	const msg = (message || '').trim().toLowerCase();
	if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|yo|greetings)[!,.\s]*$/i.test((message || '').trim())) {
		return res.json({
			type: 'answer',
			message: 'Hi. How can I help with inventory or maintenance today?'
		});
	}

	// Parse intent after greetings check
	const intent = parseIntent(message);

		// Quick live insights using knowledge snapshot
        if (/\b(insights|stats|statistics|snapshot)\b/.test(msg)) {
			try {
				const k = await getKnowledgeSnapshot(companyName);
				const cats = (k.categories || []).slice(0, 5).map(c => `${c.category || 'Unspecified'}: ${c.count}`).join(', ') || 'n/a';
				const types = (k.articleTypes || []).slice(0, 5).map(t => `${t.article_type || 'Unspecified'}: ${t.count}`).join(', ') || 'n/a';
				const statuses = (k.itemStatuses || []).map(s => `${s.item_status || 'Unknown'}: ${s.count}`).join(', ') || 'n/a';
				const msgLines = [
					'Inventory insights:',
                    `- Total items: ${typeof k.totalItems === 'number' ? k.totalItems : 'N/A'}`,
					`- Top categories: ${cats}`,
					`- Top types: ${types}`,
					`- Status counts: ${statuses}`,
					`- Due ≤30 days: ${k.upcomingMaintenanceWithin30Days || 0}`,
					`- Pending maintenance tasks: ${k.pendingMaintenanceTasks || 0}`
				].join('\n');
				return res.json({ type: 'answer', message: msgLines });
			} catch (_e) {
				return res.status(500).json({ type: 'error', message: 'Failed to load insights.' });
			}
		}

        // Quick logs helper
        if (/\b(logs|maintenance\s*logs|recent\s*logs)\b/.test(msg)) {
            try {
                await new Promise((resolve) => {
                    const sql = `SELECT ml.id, ml.item_id, ml.maintenance_date, ml.task_performed, ml.status, ml.maintained_by, i.qr_code, i.article_type, i.location FROM maintenance_logs ml JOIN items i ON i.id = ml.item_id WHERE i.company_name = ? ORDER BY ml.created_at DESC LIMIT 20`;
                    db.query(sql, [companyName], (err, rows) => {
                        if (err) { res.status(500).json({ type: 'error', message: 'Failed to load logs.' }); return resolve(); }
                        const data = (rows || []).map(r => ({
                            id: r.id,
                            qr_code: r.qr_code,
                            article_type: r.article_type,
                            last_status: r.status,
                            location: r.location || '-',
                            task: r.task_performed,
                            date: r.maintenance_date
                        }));
                        res.json({ type: 'answer', message: `Showing latest ${data.length} log(s).`, data });
                        resolve();
                    });
                });
                return;
            } catch (_) {}
        }

        // Statistical queries (average, mean, per location, etc.)
        if (/\b(average|mean|avg|statistics?|stats?)\b/i.test(msg)) {
            try {
                if (/\b(per|by)\s+(location|locations)\b/i.test(msg)) {
                    // Average items per location (include unspecified locations)
                    await new Promise((resolve) => {
                        const sql = `
                            SELECT COALESCE(NULLIF(TRIM(location), ''), 'Unspecified') AS loc, COUNT(*) AS count
                            FROM items
                            WHERE company_name = ?
                            GROUP BY loc
                        `;
                        db.query(sql, [companyName], (err, rows) => {
                            if (err) { res.status(500).json({ type: 'error', message: 'Failed to calculate average.' }); return resolve(); }
                            if (!Array.isArray(rows) || rows.length === 0) {
                                res.json({ type: 'answer', message: 'No items with locations found.' });
                                return resolve();
                            }
                            const totalItems = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
                            const numLocations = rows.length;
                            const avg = numLocations > 0 ? (totalItems / numLocations).toFixed(2) : 0;
                            const data = rows.map(r => ({ location: r.loc, count: Number(r.count) || 0 }));
                            res.json({ 
                                type: 'answer', 
                                message: `Average items per location: ${avg} (${totalItems} items across ${numLocations} locations).`,
                                data 
                            });
                            resolve();
                        });
                    });
                    return;
                }
                if (/\b(per|by)\s+(category|categories|type|types|article)\b/i.test(msg)) {
                    // Average items per category/type
                    await new Promise((resolve) => {
                        const sql = `SELECT category, article_type, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY category, article_type`;
                        db.query(sql, [companyName], (err, rows) => {
                            if (err) { res.status(500).json({ type: 'error', message: 'Failed to calculate average.' }); return resolve(); }
                            if (!Array.isArray(rows) || rows.length === 0) {
                                res.json({ type: 'answer', message: 'No items found.' });
                                return resolve();
                            }
                            const totalItems = rows.reduce((sum, r) => sum + (Number(r.count) || 0), 0);
                            const numGroups = rows.length;
                            const avg = numGroups > 0 ? (totalItems / numGroups).toFixed(2) : 0;
                            const data = rows.map(r => ({ 
                                category: r.category || '-', 
                                article_type: r.article_type || '-', 
                                count: Number(r.count) || 0 
                            }));
                            res.json({ 
                                type: 'answer', 
                                message: `Average items per category/type: ${avg} (${totalItems} items across ${numGroups} groups).`,
                                data 
                            });
                            resolve();
                        });
                    });
                    return;
                }
                // Generic average - use Gemini with context
                if (process.env.GEMINI_API_KEY && req.body?.useGemini !== false) {
                    try {
                        const knowledge = await getRichContext(companyName);
                        const semantic = await getRelevantContext(companyName, message, 8);
                        const tip = await generateGuidedResponse(
                            `User: ${message}\nCalculate and provide the requested average/statistic using the provided data context.`,
                            { userRole: req.user?.role, dataContext: { ...knowledge, ...semantic }, enforceNumbersFromContext: true }
                        );
                        return res.json({ type: 'answer', message: tip });
                    } catch (_) {}
                }
                return res.json({ type: 'clarify', message: 'Please specify what average you need (e.g., "average items per location", "average per category").' });
            } catch (_) {
                return res.status(500).json({ type: 'error', message: 'Failed to process statistical query.' });
            }
        }

        // Quick forecast/prediction helper
        if (/(predict|forecast|trend|projection)s?/i.test(msg)) {
            try {
                const f = await getForecast(companyName);
                const lines = [
                    '📊 Advanced Forecast Analysis',
                    '',
                    'Next Month:',
                    `- New items (${f.forecast.itemsModel}, confidence: ${Math.round(f.forecast.itemsConfidence)}%): ${f.forecast.nextMonthNewItems}`,
                ];
                if (f.forecast.nextMonthNewItemsPI) {
                    lines.push(`  Prediction interval: ${f.forecast.nextMonthNewItemsPI.lower}–${f.forecast.nextMonthNewItemsPI.upper}`);
                }
                if (f.forecast.itemsAccuracy) {
                    lines.push(`  Accuracy: MAPE ${f.forecast.itemsAccuracy.mape.toFixed(1)}%, RMSE ${f.forecast.itemsAccuracy.rmse.toFixed(1)}`);
                }
                lines.push(`- Maintenance tasks (${f.forecast.logsModel}, confidence: ${Math.round(f.forecast.logsConfidence)}%): ${f.forecast.nextMonthMaintenanceTasks}`);
                if (f.forecast.nextMonthMaintenanceTasksPI) {
                    lines.push(`  Prediction interval: ${f.forecast.nextMonthMaintenanceTasksPI.lower}–${f.forecast.nextMonthMaintenanceTasksPI.upper}`);
                }
                if (f.forecast.logsAccuracy) {
                    lines.push(`  Accuracy: MAPE ${f.forecast.logsAccuracy.mape.toFixed(1)}%, RMSE ${f.forecast.logsAccuracy.rmse.toFixed(1)}`);
                }
                lines.push('');
                lines.push('Multi-Period Forecast:');
                f.forecast.itemsForecasts.forEach(fc => {
                    lines.push(`- Items (${fc.period} months): ${fc.forecast} [${fc.lower}–${fc.upper}]`);
                });
                f.forecast.logsForecasts.forEach(fc => {
                    lines.push(`- Maintenance (${fc.period} months): ${fc.forecast} [${fc.lower}–${fc.upper}]`);
                });
                lines.push('');
                lines.push('Trend Analysis:');
                lines.push(`- Items: ${f.forecast.itemsTrendDirection} (${f.forecast.itemsTrend > 0 ? '+' : ''}${f.forecast.itemsTrend.toFixed(2)} per month)`);
                lines.push(`- Maintenance: ${f.forecast.logsTrendDirection} (${f.forecast.logsTrend > 0 ? '+' : ''}${f.forecast.logsTrend.toFixed(2)} per month)`);
                return res.json({ type: 'answer', message: lines.join('\n'), data: f.itemsByMonth.slice(-6) });
            } catch (_) {
                return res.status(500).json({ type: 'error', message: 'Failed to compute forecast.' });
            }
        }

        // Quick report/export helper
		if (/\b(report|export)\b/.test(msg)) {
			return res.json({
				type: 'answer',
				message: [
					'Pick a report:',
					'- Summary (Chat): ask "Summarize inventory status"',
					'- Inventory (CSV): GET /api/items/export?format=csv',
					'- Inventory (Excel): GET /api/items/export?format=excel',
					'- Inventory (PDF): GET /api/items/export?format=pdf',
					'- Maintenance Logs (CSV): GET /api/logs/export?format=csv',
					'- Maintenance Logs (PDF): GET /api/logs/export?format=pdf'
				].join('\n')
			});
		}

	try {
		// Debug: log intent for troubleshooting
		if (process.env.NODE_ENV !== 'production') {
			console.log('Chat intent:', intent.type, 'for message:', message.substring(0, 50));
		}
		
		switch (intent.type) {
			case 'query_summary': {
				// Handle summary requests
				try {
					const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';
					let dataContext = await getRichContext(companyName);
					if (isAdmin && !(req.body?.rich)) {
						// Include a small recent items snapshot for admins
						const sql = `SELECT id, qr_code, article_type, item_status, location, created_at FROM items WHERE company_name = ? ORDER BY id DESC LIMIT 30`;
						await new Promise((resolve) => {
							db.query(sql, [companyName], (err, rows) => {
								if (!err && Array.isArray(rows)) {
									dataContext = { ...dataContext, recentItems: rows };
								}
								resolve();
							});
						});
					}
					// Helper to build a server-side concise summary
					const buildServerSummary = () => {
						const totalByCategory = (dataContext.categories || []).map(c => `${c.category || 'Unspecified'}: ${c.count}`).slice(0, 5).join(', ');
						const topTypes = (dataContext.articleTypes || []).map(t => `${t.article_type || 'Unspecified'}: ${t.count}`).slice(0, 5).join(', ');
						const statusLine = (dataContext.itemStatuses || []).map(s => `${s.item_status || 'Unknown'}: ${s.count}`).join(', ');
						return [
							'📊 Inventory Summary:',
							`- Total items: ${typeof dataContext.totalItems === 'number' ? dataContext.totalItems : 'N/A'}`,
							`- Top categories: ${totalByCategory || 'n/a'}`,
							`- Top types: ${topTypes || 'n/a'}`,
							`- Status counts: ${statusLine || 'n/a'}`,
							`- Due ≤30 days: ${dataContext.upcomingMaintenanceWithin30Days || 0}`,
							`- Pending maintenance tasks: ${dataContext.pendingMaintenanceTasks || 0}`
						].join('\n');
					};

					// If Gemini is not configured, return server summary
					if (!process.env.GEMINI_API_KEY) {
						return res.json({ type: 'answer', message: buildServerSummary() });
					}

					// Try Gemini; on failure, fall back to server summary
					try {
						const tip = await generateGuidedResponse(
							`${historyText}Summarize the current inventory and maintenance status for this company. Be concise and actionable.`,
							{ userRole: req.user?.role, dataContext, enforceNumbersFromContext: true }
						);
						return res.json({ type: 'answer', message: tip });
					} catch (_gemErr) {
						return res.json({ type: 'answer', message: buildServerSummary() });
					}
				} catch (_e) {
					// Last-resort fallback
					return res.json({ type: 'answer', message: 'Summary not available right now. Try again shortly.' });
				}
			}
			case 'query_find_items': {
				// Find items by type (e.g., "show laptops", "list printers")
				const patterns = normalizeTargetToPatterns(intent.target);
				if (patterns.length === 0) {
					return res.json({ type: 'clarify', message: 'Which item type should I find?' });
				}
				// Search in article_type, category, and also check for common variations
				const likeClauses = patterns.map(() => "(LOWER(article_type) LIKE ? OR LOWER(category) LIKE ? OR LOWER(brand) LIKE ?)").join(' OR ');
				const likeParams = patterns.flatMap(p => [`%${p}%`, `%${p}%`, `%${p}%`]);
				const sql = `SELECT id, qr_code, article_type, category, item_status, location, brand FROM items WHERE company_name = ? AND (${likeClauses}) ORDER BY id DESC LIMIT 50`;
				const params = [companyName, ...likeParams];
				await new Promise((resolve, reject) => {
					db.query(sql, params, (err, rows) => {
						if (err) {
							console.error('Error finding items:', err);
							return reject(err);
						}
						const data = Array.isArray(rows) ? rows.map(r => ({ 
							id: r.id, 
							qr_code: r.qr_code, 
							article_type: r.article_type || '-', 
							category: r.category || '-',
							brand: r.brand || '-',
							last_status: r.item_status || '-', 
							location: r.location || '-' 
						})) : [];
						if (data.length === 0) {
							return res.json({ type: 'answer', message: `No items found matching "${intent.target}". Try checking the spelling or use a different search term.` });
						}
						return res.json({ type: 'answer', message: `Found ${data.length} item(s) matching "${intent.target}":`, data });
					});
				});
				return; // response sent inside query
			}
			case 'query_count_available': {
				const patterns = normalizeTargetToPatterns(intent.target);
				if (patterns.length === 0) {
					return res.json({ type: 'clarify', message: 'Which item type should I count?' });
				}
				// Count items by article_type or category containing any pattern and item_status Available
				// Use LOWER() for case-insensitive comparison
				const likeClauses = patterns.map(() => "(LOWER(article_type) LIKE ? OR LOWER(category) LIKE ?)").join(' OR ');
				const likeParams = patterns.flatMap(p => [`%${p}%`, `%${p}%`]);
				const sql = `SELECT COUNT(*) AS count FROM items WHERE company_name = ? AND (${likeClauses}) AND (LOWER(TRIM(item_status)) = 'available')`;
				const params = [companyName, ...likeParams];
				await new Promise((resolve, reject) => {
					db.query(sql, params, (err, rows) => {
						if (err) {
							console.error('Error counting items:', err);
							return reject(err);
						}
						const count = rows?.[0]?.count || 0;
						return res.json({ type: 'answer', message: `You have ${count} ${intent.target || 'items'} available.` });
					});
				});
				return; // response sent inside query
			}
			case 'query_maintenance': {
				// Use existing helper to fetch items needing maintenance
				Item.findItemsNeedingMaintenance(companyName, (err, items) => {
					if (err) return res.status(500).json({ type: 'error', message: 'Failed to fetch maintenance data.' });
					if (!items || items.length === 0) return res.json({ type: 'answer', message: 'No devices currently flagged for maintenance.' });
					const shortlist = items.slice(0, 10).map(it => ({ id: it.id, qr_code: it.qr_code, article_type: it.article_type, last_status: it.system_status }));
					return res.json({ type: 'answer', message: `Devices needing attention: ${items.length}. Showing up to 10.`, data: shortlist });
				});
				return;
			}
			case 'action': {
				const action = intent.action;
                if (action === 'add') {
                    const json = extractFirstJsonObject(message) || {};
                    const inferred = parseAddFields(message);
                    const payload = { ...inferred, ...json };
                    // Default status to Available if not provided
                    if (!payload.item_status) payload.item_status = 'Available';
                    const missing = [];
                    if (!payload.article_type) missing.push('article_type');
                    if (!payload.qr_code) missing.push('qr_code');
                    if (!payload.property_no) missing.push('property_no');
                    // Suggest next step with an example payload
                    if (missing.length > 0) {
                        return res.json({
                            type: 'clarify',
                            message: `Missing required field(s): ${missing.join(', ')}. Provide a payload or say add <brand> <type> at <location>.`,
                            data: [{ example: { qr_code: 'COMP-ITEM-000001', property_no: 'COMP-PROP-000001', article_type: 'Laptop', brand: 'Dell', location: 'HQ' } }]
                        });
                    }
                    // Ask for confirm before adding
                    if (!req.body?.confirm) {
                        return res.json({ type: 'plan', message: 'I can add this item. Reply with confirm: true to proceed.', plan: { action: 'addItem', params: { qr_code: payload.qr_code, property_no: payload.property_no, article_type: payload.article_type, brand: payload.brand, item_status: payload.item_status, location: payload.location } } });
                    }
                    const data = { qr_code: payload.qr_code, property_no: payload.property_no, article_type: payload.article_type, brand: payload.brand, item_status: payload.item_status, location: payload.location, company_name: companyName };
                    await new Promise((resolve) => {
                        db.query('INSERT INTO items SET ?', data, (err, result) => {
                            if (err) { res.status(500).json({ type: 'error', message: 'Failed to add item.' }); return resolve(); }
                            res.json({ type: 'answer', message: `Item created with ID ${result.insertId}.` });
                            resolve();
                        });
                    });
                    return;
                }
                if (action === 'update') {
                    const json = extractFirstJsonObject(message) || {};
                    let id = Number(json.id);
                    let update = (json.update && typeof json.update === 'object') ? json.update : {};
                    if (!id) {
                        const qr = json.qr_code || extractQrCode(message);
                        id = await findItemIdByQr(companyName, qr);
                    }
                    // Try to infer updates from natural language
                    const inferred = parseFieldUpdates(message);
                    update = { ...inferred, ...update };
                    if (!id || !Object.keys(update).length) {
                        return res.json({ type: 'clarify', message: 'Provide { id or qr_code, update/location/status }.' });
                    }
                    await new Promise((resolve) => {
                        Item.update(id, update, (err) => {
                            if (err) { res.status(500).json({ type: 'error', message: 'Failed to update item.' }); return resolve(); }
                            res.json({ type: 'answer', message: 'Item updated.' });
                            resolve();
                        });
                    });
                    return;
                }
                if (action === 'delete') {
                    const json = extractFirstJsonObject(message) || {};
                    let id = Number(json.id);
                    if (!id) {
                        const qr = json.qr_code || extractQrCode(message);
                        id = await findItemIdByQr(companyName, qr);
                    }
                    if (!id) return res.json({ type: 'clarify', message: 'Provide { id } or a valid QR code to delete.' });
                    await new Promise((resolve) => {
                        Item.delete(id, (err) => {
                            if (err) { res.status(500).json({ type: 'error', message: 'Failed to delete item.' }); return resolve(); }
                            res.json({ type: 'answer', message: 'Item deleted.' });
                            resolve();
                        });
                    });
                    return;
                }
                return res.json({ type: 'clarify', message: 'Do you want to add, update, or delete an item?' });
			}
            case 'clarify': {
                if (intent.purpose === 'find') {
                    // Try to extract a target after keywords; otherwise default to latest items
                    const match = (message || '').match(/\b(find|search|lookup|check)\s+([^\n\r\t]+)$/i);
                    const rawTarget = match && match[2] ? match[2] : (message || '').replace(/\b(find|search|lookup|check)\b/gi, '').trim();
                    const patterns = normalizeTargetToPatterns(rawTarget);
                    if (!patterns.length) {
                        const sql = `SELECT id, qr_code, article_type, item_status, location FROM items WHERE company_name = ? ORDER BY id DESC LIMIT 10`;
                        await new Promise((resolve) => {
                            db.query(sql, [companyName], (err, rows) => {
                                if (err) { res.status(500).json({ type: 'error', message: 'Failed to load items.' }); return resolve(); }
                                const data = Array.isArray(rows) ? rows.map(r => ({ id: r.id, qr_code: r.qr_code, article_type: r.article_type, last_status: r.item_status || '-', location: r.location || '-' })) : [];
                                res.json({ type: 'answer', message: `Showing latest ${data.length} item(s).`, data });
                                resolve();
                            });
                        });
                        return;
                    }
                    const likeClauses = patterns.map(() => "(LOWER(article_type) LIKE ? OR LOWER(category) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(qr_code) LIKE ?)").join(' OR ');
                    const likeParams = patterns.flatMap(p => [`%${p}%`, `%${p}%`, `%${p}%`, `%${p}%`]);
                    const sql = `SELECT id, qr_code, article_type, category, item_status, location, brand FROM items WHERE company_name = ? AND (${likeClauses}) ORDER BY id DESC LIMIT 50`;
                    const params = [companyName, ...likeParams];
                    await new Promise((resolve) => {
                        db.query(sql, params, (err, rows) => {
                            if (err) { 
                                console.error('Error searching items:', err);
                                res.status(500).json({ type: 'error', message: 'Failed to search items.' }); 
                                return resolve(); 
                            }
                            const data = Array.isArray(rows) ? rows.map(r => ({ 
                                id: r.id, 
                                qr_code: r.qr_code, 
                                article_type: r.article_type || '-', 
                                category: r.category || '-',
                                brand: r.brand || '-',
                                last_status: r.item_status || '-', 
                                location: r.location || '-' 
                            })) : [];
                            const label = rawTarget ? `for "${rawTarget}"` : '';
                            if (data.length === 0) {
                                res.json({ type: 'answer', message: `No items found ${label}. Try a different search term.` });
                            } else {
                                res.json({ type: 'answer', message: `Found ${data.length} item(s) ${label}.`, data });
                            }
                            resolve();
                        });
                    });
                    return;
                }
                // Try advanced planner for complex tasks - but also try Gemini for general queries
                if (process.env.GEMINI_API_KEY && req.body?.useGemini !== false) {
                    try {
                        // First try Gemini for a direct helpful response
                        const advanced = await getAdvancedContext(companyName, message, { items: 12, logs: 12 });
                        const geminiResponse = await generateGuidedResponse(
                            `${historyText}User: ${message}\nYou are an inventory management assistant. If the query is unclear or general, provide helpful guidance on what you can do. Otherwise, respond directly to the query. Be friendly and actionable.`,
                            { userRole: req.user?.role, dataContext: advanced, enforceNumbersFromContext: true }
                        );
                        // If Gemini gives a good response, use it
                        if (geminiResponse && geminiResponse.length > 20) {
                            return res.json({ type: 'answer', message: geminiResponse });
                        }
                    } catch (_) {
                        // Continue to planner if Gemini fails
                    }
                    
                    try {
                        const plan = await planAction(`${historyText}User: ${message}`, { company_name: companyName });
                        // If action is risky and not confirmed, return plan preview
                        const risky = ['addItem','updateItem','deleteItem'].includes(plan.action);
                        if (risky && !req.body?.confirm) {
                            return res.json({ type: 'plan', message: 'I can perform this action. Reply with confirm: true to proceed.', plan });
                        }
                        // Execute supported actions
                        if (plan.action === 'countAvailable') {
                            const patterns = normalizeTargetToPatterns(plan.params?.target || '');
                            if (patterns.length === 0) return res.json({ type: 'clarify', message: 'Which item type should I count?' });
                            const likeClauses = patterns.map(() => "(LOWER(article_type) LIKE ? OR LOWER(category) LIKE ?)").join(' OR ');
                            const likeParams = patterns.flatMap(p => [`%${p}%`, `%${p}%`]);
                            const sql = `SELECT COUNT(*) AS count FROM items WHERE company_name = ? AND (${likeClauses}) AND (LOWER(item_status) = 'available')`;
                            const params = [companyName, ...likeParams];
                            await new Promise((resolve) => {
                                db.query(sql, params, (err, rows) => {
                                    if (err) { res.status(500).json({ type: 'error', message: 'Failed to count items.' }); return resolve(); }
                                    const count = rows?.[0]?.count || 0;
                                    res.json({ type: 'answer', message: `You have ${count} ${plan.params?.target || 'items'} available.` });
                                    resolve();
                                });
                            });
                            return;
                        }
                        if (plan.action === 'itemsNeedingMaintenance') {
                            return Item.findItemsNeedingMaintenance(companyName, (err, items) => {
                                if (err) return res.status(500).json({ type: 'error', message: 'Failed to fetch maintenance data.' });
                                if (!items || items.length === 0) return res.json({ type: 'answer', message: 'No devices currently flagged for maintenance.' });
                                const shortlist = items.slice(0, 10).map(it => ({ id: it.id, qr_code: it.qr_code, article_type: it.article_type, last_status: it.system_status }));
                                return res.json({ type: 'answer', message: `Devices needing attention: ${items.length}. Showing up to 10.`, data: shortlist });
                            });
                        }
                        if (plan.action === 'addItem') {
                            const params = plan.params || {};
                            const payload = { ...parseAddFields(message), ...params };
                            // Default status to Available if not provided
                            if (!payload.item_status) payload.item_status = 'Available';
                            const missing = [];
                            if (!payload.article_type) missing.push('article_type');
                            if (!payload.qr_code) missing.push('qr_code');
                            if (!payload.property_no) missing.push('property_no');
                            if (missing.length > 0) {
                                return res.json({ type: 'clarify', message: `Missing required field(s): ${missing.join(', ')}. Provide them to proceed.` });
                            }
                            if (!req.body?.confirm) return res.json({ type: 'plan', message: 'I can add this item. Reply with confirm: true to proceed.', plan });
                            const data = { qr_code: payload.qr_code, property_no: payload.property_no, article_type: payload.article_type, brand: payload.brand, item_status: payload.item_status, location: payload.location, company_name: companyName };
                            await new Promise((resolve) => {
                                db.query('INSERT INTO items SET ?', data, (err, result) => {
                                    if (err) { res.status(500).json({ type: 'error', message: 'Failed to add item.' }); return resolve(); }
                                    res.json({ type: 'answer', message: `Item created with ID ${result.insertId}.` });
                                    resolve();
                                });
                            });
                            return;
                        }
                        if (plan.action === 'updateItem') {
                            if (!req.body?.confirm) return res.json({ type: 'plan', message: 'Provide confirm: true to update.', plan });
                            let id = Number(plan.params?.id);
                            let update = plan.params?.update || {};
                            if (!id) {
                                const qr = plan.params?.qr_code || extractQrCode(message);
                                id = await findItemIdByQr(companyName, qr);
                            }
                            // Infer updates from the original message if needed
                            if (!Object.keys(update).length) {
                                update = parseFieldUpdates(message);
                            }
                            if (!id || !Object.keys(update).length) return res.json({ type: 'clarify', message: 'Provide item id/qr_code and fields to update.' });
                            return Item.update(id, update, (err) => {
                                if (err) return res.status(500).json({ type: 'error', message: 'Failed to update item.' });
                                return res.json({ type: 'answer', message: 'Item updated.' });
                            });
                        }
                        if (plan.action === 'deleteItem') {
                            if (!req.body?.confirm) return res.json({ type: 'plan', message: 'Provide confirm: true to delete.', plan });
                            let id = Number(plan.params?.id);
                            if (!id) {
                                const qr = plan.params?.qr_code || extractQrCode(message);
                                id = await findItemIdByQr(companyName, qr);
                            }
                            if (!id) return res.json({ type: 'clarify', message: 'Provide item id or qr_code to delete.' });
                            return Item.delete(id, (err) => {
                                if (err) return res.status(500).json({ type: 'error', message: 'Failed to delete item.' });
                                return res.json({ type: 'answer', message: 'Item deleted.' });
                            });
                        }
                        if (plan.action === 'summarize') {
                            // Provide rich counts and context to avoid misleading totals
                            const dataContext = await getRichContext(companyName);
                            const tip = await generateGuidedResponse(
                                plan.params?.topic || 'Provide a brief inventory summary.',
                                { userRole: req.user?.role, dataContext, enforceNumbersFromContext: true }
                            );
                            return res.json({ type: 'answer', message: tip });
                        }
                        if (plan.action === 'troubleshoot') {
                            // Return steps and suggested payload without executing
                            const steps = plan.params?.steps || plan.params?.instructions || [];
                            const suggested = plan.params?.suggested || null;
                            return res.json({ type: 'answer', message: [
                                'Suggested troubleshooting steps:',
                                ...[].concat(steps || []).map((s, i) => `- ${typeof s === 'string' ? s : JSON.stringify(s)}`),
                                suggested ? '\nSuggested maintenance payload (review and confirm to proceed):' : ''
                            ].filter(Boolean).join('\n'), data: suggested ? [suggested] : undefined });
                        }
                        if (plan.action === 'createMaintenanceTasks') {
                            const itemId = Number(plan.params?.item_id);
                            const tasks = Array.isArray(plan.params?.tasks) ? plan.params.tasks : [];
                            if (!itemId || tasks.length === 0) return res.json({ type: 'clarify', message: 'Provide item_id and at least one task.' });
                            if (!req.body?.confirm) {
                                return res.json({ type: 'plan', message: 'I can create these maintenance tasks. Reply with confirm: true to proceed.', plan });
                            }
                            const maintainedBy = req.user?.username || 'system';
                            const dateToday = new Date().toISOString().split('T')[0];
                            const inserts = tasks.map((t) => new Promise((resolve, reject) => {
                                const maintenanceLog = {
                                    item_id: itemId,
                                    maintenance_date: t.maintenance_date || dateToday,
                                    task_performed: t.task || String(t || ''),
                                    maintained_by: maintainedBy,
                                    notes: t.notes || '',
                                    status: t.completed ? 'completed' : 'pending'
                                };
                                MaintenanceLog.create(maintenanceLog, (err) => {
                                    if (err) return reject(err);
                                    resolve(true);
                                });
                            }));
                            try {
                                await Promise.all(inserts);
                                return res.json({ type: 'answer', message: `Created ${tasks.length} maintenance task(s).` });
                            } catch (_e) {
                                return res.status(500).json({ type: 'error', message: 'Failed to create maintenance tasks.' });
                            }
                        }
                        // Unknown action: guidance only
                        const advanced = await getAdvancedContext(companyName, message, { items: 12, logs: 12 });
                        const tip = await generateGuidedResponse(
                            `${historyText}User: ${message}\nRespond with brief, actionable guidance based on the behavior guidelines. Use the provided context.`,
                            { userRole: req.user?.role, dataContext: advanced, enforceNumbersFromContext: true }
                        );
                        return res.json({ type: 'clarify', message: tip });
                    } catch (_) {
                        // fall back
                    }
                }
                // If Gemini is available, try it before giving generic clarify message
                if (process.env.GEMINI_API_KEY && req.body?.useGemini !== false) {
                    try {
                        const advanced = await getAdvancedContext(companyName, message, { items: 12, logs: 12 });
                        const geminiResponse = await generateGuidedResponse(
                            `${historyText}User: ${message}\nYou are an inventory management assistant. The user's query is unclear. Provide helpful, friendly guidance on what you can help with. Suggest specific examples like finding items, checking status, maintenance, or adding items.`,
                            { userRole: req.user?.role, dataContext: advanced, enforceNumbersFromContext: true }
                        );
                        if (geminiResponse && geminiResponse.length > 20) {
                            return res.json({ type: 'answer', message: geminiResponse });
                        }
                    } catch (_) {
                        // Fall through to generic message
                    }
                }
                return res.json({ type: 'answer', message: 'I can help you with:\n• Finding items: "show laptops", "find printers"\n• Inventory status: "summary", "how many items"\n• Maintenance: "items due for maintenance"\n• Adding/updating items\n• Exporting reports\n\nWhat would you like to do?' });
            }
            default: {
                // Always try Gemini first for general/unclear requests
                if (process.env.GEMINI_API_KEY && req.body?.useGemini !== false) {
                    try {
                        // Use advanced context (aggregates + relevant items/logs)
                        const advanced = await getAdvancedContext(companyName, message, { items: 12, logs: 12 });
                        const tip = await generateGuidedResponse(
                            `${historyText}User: ${message}\nYou are an inventory management assistant. Respond helpfully and suggest what you can do. If the query is unclear, provide friendly guidance on available features like finding items, checking status, maintenance, or adding items. Be concise and actionable.`,
                            { userRole: req.user?.role, dataContext: advanced, enforceNumbersFromContext: true }
                        );
                        return res.json({ type: 'answer', message: tip });
                    } catch (geminiErr) {
                        console.error('Gemini fallback error:', geminiErr);
                        // Continue to other fallbacks
                    }
                }
                // As a second step, try to surface relevant items/logs directly from database
                try {
                    const { relevantItems } = await getRelevantContext(companyName, message, 10);
                    if (Array.isArray(relevantItems) && relevantItems.length > 0) {
                        const data = relevantItems.map(r => ({ id: r.id, qr_code: r.qr_code, article_type: r.article_type, last_status: r.item_status || '-', location: r.location || '-' }));
                        return res.json({ type: 'answer', message: `Found ${data.length} relevant item(s).`, data });
                    }
                } catch (_) {}
                // Last resort: provide helpful suggestions instead of "I'm not sure"
                const suggestions = [
                    'I can help you with:',
                    '• Finding items: "show laptops", "find printers", "list monitors"',
                    '• Inventory status: "summary", "how many items", "inventory insights"',
                    '• Maintenance: "items due for maintenance", "pending maintenance"',
                    '• Adding items: "add laptop" or provide item details',
                    '• Updates: "update item 123 location to HQ-3F"',
                    '• Reports: "export inventory", "show logs"',
                    '',
                    'What would you like to do?'
                ].join('\n');
                return res.json({ type: 'answer', message: suggestions });
            }
		}
	} catch (e) {
		console.error('Chat error:', e);
		// Provide more specific error messages
		let errorMessage = 'Something went wrong processing your request.';
		if (e.message && e.message.includes('timeout')) {
			errorMessage = 'Request timed out. Please try again with a simpler query.';
		} else if (e.message && e.message.includes('GEMINI')) {
			errorMessage = 'AI service is temporarily unavailable. Please try again in a moment.';
		} else if (e.message) {
			errorMessage = `Error: ${e.message}`;
		}
		return res.status(500).json({ type: 'error', message: errorMessage });
	}
};


