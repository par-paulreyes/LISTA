const { GoogleGenerativeAI } = require('@google/generative-ai');

function stripCodeFences(text) {
	if (!text) return '';
	return String(text)
		.replace(/^```(json)?/i, '')
		.replace(/```$/i, '')
		.trim();
}

let client;
let model;

function getModel() {
    if (!process.env.GEMINI_API_KEY) return null;
    if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // Prefer configured model; fall back to a sensible default
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
    if (!model) model = client.getGenerativeModel({ model: modelName });
    return model;
}

async function planAction(message, context = {}) {
	const m = getModel();
	if (!m) throw new Error('GEMINI_API_KEY not configured');
    const system = `You are a planner for an Inventory Management System.
Output ONLY strict JSON following this schema with no commentary:
{
  "type": "plan",
  "action": "addItem|updateItem|deleteItem|countAvailable|itemsNeedingMaintenance|summarize|troubleshoot|createMaintenanceTasks",
  "params": object,
  "requiresConfirmation": boolean
}
Rules:
- Never invent counts; for numerical answers choose countAvailable and provide a target string (e.g., "printers").
- For risky actions (add/update/delete), set requiresConfirmation=true and include minimal params.
- Keep params minimal: identifiers, filters, or free-text summary topic.
- For troubleshoot: return concise steps and, if appropriate, a suggested createMaintenanceTasks payload inside params.suggested.
- For createMaintenanceTasks: include item_id and an array tasks: [{ task, notes?, maintenance_date? }]. Default maintenance_date to today if omitted.
- Use concise targets like "printers", "laptops", etc.
Context:
${JSON.stringify({ company: context.company_name || null })}`;

	const prompt = `User: ${message}`;
    const result = await m.generateContent({
        contents: [
            { role: 'user', parts: [{ text: system }] },
            { role: 'user', parts: [{ text: prompt }] }
        ]
    });
    const text = typeof result?.response?.text === 'function' ? result.response.text() : '';
	const cleaned = stripCodeFences(text);
	let json;
    try { json = JSON.parse(cleaned); } catch { throw new Error('Planner returned non-JSON'); }
    if (!json || json.type !== 'plan' || !json.action) throw new Error('Invalid plan');
    if (json && (json.params == null || typeof json.params !== 'object')) json.params = {};
	return json;
}

module.exports = { planAction };


