import React from 'react';
import { FeedbackItem } from '../types';
import { useI18n } from '../i18n';

interface Props {
  feedback: FeedbackItem;
  hasVoted: boolean;
  onVote: (id: string) => void;
  onClick: (feedback: FeedbackItem) => void;
}

export const FeedbackCard: React.FC<Props> = ({ feedback, hasVoted, onVote, onClick }) => {
  const { t, formatRelativeTime } = useI18n();

  // Translate status
  const getStatusLabel = (status: string): string => {
    const statusMap: Record<string, string> = {
      'open': t('status.open'),
      'planned': t('status.planned'),
      'in-progress': t('status.inProgress'),
      'completed': t('status.completed'),
      'closed': t('status.closed')
    };
    return statusMap[status] || status;
  };

  const statusColors: Record<string, string> = {
    'open': 'bg-gray-100 text-gray-600',
    'planned': 'bg-blue-100 text-blue-600',
    'in-progress': 'bg-yellow-100 text-yellow-600',
    'completed': 'bg-green-100 text-green-600',
    'closed': 'bg-red-100 text-red-600',
  };

  // Support both legacy single screenshot and new screenshots array
  const screenshots = feedback.screenshots || (feedback.screenshot ? [feedback.screenshot] : []);
  const hasScreenshots = screenshots.length > 0;

  const openScreenshot = (screenshot: string) => {
    const image = new Image();
    image.src = screenshot;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`
        <html>
          <head><title>Screenshot - Feedback</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#000;">
            <img src="${screenshot}" style="max-width:100%;max-height:100vh;object-fit:contain;" onclick="window.close()" />
          </body>
        </html>
      `);
    }
  
  const openGallery = () => {
    const w = window.open('', '_blank');
    if (w) {
      const imagesHtml = feedback.screenshots?.map((s, i) => `
        <div style="margin-bottom:20px;cursor:pointer;" onclick="window.open('${s}', '_blank')">
          <img src="${s}" style="max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);" />
          <p style="color:#666;text-align:center;margin-top:8px;font-size:12px;">Image ${i + 1} of ${feedback.screenshots?.length}</p>
        </div>
      `).join('') || '';

      w.document.write(`
        <html>
          <head>
            <title>Screenshots Gallery - Feedback</title>
            <style>
              body { margin: 0; padding: 20px; background: #f5f5f5; font-family: system-ui, sans-serif; }
              .gallery { max-width: 900px; margin: 0 auto; }
              h2 { color: #333; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="gallery">
              <h2>${feedback.title}</h2>
              ${imagesHtml}
            </div>
          </body>
        </html>
      `);
    }
  };

  const getMosaicClass = () => {
    const count = screenshots.length;
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-2';
    if (count === 3) return 'grid-cols-2 grid-rows-2';
    if (count === 4) return 'grid-cols-2 grid-rows-2';
    return 'grid-cols-2 grid-rows-2';
  };

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-indigo-300 hover:shadow-md transition-all flex gap-4 group cursor-pointer overflow-hidden relative"
      onClick={() => onClick(feedback)}
    >
      {/* Vote Button */}
      <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onVote(feedback.id)}
          className={`w-12 h-16 flex flex-col items-center justify-center rounded-lg border-2 transition-all ${
            hasVoted
              ? 'bg-indigo-50 border-indigo-500 text-indigo-600 shadow-sm'
              : 'border-gray-100 hover:border-gray-300 text-gray-400'
          }`}
        >
          <i className={`fa-solid fa-chevron-up text-lg ${hasVoted ? 'animate-bounce' : ''}`}></i>
          <span className="font-bold mt-1">{feedback.votes}</span>
        </button>
      </div>

      <div className="flex-1 min-w-0 overflow-hidden">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${statusColors[feedback.status]}`}>
            {getStatusLabel(feedback.status)}
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
            {feedback.category}
          </span>
          {feedback.sentiment && (
            <span title={`${t('sentiment.' + feedback.sentiment)}`} className="text-sm">
              {feedback.sentiment === 'positive' ? '😊' : feedback.sentiment === 'negative' ? '😟' : '😐'}
            </span>
          )}
        </div>

        <div className="flex flex-col md:flex-row justify-between gap-4 overflow-hidden">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-gray-800 leading-tight mb-2 truncate group-hover:text-indigo-600 transition-colors">
              {feedback.title}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-2 mb-3 leading-relaxed">{feedback.description}</p>
          </div>

          {hasScreenshots && (
            <div className="flex-shrink-0 overflow-visible pb-2" onClick={(e) => e.stopPropagation()}>
              <div
                className={`relative ${feedback.screenshots && feedback.screenshots.length > 1 ? 'w-24' : 'w-20'}`}
                onClick={feedback.screenshots && feedback.screenshots.length > 1 ? openGallery : () => openScreenshot(screenshots[0])}
              >
                {feedback.screenshots && feedback.screenshots.length > 1 ? (
                  // Mosaic display for multiple screenshots
                  <div className={`grid ${getMosaicClass()} gap-0.5 w-24 h-20 overflow-hidden rounded-lg ring-1 ring-gray-200 group-hover/thumb:ring-indigo-400 transition-all cursor-pointer`}>
                    {feedback.screenshots.slice(0, 4).map((screenshot, index) => (
                      <div key={index} className="relative overflow-hidden">
                        <img
                          src={screenshot}
                          alt={`Screenshot ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        {index === 3 && feedback.screenshots && feedback.screenshots.length > 4 && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-white font-bold text-xs">+{feedback.screenshots.length - 4}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  // Single screenshot display (legacy support)
                  <img
                    src={screenshots[0]}
                    alt="Visual Context"
                    className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg ring-1 ring-gray-200 group-hover/thumb:ring-indigo-400 transition-all"
                  />
                )}
                <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-opacity rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-expand text-white text-xs opacity-0 group-hover/thumb:opacity-100 transition-all drop-shadow-lg"></i>
                </div>
                {feedback.screenshots && feedback.screenshots.length > 1 && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                    {feedback.screenshots.length}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {feedback.aiInsight && (
          <div className="bg-indigo-50/50 border-l-4 border-indigo-500 p-3 rounded-r-lg mb-3 mt-2">
             <div className="flex items-center gap-2 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1">
               <i className="fa-solid fa-wand-magic-sparkles"></i>
               {t('aiAnalysis.aiInsight')}
             </div>
             <p className="text-xs text-indigo-900/70 italic font-medium">{feedback.aiInsight}</p>
          </div>
        )}

        <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <i className="fa-regular fa-clock"></i>
            {formatRelativeTime(feedback.createdAt)}
          </span>
        </div>
      </div>
    </div>
  };
