const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const chatController = require('../controllers/chatController');

router.post('/', verifyToken, chatController.chat);
// Optional: direct Gemini summarization for a provided prompt
router.post('/gemini', verifyToken, async (req, res) => {
  const { prompt } = req.body || {};
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ text: 'Gemini not configured' });
  if (!prompt) return res.status(400).json({ text: 'Missing prompt' });
  try {
    const { generateGuidedResponse } = require('../services/gemini');
    const text = await generateGuidedResponse(String(prompt), { 
      timeoutMs: 10000,
      maxOutputTokens: 512 
    });
    res.json({ text });
  } catch (e) {
    console.error('Gemini direct call error:', e);
    res.status(500).json({ text: 'Unable to process request right now. Please try again.' });
  }
});

router.get('/gemini/health', async (req, res) => {
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ ok: false, message: 'Gemini not configured' });
  try {
    const { healthCheck } = require('../services/gemini');
    const ok = await healthCheck();
    res.json({ ok });
  } catch (_) {
    res.status(500).json({ ok: false });
  }
});

// Debug endpoint: reveals only whether key is present and model; no secrets
router.get('/gemini/debug', async (req, res) => {
  try {
    const { diagnoseGemini } = require('../services/gemini');
    const info = await diagnoseGemini();
    res.json(info);
  } catch (_) {
    res.status(500).json({ ok: false });
  }
});

// Live test call to Gemini; returns either text or an error message
router.post('/gemini/test', async (req, res) => {
  const prompt = (req.body?.prompt || 'Say OK.').toString();
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ ok: false, message: 'Gemini not configured' });
  try {
    const { generateGuidedResponse } = require('../services/gemini');
    const text = await generateGuidedResponse(prompt, { maxOutputTokens: 8, timeoutMs: 8000 });
    return res.json({ ok: true, text });
  } catch (e) {
    console.error('Gemini test error:', e?.message || e);
    return res.status(500).json({ ok: false, error: e?.message || 'unknown error' });
  }
});

module.exports = router;


