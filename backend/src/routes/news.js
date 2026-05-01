const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { YoutubeTranscript } = require('youtube-transcript');
const { authenticate } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Three models with separate TPM pools — run in parallel for ~88% video coverage
// llama-3.3-70b: 12K TPM, llama-4-scout: separate pool, openai/gpt-oss-20b: 8K TPM (very token-efficient for Telugu)
const BATCHES = [
  { model: 'llama-3.3-70b-versatile',                   maxChars: 5000  },
  { model: 'meta-llama/llama-4-scout-17b-16e-instruct', maxChars: 5000  },
  { model: 'openai/gpt-oss-20b',                        maxChars: 13000 },
];

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function extractJson(text) {
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim();
  try { const r = JSON.parse(stripped); if (Array.isArray(r)) return r; } catch {}
  const match = stripped.match(/\[[\s\S]*\]/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return [];
}

const SYSTEM_PROMPT = `You are a financial news analyst. Extract ALL news items mentioned in this Telugu video transcript segment. Return a JSON array.

Each item must have:
- "company": company name in English (null for market-wide news: Nifty, Sensex, US Fed, gold prices, etc.)
- "symbol": NSE/BSE symbol like "NSE:ADANIPORTS" (null if not mentioned)
- "change_pct": % change as number e.g. 0.44 or -1.18 (null if not mentioned)
- "price": stock price as number (null if not mentioned)
- "headline": 4-6 word English headline
- "summary": 1-2 sentence English summary
- "category": one of "Other","Results","Buyback","Merger/Demerger","Order Win","Dividend","Market Update","IPO","Regulatory"

Do NOT skip any company. Output ONLY the raw JSON array, nothing else.`;

async function analyzeChunk(chunk, model) {
  // Larger chunks need more output tokens; openai model handles 13K chars
  const maxTokens = chunk.length > 6000 ? 4000 : 2000;
  try {
    const completion = await groq.chat.completions.create({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Transcript segment:\n\n${chunk}` },
      ],
    });
    const raw = completion.choices[0]?.message?.content ?? '';
    return extractJson(raw);
  } catch (e) {
    console.error(`[news] ${model} error:`, e.message);
    return [];
  }
}

// POST /api/news/transcript — returns raw transcript for the Claude manual prompt workflow
router.post('/transcript', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    const transcript = segments.map(s => s.text).join(' ');
    if (!transcript || transcript.trim().length < 20) {
      return res.status(422).json({ error: 'Transcript is empty or too short.' });
    }
    res.json({ transcript });
  } catch (e) {
    return res.status(422).json({ error: 'Could not fetch transcript. Make sure the video has captions/subtitles enabled.' });
  }
});

// POST /api/news/youtube
router.post('/youtube', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  let transcript;
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = segments.map(s => s.text).join(' ');
  } catch (e) {
    return res.status(422).json({ error: 'Could not fetch transcript. Make sure the video has captions/subtitles enabled.' });
  }

  if (!transcript || transcript.trim().length < 20) {
    return res.status(422).json({ error: 'Transcript is empty or too short.' });
  }

  // Build continuous chunks — no skipping, no fragmented sampling
  let offset = 0;
  const chunks = BATCHES.map(b => {
    const chunk = transcript.slice(offset, offset + b.maxChars);
    offset += b.maxChars;
    return { chunk, model: b.model };
  });

  try {
    // All three run in parallel using separate model TPM pools
    const results = await Promise.all(chunks.map(({ chunk, model }) => analyzeChunk(chunk, model)));

    // Merge and deduplicate by company+headline
    const seen = new Set();
    const allItems = results.flat().filter(item => {
      if (!item || typeof item !== 'object') return false;
      const key = ((item.company || '') + '|' + (item.headline || '')).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (allItems.length === 0) {
      return res.status(422).json({ error: 'No news items could be extracted. The video may not contain stock/market news, or captions may be in an unsupported format.' });
    }

    const covered = Math.min(offset, transcript.length);
    const coveragePct = Math.round((covered / transcript.length) * 100);

    res.json({ items: allItems, videoId, coveragePct });
  } catch (e) {
    console.error('[news/youtube] error:', e.message);
    res.status(500).json({ error: 'AI generation failed: ' + (e.message || 'Please try again.') });
  }
});

module.exports = router;
