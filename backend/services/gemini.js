const { GoogleGenerativeAI } = require('@google/generative-ai');

let client = null;
let cachedModel = null;

function getClient() {
	if (!process.env.GEMINI_API_KEY) return null;
	if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
	return client;
}

function getModel() {
	const genAI = getClient();
	if (!genAI) return null;
    if (!cachedModel) {
        // Prefer a more capable default; allow env override
        cachedModel = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-pro' });
    }
	return cachedModel;
}

function withTimeout(promise, ms) {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timed out')), ms))
	]);
}

async function generateGuidedResponse(prompt, options = {}) {
	const model = getModel();
	if (!model) throw new Error('GEMINI_API_KEY not configured');

    const behavior = [
        "You are an expert assistant embedded in an Inventory Management System (IMS).",
        "You help users find, summarize, and act on inventory and maintenance data.",
        "",
        "### Grounding & Safety",
        "- ANSWER ONLY using the Data Context and user input. Do NOT guess.",
        "- If a number/date/ID isn't present, state it's not available and suggest a next step.",
        "- Keep a professional, concise tone (3–6 sentences).",
        "",
        "### Formatting",
        "- When listing items, use a compact table with headers: QR Code, Type, Status (and optionally Location).",
        "- For actions (add/update/delete), output a minimal JSON payload matching backend expectations.",
        "- Prefer bullets for short lists; avoid long paragraphs.",
        "",
        "### Reasoning",
        "- Use the most relevant parts of Data Context (recent items, statuses, logs).",
        "- If the request is ambiguous, provide a short, helpful suggestion (e.g., a filter to apply), then show 3–10 relevant items.",
        "",
        "### Few-shot Examples",
        "User: How many printers are available?",
        "Assistant: The exact count isn't in the context. Run: GET /api/items?type=printer&status=Available or ask me to count printers.",
        "",
        "User: Show laptops due for maintenance",
        "Assistant:\nQR Code | Type | Status\n--- | --- | ---\nICTCE-PC-002 | Laptop | pending\n... (limited to available context)",
    ].join('\n');

	const roleLine = `User role: ${options.userRole || 'user'}`;
	const dataHeader = options.dataContext ? "\n\n### Data Context (use if relevant):\n" + (typeof options.dataContext === 'string' ? options.dataContext : JSON.stringify(options.dataContext)) : '';

	const noNumbersRule = !options.dataContext ? "\n\nIMPORTANT: Do NOT provide any numeric counts or dates. If asked for numbers, reply that exact counts aren't available without running a report." : "";
	const system = behavior + "\n" + roleLine + dataHeader + noNumbersRule;

    const envTemp = process.env.GEMINI_TEMPERATURE;
    const envMax = process.env.GEMINI_MAX_TOKENS;
    const temperature = typeof options.temperature === 'number'
        ? options.temperature
        : (envTemp !== undefined ? Number(envTemp) : 0.2);
    const maxOutputTokens = typeof options.maxOutputTokens === 'number'
        ? options.maxOutputTokens
        : (envMax !== undefined ? Number(envMax) : 768);

    const generationConfig = { temperature, maxOutputTokens };

    const makeCall = async () => {
        const req = model.generateContent({
            contents: [{ role: 'user', parts: [{ text: system + '\n\n' + String(prompt || '') }] }],
            generationConfig
        });
        const result = await withTimeout(req, options.timeoutMs ?? 10000);
        return result.response.text();
    };

    // Basic retry with backoff
    const attempts = Math.max(1, Math.min(3, Number(process.env.GEMINI_RETRY_ATTEMPTS) || 2));
    const baseDelay = Number(process.env.GEMINI_RETRY_DELAY_MS) || 400;
    let lastErr;
    for (let i = 0; i < attempts; i++) {
        try {
            let out = await makeCall();
            if (options.enforceNumbersFromContext) {
                out = sanitizeNumbersFromContext(out, options.dataContext);
            }
            return out;
        } catch (e) {
            lastErr = e;
            if (i < attempts - 1) {
                await new Promise(r => setTimeout(r, baseDelay * (i + 1)));
                continue;
            }
        }
    }
    const msg = (lastErr && (lastErr.message || String(lastErr))) || 'Gemini request failed';
    throw new Error(msg);
}

// Utility: enforce numeric literals appear only if present in dataContext
function sanitizeNumbersFromContext(text, dataContext) {
    try {
        if (!text) return text;
        if (!dataContext) return text;
        const dc = typeof dataContext === 'string' ? dataContext : JSON.stringify(dataContext);
        const allowed = new Set((dc.match(/\d+/g) || []).map(String));
        return text.replace(/\d+/g, (m) => (allowed.has(m) ? m : 'N/A'));
    } catch {
        return text;
    }
}

async function healthCheck() {
    try {
        const text = await generateGuidedResponse('Say OK.', { timeoutMs: 5000, maxOutputTokens: 3 });
        return text && /ok/i.test(text);
    } catch (_) {
        return false;
    }
}

async function diagnoseGemini() {
    const hasKey = !!process.env.GEMINI_API_KEY;
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash-latest';
    if (!hasKey) return { hasKey, model: modelName, ok: false, error: 'GEMINI_API_KEY missing' };
    try {
        const ok = await healthCheck();
        return { hasKey, model: modelName, ok };
    } catch (e) {
        return { hasKey, model: modelName, ok: false, error: e?.message || 'unknown error' };
    }
}

module.exports = { generateGuidedResponse, healthCheck, diagnoseGemini };


