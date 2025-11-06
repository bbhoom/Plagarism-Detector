import { useState, useRef } from 'react';
import DotGrid from './PixelBlast.js';

function App() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [checkType, setCheckType] = useState(null);
  const wordCount = text.trim().split(/\s+/).filter(w => w).length;
  const resultsRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Maximum size is 10MB');
      return;
    }

    setUploadProgress(10);

    try {
      const formData = new FormData();
      formData.append('pdf', file);

      setUploadProgress(50);

      const res = await fetch('http://127.0.0.1:8000/api/upload-pdf/', {
        method: 'POST',
        body: formData
      });

      setUploadProgress(80);

      const data = await res.json();

      if (data.text) {
        // Clean up emojis and weird characters
        const cleanedText = data.text
          .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Remove emojis
          .replace(/[\u{2600}-\u{26FF}]/gu, '')   // Remove misc symbols
          .replace(/[\u{2700}-\u{27BF}]/gu, '')   // Remove dingbats
          .replace(/[^\x00-\x7F\u00A0-\u024F\u1E00-\u1EFF]/g, '') // Keep only basic Latin chars
          .replace(/•/g, '-')                      // Replace bullet points
          .replace(/\s+/g, ' ')                    // Normalize whitespace
          .trim();

        setText(cleanedText);
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
      } else {
        throw new Error('Could not extract text from PDF');
      }
    } catch (err) {
      console.error(err);
      alert('Error reading PDF. Make sure the backend endpoint is set up.');
      setUploadProgress(0);
    }
  };

  const checkPlagiarism = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResults(null);
    setCheckType('plagiarism');

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/hello-world/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      alert('Error: Make sure Django server is running');
    }

    setLoading(false);
  };

  const checkAI = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResults(null);
    setCheckType('ai');

    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/detect-ai/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, detailed: true })
      });
      const data = await res.json();
      setResults(data);
    } catch (err) {
      alert('Error: Make sure Django server is running');
    }

    setLoading(false);
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        .trace-bg {
          fill: none;
          stroke: #57534e;
          stroke-width: 2;
          opacity: 0.3;
        }
        .trace-flow {
          fill: none;
          stroke-width: 2;
          stroke-dasharray: 200;
          stroke-dashoffset: 200;
          animation: flow 2s ease-in-out infinite;
        }
        .trace-flow.slate { stroke: #78716c; animation-delay: 0s; }
        .trace-flow.gray { stroke: #a8a29e; animation-delay: 0.3s; }
        .trace-flow.dark { stroke: #57534e; animation-delay: 0.6s; }
        .trace-flow.light { stroke: #d6d3d1; animation-delay: 0.9s; }
        @keyframes flow {
          0%, 100% { stroke-dashoffset: 200; opacity: 0; }
          50% { stroke-dashoffset: 0; opacity: 1; }
        }
      `}</style>

      <div className="min-h-screen p-6 md:p-12 relative overflow-hidden bg-stone-900">
        <div className="absolute inset-0 pointer-events-none">
          <div style={{ width: '100%', height: '200%', position: 'relative' }}>
            <DotGrid
              dotSize={5}
              gap={15}
              baseColor="#57534eff"
              activeColor="#78716cff"
              proximity={60}
              shockRadius={250}
              shockStrength={5}
              resistance={750}
              returnDuration={1.0}
            />
          </div>
        </div>
        <div className="max-w-5xl mx-auto relative z-10">

          {/* Header */}
          <div className="text-center mb-16 bg-amber-50 rounded-3xl border border-amber-200/50 p-12 shadow-lg shadow-amber-900/20">
            <h1 className="text-6xl md:text-7xl font-light text-stone-800 mb-4 tracking-tight">
              Content <span className="font-serif italic text-amber-700">Verification</span>
            </h1>
            <p className="text-stone-700 text-sm uppercase tracking-[0.3em]">
              AI Detection & Plagiarism Analysis
            </p>
          </div>

          {/* Input Card */}
          <div className="bg-amber-50 rounded-3xl border border-amber-200/50 p-8 mb-8 shadow-lg shadow-amber-900/20">

            {/* PDF Upload Section */}
            <div className="mb-6 pb-6 border-b border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <label className="text-stone-700 text-sm font-light tracking-wide">
                  Upload PDF Document
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || uploadProgress > 0}
                  className="px-6 py-2 bg-amber-100 text-stone-700 rounded-full text-sm font-light tracking-wide hover:bg-amber-200 hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Choose PDF
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {uploadProgress > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-stone-600 mb-2">
                    <span>Extracting text from PDF...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-amber-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-amber-600 h-full transition-all duration-300 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your content here or upload a PDF above..."
              disabled={loading || uploadProgress > 0}
              className="w-full h-64 bg-transparent text-stone-900 placeholder:text-stone-400 border-none outline-none resize-none text-lg leading-relaxed"
            />

            <div className="flex items-center justify-between mt-6 pt-6 border-t border-amber-200">
              <span className={`text-sm ${wordCount > 2000 ? 'text-red-500' : 'text-stone-500'}`}>
                {wordCount} / 2,000 words
              </span>

              <div className="flex gap-3">
                <button
                  onClick={checkAI}
                  disabled={loading || !text.trim() || wordCount > 2000}
                  className="px-6 py-3 bg-blue-600 text-white rounded-full font-light tracking-wide hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-300/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  {loading && checkType === 'ai' ? 'Detecting...' : 'AI Detection'}
                </button>

                <button
                  onClick={checkPlagiarism}
                  disabled={loading || !text.trim() || wordCount > 2000}
                  className="px-6 py-3 bg-stone-800 text-amber-50 rounded-full font-light tracking-wide hover:bg-stone-700 hover:shadow-lg hover:shadow-stone-900/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-300 flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {loading && checkType === 'plagiarism' ? 'Checking...' : 'Plagiarism Check'}
                </button>
              </div>
            </div>
          </div>

          <div ref={resultsRef}>

            {/* Loader */}
            {loading && (
              <div className="bg-amber-50 rounded-3xl border border-amber-200/50 p-12 text-center shadow-lg shadow-amber-900/20">
                <div className="flex justify-center items-center">
                  <svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-2xl">
                    <defs>
                      <linearGradient id="chipGradient" x1={0} y1={0} x2={0} y2={1}>
                        <stop offset="0%" stopColor="#fef3c7" />
                        <stop offset="100%" stopColor="#fcd34d" />
                      </linearGradient>
                      <linearGradient id="textGradient" x1={0} y1={0} x2={0} y2={1}>
                        <stop offset="0%" stopColor="#78716c" />
                        <stop offset="100%" stopColor="#a8a29e" />
                      </linearGradient>
                      <linearGradient id="pinGradient" x1={1} y1={0} x2={0} y2={0}>
                        <stop offset="0%" stopColor="#d6d3d1" />
                        <stop offset="50%" stopColor="#a8a29e" />
                        <stop offset="100%" stopColor="#78716c" />
                      </linearGradient>
                    </defs>
                    <g id="traces">
                      <path d="M100 100 H200 V210 H326" className="trace-bg" />
                      <path d="M100 100 H200 V210 H326" className="trace-flow slate" />
                      <path d="M80 180 H180 V230 H326" className="trace-bg" />
                      <path d="M80 180 H180 V230 H326" className="trace-flow gray" />
                      <path d="M60 260 H150 V250 H326" className="trace-bg" />
                      <path d="M60 260 H150 V250 H326" className="trace-flow dark" />
                      <path d="M100 350 H200 V270 H326" className="trace-bg" />
                      <path d="M100 350 H200 V270 H326" className="trace-flow light" />
                      <path d="M700 90 H560 V210 H474" className="trace-bg" />
                      <path d="M700 90 H560 V210 H474" className="trace-flow gray" />
                      <path d="M740 160 H580 V230 H474" className="trace-bg" />
                      <path d="M740 160 H580 V230 H474" className="trace-flow light" />
                      <path d="M720 250 H590 V250 H474" className="trace-bg" />
                      <path d="M720 250 H590 V250 H474" className="trace-flow slate" />
                      <path d="M680 340 H570 V270 H474" className="trace-bg" />
                      <path d="M680 340 H570 V270 H474" className="trace-flow dark" />
                    </g>
                    <rect x={330} y={190} width={140} height={100} rx={20} ry={20} fill="url(#chipGradient)" stroke="#fcd34d" strokeWidth={3} filter="drop-shadow(0 2px 8px rgba(0,0,0,0.1))" />
                    <g>
                      <rect x={322} y={205} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={322} y={225} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={322} y={245} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={322} y={265} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                    </g>
                    <g>
                      <rect x={470} y={205} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={470} y={225} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={470} y={245} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                      <rect x={470} y={265} width={8} height={10} fill="url(#pinGradient)" rx={2} />
                    </g>
                    <text x={400} y={240} fontFamily="Arial, sans-serif" fontSize={22} fill="url(#textGradient)" textAnchor="middle" alignmentBaseline="middle">
                      {checkType === 'ai' ? 'Analyzing AI' : 'Verifying'}
                    </text>
                    <circle cx={100} cy={100} r={5} fill="#78716c" />
                    <circle cx={80} cy={180} r={5} fill="#78716c" />
                    <circle cx={60} cy={260} r={5} fill="#78716c" />
                    <circle cx={100} cy={350} r={5} fill="#78716c" />
                    <circle cx={700} cy={90} r={5} fill="#78716c" />
                    <circle cx={740} cy={160} r={5} fill="#78716c" />
                    <circle cx={720} cy={250} r={5} fill="#78716c" />
                    <circle cx={680} cy={340} r={5} fill="#78716c" />
                  </svg>
                </div>
              </div>
            )}

            {/* AI Detection Results */}
            {results && !loading && checkType === 'ai' && (
              <div className="space-y-8 animate-fadeIn">

                <div className="bg-amber-50 rounded-3xl border border-amber-200/50 p-8 shadow-lg shadow-amber-900/20">
                  <h3 className="text-stone-900 text-xl font-light mb-6 tracking-wide flex items-center gap-2">
                    <svg className="w-5 h-5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    AI Detection Analysis
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">AI Probability</p>
                      <div className="text-4xl font-extralight text-stone-900">
                        {results.ai_probability}
                        <span className="text-xl text-stone-500">%</span>
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">Verdict</p>
                      <div className={`text-lg font-light px-4 py-2 rounded-full inline-block ${results.verdict.includes('AI-Generated')
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                        {results.verdict}
                      </div>
                    </div>

                    <div className="text-center">
                      <p className="text-stone-500 text-xs uppercase tracking-wider mb-2">Confidence</p>
                      <div className={`text-lg font-light px-4 py-2 rounded-full inline-block ${results.confidence === 'High'
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-orange-50 text-orange-700 border border-orange-200'
                        }`}>
                        {results.confidence}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-amber-200">
                    <div className="bg-amber-100 rounded-xl p-4">
                      <p className="text-stone-600 text-xs font-light mb-1">Perplexity Score</p>
                      <p className="text-stone-900 text-lg font-light">{results.perplexity}</p>
                      <p className="text-stone-500 text-xs mt-1">Lower = more AI-like</p>
                    </div>

                    <div className="bg-amber-100 rounded-xl p-4">
                      <p className="text-stone-600 text-xs font-light mb-1">Burstiness</p>
                      <p className="text-stone-900 text-lg font-light">{results.burstiness}</p>
                      <p className="text-stone-500 text-xs mt-1">Higher = more human-like</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-6 border-t border-amber-200">
                    <div className="flex items-start gap-3 bg-amber-100 rounded-xl p-4">
                      <svg className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-stone-600 text-xs leading-relaxed font-light">
                        AI detection is not 100% accurate and should be used as a guideline. Results may vary based on writing style and content type.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Plagiarism Results */}
            {results && !loading && checkType === 'plagiarism' && (
              <div className="space-y-8 animate-fadeIn">

                <div className="bg-amber-50 rounded-3xl border border-amber-200/50 p-12 text-center shadow-lg shadow-amber-900/20">
                  <p className="text-stone-500 text-xs uppercase tracking-[0.3em] mb-4">
                    Similarity Score
                  </p>
                  <div className="text-8xl font-extralight text-stone-900 mb-6">
                    {results.max_similarity_score}<span className="text-5xl text-stone-500">%</span>
                  </div>
                  <div className={`inline-block px-6 py-2 rounded-full text-sm font-light tracking-wide ${results.max_similarity_score >= 70 ? 'bg-red-50 text-red-600 border border-red-200' :
                    results.max_similarity_score >= 40 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                      'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    }`}>
                    {results.max_similarity_score >= 70 ? 'High Risk' :
                      results.max_similarity_score >= 40 ? 'Moderate Risk' : 'Low Risk'}
                  </div>

                  {results.top_link && (
                    <div className="mt-8 pt-8 border-t border-amber-200">
                      <p className="text-stone-500 text-xs uppercase tracking-[0.3em] mb-3">Top Match</p>
                      <a
                        href={results.top_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-stone-700 hover:text-stone-900 transition-colors text-sm font-light underline decoration-amber-300 hover:decoration-amber-500"
                      >
                        {new URL(results.top_link).hostname}
                      </a>
                    </div>
                  )}
                </div>

                {results.all_results && results.all_results.length > 0 && (
                  <div className="bg-amber-50 rounded-3xl border border-amber-200/50 p-8 shadow-lg shadow-amber-900/20">
                    <h3 className="text-stone-900 text-xl font-light mb-8 tracking-wide">
                      Sources Analyzed <span className="text-stone-500">({results.all_results.length})</span>
                    </h3>

                    <div className="space-y-4">
                      {results.all_results.map((source, i) => (
                        <div
                          key={i}
                          className="bg-amber-100 rounded-2xl p-6 border border-amber-200 hover:border-amber-300 hover:bg-amber-200/50 transition-all duration-300 group"
                        >
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <h4 className="text-stone-900 font-light text-base flex-1 leading-relaxed">
                              {source.title}
                            </h4>
                            <span className={`text-2xl font-extralight ${source.similarity_score >= 70 ? 'text-red-600' :
                              source.similarity_score >= 40 ? 'text-amber-600' :
                                'text-emerald-600'
                              }`}>
                              {source.similarity_score}%
                            </span>
                          </div>

                          <p className="text-stone-600 text-sm leading-relaxed mb-4 font-light">
                            {source.snippet.substring(0, 150)}...
                          </p>

                          <a
                            href={source.link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-stone-700 hover:text-stone-900 text-xs tracking-wide transition-colors inline-flex items-center gap-2 group-hover:gap-3 duration-300 underline decoration-amber-300 hover:decoration-amber-500"
                          >
                            {new URL(source.link).hostname}
                            <span>→</span>
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

export default App;