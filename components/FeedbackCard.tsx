
import React from 'react';
import { FeedbackItem } from '../types';

interface Props {
  feedback: FeedbackItem;
  hasVoted: boolean;
  onVote: (id: string) => void;
}

const statusColors: Record<string, string> = {
  'open': 'bg-gray-100 text-gray-600',
  'planned': 'bg-blue-100 text-blue-600',
  'in-progress': 'bg-yellow-100 text-yellow-600',
  'completed': 'bg-green-100 text-green-600',
  'closed': 'bg-red-100 text-red-600',
};

export const FeedbackCard: React.FC<Props> = ({ feedback, hasVoted, onVote }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:border-indigo-300 transition-all flex gap-4 group">
      {/* Vote Button */}
      <div className="flex flex-col items-center">
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

      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest ${statusColors[feedback.status]}`}>
            {feedback.status}
          </span>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
            {feedback.category}
          </span>
          {feedback.sentiment && (
            <span title={`Sentiment: ${feedback.sentiment}`} className="text-sm">
              {feedback.sentiment === 'positive' ? '😊' : feedback.sentiment === 'negative' ? '😟' : '😐'}
            </span>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800 leading-tight mb-2 truncate group-hover:text-indigo-600 transition-colors">
              {feedback.title}
            </h3>
            <p className="text-gray-600 text-sm line-clamp-2 mb-3 leading-relaxed">{feedback.description}</p>
          </div>
          
          {feedback.screenshot && (
            <div className="flex-shrink-0">
              <div className="relative group/thumb cursor-pointer" onClick={() => window.open(feedback.screenshot, '_blank')}>
                <img 
                  src={feedback.screenshot} 
                  alt="Visual Context" 
                  className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg ring-1 ring-gray-200 group-hover/thumb:ring-indigo-400 transition-all"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                  <i className="fa-solid fa-expand text-white text-xs"></i>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {feedback.aiInsight && (
          <div className="bg-indigo-50/50 border-l-4 border-indigo-500 p-3 rounded-r-lg mb-3 mt-2">
             <div className="flex items-center gap-2 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1">
               <i className="fa-solid fa-wand-magic-sparkles"></i>
               AI Insight
             </div>
             <p className="text-xs text-indigo-900/70 italic font-medium">{feedback.aiInsight}</p>
          </div>
        )}

        <div className="flex items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <i className="fa-regular fa-clock"></i>
            {new Date(feedback.createdAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
};
