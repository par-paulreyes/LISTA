const db = require('../db');
const ss = require('simple-statistics');

function query(sql, params = []) {
    return new Promise((resolve) => {
        db.query(sql, params, (err, rows) => {
            if (err) return resolve([]); // always return an array on error
            resolve(Array.isArray(rows) ? rows : []);
        });
    });
}

const CACHE_TTL_MS = 30_000; // 30s
const cache = new Map(); // key: snapshot:company, value { ts, data }

async function getKnowledgeSnapshot(companyName) {
    const cacheKey = `snapshot:${companyName}`;
    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && (now - hit.ts) < CACHE_TTL_MS) {
        return hit.data;
    }
    try {
        const [byCategory, byType, byStatus, upcoming, pending, total] = await Promise.all([
            query(`SELECT category, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY category ORDER BY count DESC LIMIT 20`, [companyName]),
            query(`SELECT article_type, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY article_type ORDER BY count DESC LIMIT 30`, [companyName]),
            query(`SELECT item_status, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY item_status`, [companyName]),
            query(`SELECT COUNT(*) as count FROM items WHERE company_name = ? AND next_maintenance_date IS NOT NULL AND next_maintenance_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`, [companyName]),
            query(`SELECT COUNT(*) as count FROM maintenance_logs ml JOIN items i ON i.id = ml.item_id WHERE i.company_name = ? AND ml.status = 'pending'`, [companyName]),
            query(`SELECT COUNT(*) as count FROM items WHERE company_name = ?`, [companyName])
        ]);

        const upcomingCount = Array.isArray(upcoming) && upcoming[0] && typeof upcoming[0].count !== 'undefined' ? Number(upcoming[0].count) : 0;
        const pendingCount = Array.isArray(pending) && pending[0] && typeof pending[0].count !== 'undefined' ? Number(pending[0].count) : 0;

        const data = {
            categories: Array.isArray(byCategory) ? byCategory : [],
            articleTypes: Array.isArray(byType) ? byType : [],
            itemStatuses: Array.isArray(byStatus) ? byStatus : [],
            upcomingMaintenanceWithin30Days: Number.isFinite(upcomingCount) ? upcomingCount : 0,
            pendingMaintenanceTasks: Number.isFinite(pendingCount) ? pendingCount : 0,
            totalItems: (Array.isArray(total) && total[0] && typeof total[0].count !== 'undefined') ? Number(total[0].count) : 0
        };
        cache.set(cacheKey, { ts: now, data });
        return data;
    } catch (_e) {
        const data = {
            categories: [],
            articleTypes: [],
            itemStatuses: [],
            upcomingMaintenanceWithin30Days: 0,
            pendingMaintenanceTasks: 0,
            totalItems: 0
        };
        cache.set(cacheKey, { ts: now, data });
        return data;
    }
}

async function getRichContext(companyName) {
    const cacheKey = `rich:${companyName}`;
    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && (now - hit.ts) < CACHE_TTL_MS) {
        return hit.data;
    }
    try {
        const [base, itemsSample, recentMaint, topLocations, topBrands] = await Promise.all([
            getKnowledgeSnapshot(companyName),
            query(`SELECT id, qr_code, property_no, serial_no, article_type, item_status, brand, location, end_user, created_at FROM items WHERE company_name = ? ORDER BY id DESC LIMIT 500`, [companyName]),
            query(`SELECT ml.id, ml.item_id, ml.maintenance_date, ml.task_performed, ml.status, ml.maintained_by, ml.created_at, i.qr_code, i.article_type, i.location FROM maintenance_logs ml JOIN items i ON i.id = ml.item_id WHERE i.company_name = ? ORDER BY ml.created_at DESC LIMIT 500`, [companyName]),
            query(`SELECT location, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY location ORDER BY count DESC LIMIT 20`, [companyName]),
            query(`SELECT brand, COUNT(*) as count FROM items WHERE company_name = ? GROUP BY brand ORDER BY count DESC LIMIT 20`, [companyName])
        ]);
        const data = {
            ...base,
            itemsSample: Array.isArray(itemsSample) ? itemsSample : [],
            recentMaintenance: Array.isArray(recentMaint) ? recentMaint : [],
            topLocations: Array.isArray(topLocations) ? topLocations : [],
            topBrands: Array.isArray(topBrands) ? topBrands : []
        };
        cache.set(cacheKey, { ts: now, data });
        return data;
    } catch (_e) {
        const base = await getKnowledgeSnapshot(companyName);
        const data = { ...base, itemsSample: [], recentMaintenance: [], topLocations: [], topBrands: [] };
        cache.set(cacheKey, { ts: now, data });
        return data;
    }
}

