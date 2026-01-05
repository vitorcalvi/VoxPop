
import React from 'react';

interface Props {
  currentCategory: string;
  onCategoryChange: (category: string) => void;
  categories: string[];
}

export const Sidebar: React.FC<Props> = ({ currentCategory, onCategoryChange, categories }) => {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 pl-3">Filter by Category</h3>
        <div className="space-y-1">
          <button
            onClick={() => onCategoryChange('All')}
            className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
              currentCategory === 'All' 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'text-gray-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm'
            }`}
          >
            <span>All Feedback</span>
            <i className={`fa-solid fa-chevron-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${currentCategory === 'All' ? 'opacity-100' : ''}`}></i>
          </button>
          
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className={`w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-between group ${
                currentCategory === cat 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                  : 'text-gray-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm'
              }`}
            >
              <span>{cat}</span>
              <i className={`fa-solid fa-chevron-right text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${currentCategory === cat ? 'opacity-100' : ''}`}></i>
            </button>
          ))}
        </div>
      </div>

      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative p-5 bg-white border border-indigo-50 rounded-2xl">
          <h4 className="font-black text-xs text-indigo-600 uppercase tracking-widest mb-2 flex items-center gap-2">
            <i className="fa-solid fa-bolt"></i>
            Multimodal AI
          </h4>
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
            Upload screenshots to help Gemini identify bugs and UI patterns instantly.
          </p>
        </div>
      </div>
    </div>
  );
};
