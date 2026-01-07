import React, { useState, useEffect } from 'react';
import { FeedbackItem, FeedbackStatus } from '../types';

interface Props {
  feedback: FeedbackItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: FeedbackItem) => void;
  onDelete: (id: string) => void;
}

const statusColors: Record<string, string> = {
  'open': 'bg-gray-100 text-gray-600 border-gray-200',
  'planned': 'bg-blue-100 text-blue-600 border-blue-200',
  'in-progress': 'bg-yellow-100 text-yellow-600 border-yellow-200',
  'completed': 'bg-green-100 text-green-600 border-green-200',
  'closed': 'bg-red-100 text-red-600 border-red-200',
};

const statusOptions: FeedbackStatus[] = ['open', 'planned', 'in-progress', 'completed', 'closed'];
const categoryOptions = ['General', 'Feature', 'Bug', 'UI/UX', 'Performance', 'Security', 'Documentation'];

const getApiBase = () => '/api';

export const FeedbackModal: React.FC<Props> = ({ feedback, isOpen, onClose, onSave, onDelete }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedFeedback, setEditedFeedback] = useState<FeedbackItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  useEffect(() => {
    if (feedback) {
      setEditedFeedback({ ...feedback });
      setIsEditing(false);
      setActiveImageIndex(0);
      setAiSummary(null);
      setIsAnalyzing(false);
    }
  }, [feedback]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !feedback || !editedFeedback) return null;

  const screenshots = editedFeedback.screenshots || (editedFeedback.screenshot ? [editedFeedback.screenshot] : []);

  const handleSave = async () => {
    if (!editedFeedback) return;
    setIsSaving(true);
    try {
      await onSave(editedFeedback);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this feedback? This action cannot be undone.')) {
      onDelete(feedback.id);
    }
  };

  const handleAIAnalyze = async () => {
    if (!editedFeedback || isAnalyzing) return;

    setIsAnalyzing(true);
    setAiSummary(null);

    try {
      const screenshots = editedFeedback.screenshots || (editedFeedback.screenshot ? [editedFeedback.screenshot] : []);

      const response = await fetch(`${getApiBase()}/ai/comprehensive-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: editedFeedback.title,
          details: editedFeedback.description,
          images: screenshots
        })
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response.json();
      setAiSummary(data.summary);

      // Update feedback with AI-enhanced data
      setEditedFeedback({
        ...editedFeedback,
        title: data.enhancedSubject || editedFeedback.title,
        description: data.enhancedDetails || editedFeedback.description,
        category: data.category || editedFeedback.category,
        sentiment: data.sentiment || editedFeedback.sentiment,
        aiInsight: data.aiInsight || editedFeedback.aiInsight
      });
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('AI analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-8 py-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600">
              <i className="fa-solid fa-message text-xl"></i>
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Feedback Details</h2>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                ID: {feedback.id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <button
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing}
                  className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      AI Analyze
                    </>
                  )}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                >
                  <i className="fa-solid fa-pen"></i>
                  Edit
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing || !editedFeedback?.title || !editedFeedback?.description}
                  className="px-4 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-bold hover:bg-purple-100 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isAnalyzing ? (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                      AI Analyze
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setEditedFeedback({ ...feedback });
                    setIsEditing(false);
                    setAiSummary(null);
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? (
                    <i className="fa-solid fa-spinner animate-spin"></i>
                  ) : (
                    <i className="fa-solid fa-check"></i>
                  )}
                  Save
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center text-gray-400 hover:text-gray-600"
            >
              <i className="fa-solid fa-times text-xl"></i>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="p-8 space-y-6">
            {/* Status & Category Row */}
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Status
                </label>
                {isEditing ? (
                  <select
                    value={editedFeedback.status}
                    onChange={(e) => setEditedFeedback({ ...editedFeedback, status: e.target.value as FeedbackStatus })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none font-medium"
                  >
                    {statusOptions.map(status => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                ) : (
                  <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-bold border ${statusColors[editedFeedback.status]}`}>
                    {editedFeedback.status}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Category
                </label>
                {isEditing ? (
                  <select
                    value={editedFeedback.category}
                    onChange={(e) => setEditedFeedback({ ...editedFeedback, category: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none font-medium"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <span className="inline-block px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold">
                    {editedFeedback.category}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-[120px]">
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                  Votes
                </label>
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-chevron-up text-indigo-500"></i>
                  <span className="text-2xl font-black text-gray-900">{editedFeedback.votes}</span>
                </div>
              </div>
              {editedFeedback.sentiment && (
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                    Sentiment
                  </label>
                  <span className="text-2xl">
                    {editedFeedback.sentiment === 'positive' ? '😊' : editedFeedback.sentiment === 'negative' ? '😟' : '😐'}
                  </span>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Subject
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedFeedback.title}
                  onChange={(e) => setEditedFeedback({ ...editedFeedback, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none font-bold text-lg"
                />
              ) : (
                <h3 className="text-2xl font-black text-gray-900">{editedFeedback.title}</h3>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                Details
              </label>
              {isEditing ? (
                <textarea
                  value={editedFeedback.description}
                  onChange={(e) => setEditedFeedback({ ...editedFeedback, description: e.target.value })}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none font-medium resize-none"
                />
              ) : (
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{editedFeedback.description}</p>
              )}
            </div>

            {/* Screenshots */}
            {screenshots.length > 0 && (
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                  Visual Context ({screenshots.length} image{screenshots.length !== 1 ? 's' : ''})
                </label>
                <div className="space-y-4">
                  {/* Main Image */}
                  <div className="relative bg-gray-100 rounded-2xl overflow-hidden">
                    <img
                      src={screenshots[activeImageIndex]}
                      alt={`Screenshot ${activeImageIndex + 1}`}
                      className="w-full h-auto max-h-[400px] object-contain cursor-pointer"
                      onClick={() => window.open(screenshots[activeImageIndex], '_blank')}
                    />
                    <div className="absolute bottom-4 right-4 bg-black/50 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                      {activeImageIndex + 1} / {screenshots.length}
                    </div>
                  </div>

                  {/* Thumbnails */}
                  {screenshots.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {screenshots.map((screenshot, index) => (
                        <button
                          key={index}
                          onClick={() => setActiveImageIndex(index)}
                          className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                            index === activeImageIndex
                              ? 'border-indigo-500 ring-2 ring-indigo-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={screenshot}
                            alt={`Thumbnail ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* AI Summary (from current analysis) */}
            {aiSummary && (
              <div className="bg-green-50 border-l-4 border-green-500 p-5 rounded-r-xl animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-green-700 text-xs font-black uppercase tracking-wider mb-2">
                  <i className="fa-solid fa-robot"></i>
                  AI Analysis Complete
                </div>
                <p className="text-green-900/80 font-medium">{aiSummary}</p>
                <p className="text-xs text-green-600 mt-2 font-medium">
                  <i className="fa-solid fa-check-circle mr-1"></i>
                  Title, description, category, and sentiment have been enhanced
                </p>
              </div>
            )}

            {/* AI Insight */}
            {editedFeedback.aiInsight && (
              <div className="bg-indigo-50 border-l-4 border-indigo-500 p-5 rounded-r-xl">
                <div className="flex items-center gap-2 text-indigo-700 text-xs font-black uppercase tracking-wider mb-2">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  AI Insight
                </div>
                <p className="text-indigo-900/80 font-medium">{editedFeedback.aiInsight}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="text-sm text-gray-400 font-medium">
                <i className="fa-regular fa-clock mr-2"></i>
                Created: {new Date(editedFeedback.createdAt).toLocaleString()}
              </div>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-xl text-sm font-bold transition-colors flex items-center gap-2"
              >
                <i className="fa-solid fa-trash-can"></i>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