module.exports = { getKnowledgeSnapshot, getRichContext };

// --- Predictive helpers ---
async function getMonthlyCounts(companyName) {
    const itemsByMonth = await query(
        `SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS count
         FROM items WHERE company_name = ?
         GROUP BY ym ORDER BY ym ASC`,
        [companyName]
    );
    const logsByMonth = await query(
        `SELECT DATE_FORMAT(ml.maintenance_date, '%Y-%m') AS ym, COUNT(*) AS count
         FROM maintenance_logs ml JOIN items i ON i.id = ml.item_id
         WHERE i.company_name = ?
         GROUP BY ym ORDER BY ym ASC`,
        [companyName]
    );
    return { itemsByMonth, logsByMonth };
}

function exponentialSmoothing(series, alpha = 0.3, periods = 1) {
    // Single exponential smoothing
    if (!Array.isArray(series) || series.length < 2) return null;
    const y = series.map(p => Number(p.y) || 0);
    let smoothed = [y[0]];
    for (let i = 1; i < y.length; i++) {
        smoothed.push(alpha * y[i] + (1 - alpha) * smoothed[i - 1]);
    }
    const lastSmoothed = smoothed[smoothed.length - 1];
    const next = Math.max(0, Math.round(lastSmoothed));
    const residuals = y.slice(1).map((val, i) => val - smoothed[i + 1]);
    const sd = ss.standardDeviation(residuals);
    const lower = Math.max(0, Math.round(next - 1.96 * sd));
    const upper = Math.max(0, Math.round(next + 1.96 * sd));
    return { next, lower, upper, model: 'exponential-smoothing', alpha };
}

function holtsMethod(series, alpha = 0.3, beta = 0.1, periods = 1) {
    // Double exponential smoothing (Holt's method) - handles trend
    if (!Array.isArray(series) || series.length < 3) return null;
    const y = series.map(p => Number(p.y) || 0);
    let level = y[0];
    let trend = y.length > 1 ? y[1] - y[0] : 0;
    const fitted = [y[0]];
    for (let i = 1; i < y.length; i++) {
        const prevLevel = level;
        level = alpha * y[i] + (1 - alpha) * (level + trend);
        trend = beta * (level - prevLevel) + (1 - beta) * trend;
        fitted.push(level + trend);
    }
    const forecasts = [];
    for (let k = 1; k <= periods; k++) {
        forecasts.push(level + k * trend);
    }
    const next = Math.max(0, Math.round(forecasts[forecasts.length - 1]));
    const residuals = y.map((val, i) => val - (fitted[i] || val));
    const sd = ss.standardDeviation(residuals);
    const lower = Math.max(0, Math.round(next - 1.96 * sd));
    const upper = Math.max(0, Math.round(next + 1.96 * sd));
    return { next, lower, upper, level, trend, model: 'holts-method', alpha, beta };
}

function movingAverageForecast(series, window = 3, periods = 1) {
    if (!Array.isArray(series) || series.length < window) return null;
    const y = series.map(p => Number(p.y) || 0);
    const lastWindow = y.slice(-window);
    const avg = ss.mean(lastWindow);
    const next = Math.max(0, Math.round(avg));
    const sd = ss.standardDeviation(lastWindow);
    const lower = Math.max(0, Math.round(next - 1.96 * sd));
    const upper = Math.max(0, Math.round(next + 1.96 * sd));
    return { next, lower, upper, model: `moving-average-${window}`, window };
}

function simpleLinearForecast(series, periods = 1) {
    // series: [{ x: index, y: number }]; returns next y after last point
    if (!Array.isArray(series) || series.length < 2) return { next: series?.[series.length-1]?.y || 0, model: 'linear' };
    const x = series.map(p => Number(p.x) || 0);
    const y = series.map(p => Number(p.y) || 0);
    // Use simple-statistics linear regression
    const regression = ss.linearRegression(x.map((xi, i) => [xi, y[i]]));
    const lastX = x[x.length - 1];
    const nextX = lastX + periods;
    const next = Math.max(0, Math.round(regression.m * nextX + regression.b));
    // Calculate confidence interval using standard error
    const residuals = y.map((yi, i) => yi - (regression.m * x[i] + regression.b));
    const rmse = ss.rootMeanSquare(residuals);
    const se = rmse * Math.sqrt(1 + 1 / x.length + Math.pow(nextX - ss.mean(x), 2) / ss.sumSimple(x.map(xi => Math.pow(xi - ss.mean(x), 2))));
    const lower = Math.max(0, Math.round(next - 1.96 * se));
    const upper = Math.max(0, Math.round(next + 1.96 * se));
    return { next, lower, upper, slope: regression.m, intercept: regression.b, model: 'linear-regression' };
}

