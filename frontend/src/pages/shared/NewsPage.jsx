import { useState } from 'react';
import { Tv2, Sparkles, Link2, ChevronRight, AlertCircle } from 'lucide-react';
import api from '../../api';

function parseArticle(text) {
  // Split into lines, detect headline vs body
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const headline = lines[0]?.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '') || '';
  const body = lines.slice(1);
  return { headline, body };
}

export default function NewsPage() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState('');
  const [error, setError] = useState('');
  const [videoId, setVideoId] = useState('');

  const generate = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setError('');
    setArticle('');
    setVideoId('');
    try {
      const res = await api.post('/news/youtube', { url: url.trim() });
      setArticle(res.data.article || '');
      setVideoId(res.data.videoId || '');
    } catch (e) {
      setError(e.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const { headline, body } = article ? parseArticle(article) : { headline: '', body: [] };

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Tv2 size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">YouTube News</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Paste a Telugu YouTube link to generate English news</p>
        </div>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">YouTube Video URL</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && generate()}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={generate}
            disabled={loading || !url.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={15} />
                Generate News
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">The video must have subtitles/captions enabled. Works best with auto-generated Telugu captions.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Article output */}
      {article && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          {/* Video embed strip */}
          {videoId && (
            <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-brand-500" />
                <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">AI-generated English news</span>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${videoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
              >
                Watch original <ChevronRight size={12} />
              </a>
            </div>
          )}

          <div className="p-5 space-y-4">
            {/* Headline */}
            {headline && (
              <h2 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">{headline}</h2>
            )}

            {/* Body */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {body.map((line, i) => {
                if (line.startsWith('##') || line.startsWith('**') && line.endsWith('**')) {
                  const clean = line.replace(/^#+\s*/, '').replace(/^\*\*/, '').replace(/\*\*$/, '');
                  return <h3 key={i} className="text-base font-semibold text-gray-800 dark:text-gray-100 mt-4 mb-1">{clean}</h3>;
                }
                if (line.startsWith('- ') || line.startsWith('• ')) {
                  return <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed ml-4">{line.slice(2)}</li>;
                }
                return <p key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
