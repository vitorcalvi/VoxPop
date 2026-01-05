
import React, { useState, useRef } from 'react';
import { analyzeFeedback } from '../services/geminiService';
import { FeedbackItem } from '../types';

interface Props {
  onAdd: (feedback: FeedbackItem) => void;
}

export const FeedbackForm: React.FC<Props> = ({ onAdd }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || isSubmitting) return;

    setIsSubmitting(true);
    
    // Multi-modal analysis
    const analysis = await analyzeFeedback(title, description, screenshot || undefined);

    const newFeedback: FeedbackItem = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      description,
      category: analysis?.category || 'General',
      votes: 1,
      status: 'open',
      createdAt: Date.now(),
      sentiment: analysis?.sentiment as any,
      aiInsight: analysis?.aiInsight,
      screenshot: screenshot || undefined
    };

    onAdd(newFeedback);
    setTitle('');
    setDescription('');
    setScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setIsSubmitting(false);
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
          <div className="mt-2 flex flex-wrap gap-4 items-end">
            {!screenshot ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-indigo-400 hover:text-indigo-500 hover:bg-indigo-50/50 transition-all flex flex-col items-center justify-center gap-2 group"
                disabled={isSubmitting}
              >
                <i className="fa-solid fa-camera text-2xl group-hover:scale-110 transition-transform"></i>
                <span className="text-sm font-bold">Attach Screenshot</span>
              </button>
            ) : (
              <div className="relative group w-32 h-20">
                <img 
                  src={screenshot} 
                  alt="Preview" 
                  className="w-full h-full object-cover rounded-xl border-2 border-indigo-100 shadow-sm"
                />
                <button
                  type="button"
                  onClick={removeScreenshot}
                  className="absolute -top-2 -right-2 bg-white text-red-500 w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg border border-red-50 hover:bg-red-50 transition-colors"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-4 px-6 rounded-xl font-black text-white transition-all flex items-center justify-center gap-3 tracking-widest uppercase text-sm ${
            isSubmitting ? 'bg-indigo-300 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-lg shadow-indigo-200'
          }`}
        >
          {isSubmitting ? (
            <>
              <i className="fa-solid fa-wand-magic-sparkles animate-pulse"></i>
              AI is analyzing...
            </>
          ) : (
            <>
              <i className="fa-solid fa-paper-plane"></i>
              Post Feedback
            </>
          )}
        </button>
        <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-wider">
          Gemini AI will categorize and tag your feedback
        </p>
      </form>
    </div>
  );
};