function calculateAccuracy(actual, fitted) {
    if (!Array.isArray(actual) || !Array.isArray(fitted) || actual.length !== fitted.length) return null;
    const errors = actual.map((a, i) => Math.abs(a - fitted[i]));
    const mape = ss.mean(errors.map((e, i) => actual[i] > 0 ? (e / actual[i]) * 100 : 0));
    const rmse = ss.rootMeanSquare(actual.map((a, i) => a - fitted[i]));
    return { mape, rmse };
}

function selectBestModel(series, periods = 1) {
    // Try multiple models and select the best based on fit
    if (!Array.isArray(series) || series.length < 2) {
        const last = series?.[series.length - 1]?.y || 0;
        return { next: last, lower: last, upper: last, model: 'naive', confidence: 0 };
    }
    const y = series.map(p => Number(p.y) || 0);
    const models = [];
    // Try Holt's method
    const holt = holtsMethod(series, 0.3, 0.1, periods);
    if (holt) {
        const fitted = [];
        let level = y[0];
        let trend = y.length > 1 ? y[1] - y[0] : 0;
        for (let i = 0; i < y.length; i++) {
            if (i > 0) {
                const prevLevel = level;
                level = 0.3 * y[i] + 0.7 * (level + trend);
                trend = 0.1 * (level - prevLevel) + 0.9 * trend;
            }
            fitted.push(level + trend);
        }
        const acc = calculateAccuracy(y, fitted);
        models.push({ ...holt, accuracy: acc, score: acc ? (100 - acc.mape) : 0 });
    }
    // Try linear regression
    const linear = simpleLinearForecast(series, periods);
    if (linear) {
        const x = series.map((p, i) => i);
        const fitted = x.map(xi => linear.slope * xi + linear.intercept);
        const acc = calculateAccuracy(y, fitted);
        models.push({ ...linear, accuracy: acc, score: acc ? (100 - acc.mape) : 0 });
    }
    // Try exponential smoothing
    const exp = exponentialSmoothing(series, 0.3, periods);
    if (exp) {
        const fitted = [];
        let smoothed = y[0];
        fitted.push(y[0]);
        for (let i = 1; i < y.length; i++) {
            smoothed = 0.3 * y[i] + 0.7 * smoothed;
            fitted.push(smoothed);
        }
        const acc = calculateAccuracy(y, fitted);
        models.push({ ...exp, accuracy: acc, score: acc ? (100 - acc.mape) : 0 });
    }
    // Try moving average
    const ma = movingAverageForecast(series, Math.min(3, Math.floor(y.length / 2)), periods);
    if (ma) {
        const window = ma.window || 3;
        const fitted = y.map((_, i) => {
            if (i < window) return y[i];
            const windowVals = y.slice(i - window, i);
            return ss.mean(windowVals);
        });
        const acc = calculateAccuracy(y, fitted);
        models.push({ ...ma, accuracy: acc, score: acc ? (100 - acc.mape) : 0 });
    }
    // Select best model (highest score, or first if all equal)
    if (models.length === 0) return simpleLinearForecast(series, periods);
    models.sort((a, b) => (b.score || 0) - (a.score || 0));
    const best = models[0];
    return { ...best, confidence: Math.min(100, Math.max(0, best.score || 0)) };
}

function holtWintersAdditive(series, seasonLength = 12, periods = 1, alpha = 0.4, beta = 0.3, gamma = 0.3) {
    // series: [{x, y}] in chronological order
    const n = Array.isArray(series) ? series.length : 0;
    if (n < seasonLength * 2) return null; // not enough data
    const y = series.map(p => Number(p.y) || 0);
    // Initial level and trend
    const season1 = y.slice(0, seasonLength);
    const season2 = y.slice(seasonLength, seasonLength * 2);
    const initialLevel = season1.reduce((a, b) => a + b, 0) / seasonLength;
    const initialTrend = (season2.reduce((a, b) => a + b, 0) / seasonLength - initialLevel) / seasonLength;
    // Initial seasonal components
    const seasonal = new Array(seasonLength);
    for (let i = 0; i < seasonLength; i++) {
        seasonal[i] = season1[i] - initialLevel;
    }
    let level = initialLevel;
    let trend = initialTrend;
    const fitted = [];
    for (let t = 0; t < n; t++) {
        const sIdx = t % seasonLength;
        const prevLevel = level;
        const prevTrend = trend;
        const prevSeason = seasonal[sIdx];
        // Update level, trend, seasonal (additive)
        level = alpha * (y[t] - prevSeason) + (1 - alpha) * (prevLevel + prevTrend);
        trend = beta * (level - prevLevel) + (1 - beta) * prevTrend;
        seasonal[sIdx] = gamma * (y[t] - level) + (1 - gamma) * prevSeason;
        const fittedValue = (prevLevel + prevTrend) + prevSeason;
        fitted.push(fittedValue);
    }
    // Forecast next k periods
    const forecasts = [];
    for (let k = 1; k <= periods; k++) {
        const sIdx = (n + k - 1) % seasonLength;
        forecasts.push(level + k * trend + seasonal[sIdx]);
    }
    // Residuals & prediction intervals using simple-statistics
    const residuals = y.map((val, i) => val - (fitted[i] || 0));
    const sd = ss.standardDeviation(residuals);
    const next = Math.max(0, Math.round(forecasts[forecasts.length - 1]));
    const lower = Math.max(0, Math.round(next - 1.96 * sd));
    const upper = Math.max(0, Math.round(next + 1.96 * sd));
    return { next, lower, upper, sd, level, trend, seasonLength, model: 'holt-winters-additive' };
}

