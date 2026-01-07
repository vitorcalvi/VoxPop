import React, { useState, useRef } from 'react';
import { FeedbackItem } from '../types';

const getApiBase = () => '/api';

interface Props {
  onAdd: (feedback: FeedbackItem) => void;
}

export const FeedbackForm: React.FC<Props> = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzed, setIsAnalyzed] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setScreenshots((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      }
    });
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeScreenshot = (indexToRemove: number) => {
    setScreenshots((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleAIPostFeedback = async () => {
    if (!title || !description || isAnalyzing || isSubmitting) return;

    setIsAnalyzing(true);
    setAiSummary(null);

    try {
      const response = await fetch(`${getApiBase()}/ai/comprehensive-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: title,
          details: description,
          images: screenshots
        })
      });

      if (!response.ok) {
        throw new Error('AI analysis failed');
      }

      const data = await response.json();
      setAiSummary(data.summary);
      setIsAnalyzed(true);
      
      // Update title and description with AI-enhanced versions
      if (data.enhancedSubject) {
        setTitle(data.enhancedSubject);
      }
      if (data.enhancedDetails) {
        setDescription(data.enhancedDetails);
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      alert('AI analysis failed. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Only allow submission after analysis is complete
    if (!isAnalyzed || !title || !description || isSubmitting) {
      if (!isAnalyzed) {
        alert('Please complete AI analysis before submitting.');
      }
      return;
    }

    setIsSubmitting(true);
    
    try {
      const newFeedback: FeedbackItem = {
        id: '',
        title,
        description,
        category: 'General',
        votes: 1,
        status: 'open',
        createdAt: new Date().toISOString(),
        screenshots: screenshots.length > 0 ? screenshots : undefined
      };

      await onAdd(newFeedback);
      setTitle('');
      setDescription('');
      setScreenshots([]);
      setIsAnalyzed(false);
      setAiSummary(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Error submitting feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-indigo-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50/50 rounded-full -mr-16 -mt-16 blur-3xl -z-10"></div>
      
      <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
          <i className="fa-solid fa-plus"></i>
        </div>
        Submit New Feedback
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Subject</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium"
            placeholder="What should we improve?"
            disabled={isSubmitting}
            required
          />
        </div>
        
        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Details</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border border-gray-100 bg-gray-50/50 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:bg-white transition-all outline-none font-medium resize-none"
            rows={4}
            placeholder="Provide context or explain the problem..."
            disabled={isSubmitting}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">Visual Context</label>
          <div className="mt-2">
            {screenshots.length === 0 ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2 group"
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-camera text-2xl group-hover:scale-110 transition-transform"></i>
                <span className="text-sm font-bold">Attach Screenshot</span>
                <span className="text-xs font-medium opacity-60">Add images to help illustrate your feedback</span>
              </button>
            ) : (
              <div className="w-full">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {screenshots.map((screenshot, index) => (
                    <div 
                      key={index}
                      className="relative group rounded-xl overflow-hidden aspect-video bg-gray-100"
                    >
                      <img 
                        src={screenshot} 
                        alt={`Screenshot ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                      <button
                        type="button"
                        onClick={() => removeScreenshot(index)}
                        className="absolute top-1.5 right-1.5 bg-white/90 text-red-500 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-50"
                      >
                        <i className="fa-solid fa-times"></i>
                      </button>
                    </div>
                  ))}
                  {screenshots.length < 4 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-video rounded-xl border-2 border-dashed border-indigo-300 text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-1 group"
                      disabled={isSubmitting}
                    >
                      <i className="fa-solid fa-plus text-lg group-hover:scale-110 transition-transform"></i>
                      <span className="text-xs font-bold">Add</span>
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 border-2 border-dashed border-indigo-300 rounded-xl text-indigo-500 hover:border-indigo-500 hover:bg-indigo-50 transition-all flex items-center gap-2 text-sm font-bold"
                    disabled={isSubmitting}
                  >
                    <i className="fa-solid fa-plus"></i>
                    Add More
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScreenshots([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2 border-2 border-gray-200 rounded-xl text-gray-400 hover:border-red-400 hover:text-red-500 hover:bg-red-50 transition-all flex items-center gap-2 text-sm font-bold"
                    disabled={isSubmitting}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                    Clear All
                  </button>
                </div>
                {screenshots.length > 0 && (
                  <p className="text-xs text-gray-400 mt-2 font-medium">
                    {screenshots.length} image{screenshots.length !== 1 ? 's' : ''} attached
                  </p>
                )}
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              multiple
              className="hidden"
            />
          </div>
        </div>

        {/* AI Summary Display */}
        {aiSummary && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-r-lg animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-green-700 text-xs font-black uppercase tracking-wider mb-2">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              AI Summary
            </div>
            <p className="text-sm text-green-900/70 font-medium">{aiSummary}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={isAnalyzed ? handleSubmit : handleAIPostFeedback}
            disabled={isAnalyzing || isSubmitting || !title || !description || screenshots.length === 0}
            className={`flex-1 py-4 px-6 rounded-xl font-black transition-all flex items-center justify-center gap-3 tracking-widest uppercase text-sm ${
              isAnalyzing 
                ? 'bg-indigo-300 cursor-wait text-white' 
                : !title || !description || screenshots.length === 0
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : isAnalyzed
                    ? 'bg-green-500 hover:bg-green-600 active:scale-[0.98] shadow-lg shadow-green-200 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-200 text-white'
            }`}
          >
            {isAnalyzing ? (
              <>
                <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
                Analyzing...
              </>
            ) : isAnalyzed ? (
              <>
                <i className="fa-solid fa-check"></i>
                AI Post Feedback
              </>
            ) : (
              <>
                <i className="fa-solid fa-robot"></i>
                AI Post Feedback
              </>
            )}
          </button>
        </div>
        <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-wider">
          {isAnalyzed 
            ? 'Analysis complete - Ready to submit'
            : screenshots.length > 0 
              ? 'AI will analyze and summarize your feedback' 
              : 'Attach screenshots to enable AI analysis'}
        </p>
      </form>
    </div>
  );
};
