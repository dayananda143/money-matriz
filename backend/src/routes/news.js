const express = require('express');
const router = express.Router();
const Groq = require('groq-sdk');
const { YoutubeTranscript } = require('youtube-transcript');
const { authenticate } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

// POST /api/news/youtube — fetch transcript + generate English news via Groq
router.post('/youtube', authenticate, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  let transcript;
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId);
    transcript = items.map(i => i.text).join(' ');
  } catch (e) {
    return res.status(422).json({ error: 'Could not fetch transcript. Make sure the video has captions/subtitles enabled.' });
  }

  if (!transcript || transcript.trim().length < 20) {
    return res.status(422).json({ error: 'Transcript is empty or too short.' });
  }

  // Truncate to avoid token limits (~8000 chars ≈ ~2000 tokens)
  const truncated = transcript.length > 8000 ? transcript.slice(0, 8000) + '...' : transcript;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 2048,
      messages: [
        {
          role: 'system',
          content: `You are a professional news journalist. The user will give you a transcript from a Telugu YouTube video. Your task is to:
1. Understand the Telugu content (it may be transliterated or mixed with English)
2. Extract the key news/information
3. Write a clear, well-structured English news article based on the content
4. Format it with: a headline, a summary paragraph, and detailed sections
5. Be accurate to the content — do not add information not present in the transcript
6. If the transcript is about stock market, finance, or investments, highlight those aspects clearly`,
        },
        {
          role: 'user',
          content: `Here is the transcript from a Telugu YouTube video. Please convert it into a well-written English news article:\n\n${truncated}`,
        },
      ],
    });

    const article = completion.choices[0]?.message?.content ?? '';
    res.json({ article, videoId });
  } catch (e) {
    console.error('[news/youtube] Groq error:', e.message);
    res.status(500).json({ error: 'AI generation failed. Please try again.' });
  }
});

module.exports = router;