async function getForecast(companyName, periods = [1, 3, 6]) {
    const { itemsByMonth, logsByMonth } = await getMonthlyCounts(companyName);
    const toSeries = (rows) => rows.map((r, idx) => ({ x: idx, y: Number(r.count) || 0 }));
    const itemsSeries = toSeries(itemsByMonth);
    const logsSeries = toSeries(logsByMonth);
    
    // Try seasonal model first if enough data, else use best model selection
    const itemsHW = holtWintersAdditive(itemsSeries, 12, Math.max(...periods));
    const logsHW = holtWintersAdditive(logsSeries, 12, Math.max(...periods));
    
    // Use best model selection for items
    const itemsBest = itemsHW && itemsHW.next != null ? itemsHW : selectBestModel(itemsSeries, Math.max(...periods));
    const logsBest = logsHW && logsHW.next != null ? logsHW : selectBestModel(logsSeries, Math.max(...periods));
    
    // Generate multi-period forecasts
    const itemsForecasts = periods.map(p => {
        const f = itemsHW && itemsHW.next != null 
            ? holtWintersAdditive(itemsSeries, 12, p) 
            : selectBestModel(itemsSeries, p);
        return { period: p, forecast: f.next || 0, lower: f.lower || 0, upper: f.upper || 0 };
    });
    
    const logsForecasts = periods.map(p => {
        const f = logsHW && logsHW.next != null 
            ? holtWintersAdditive(logsSeries, 12, p) 
            : selectBestModel(logsSeries, p);
        return { period: p, forecast: f.next || 0, lower: f.lower || 0, upper: f.upper || 0 };
    });
    
    // Calculate trend
    const itemsTrend = itemsSeries.length >= 2 
        ? (itemsSeries[itemsSeries.length - 1].y - itemsSeries[0].y) / itemsSeries.length 
        : 0;
    const logsTrend = logsSeries.length >= 2 
        ? (logsSeries[logsSeries.length - 1].y - logsSeries[0].y) / logsSeries.length 
        : 0;
    
    return {
        itemsByMonth,
        logsByMonth,
        forecast: {
            // Next month (primary forecast)
            nextMonthNewItems: itemsBest.next || 0,
            nextMonthNewItemsPI: itemsBest.lower != null ? { lower: itemsBest.lower, upper: itemsBest.upper } : null,
            itemsModel: itemsBest.model || 'unknown',
            itemsConfidence: itemsBest.confidence || 0,
            itemsAccuracy: itemsBest.accuracy || null,
            
            nextMonthMaintenanceTasks: logsBest.next || 0,
            nextMonthMaintenanceTasksPI: logsBest.lower != null ? { lower: logsBest.lower, upper: logsBest.upper } : null,
            logsModel: logsBest.model || 'unknown',
            logsConfidence: logsBest.confidence || 0,
            logsAccuracy: logsBest.accuracy || null,
            
            // Multi-period forecasts
            itemsForecasts,
            logsForecasts,
            
            // Trend analysis
            itemsTrend: Math.round(itemsTrend * 100) / 100,
            logsTrend: Math.round(logsTrend * 100) / 100,
            itemsTrendDirection: itemsTrend > 0 ? 'increasing' : itemsTrend < 0 ? 'decreasing' : 'stable',
            logsTrendDirection: logsTrend > 0 ? 'increasing' : logsTrend < 0 ? 'decreasing' : 'stable'
        }
    };
}

module.exports.getForecast = getForecast;


