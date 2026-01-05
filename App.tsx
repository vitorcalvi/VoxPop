
import React, { useState, useEffect, useMemo } from 'react';
import { FeedbackForm } from './components/FeedbackForm';
import { FeedbackCard } from './components/FeedbackCard';
import { Sidebar } from './components/Sidebar';
import { FeedbackItem } from './types';
import { generateRoadmapSummary } from './services/geminiService';

const INITIAL_DATA: FeedbackItem[] = [
  {
    id: '1',
    title: 'Visual Dark Mode Support',
    description: 'The app is too bright at night. Can we get a dark mode option?',
    category: 'UI/UX',
    votes: 42,
    status: 'planned',
    createdAt: Date.now() - 86400000 * 5,
    sentiment: 'neutral',
    aiInsight: 'High user demand for visual ergonomics.'
  },
  {
    id: '2',
    title: 'Mobile App Navigation bug',
    description: 'The sidebar menu overlaps the content on smaller screens. See attached!',
    category: 'Mobile',
    votes: 89,
    status: 'in-progress',
    createdAt: Date.now() - 86400000 * 10,
    sentiment: 'negative',
    aiInsight: 'Critical layout issue affecting mobile user retention.'
  }
];

const App: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => {
    const saved = localStorage.getItem('voxpop_feedback_v2');
    return saved ? JSON.parse(saved) : INITIAL_DATA;
  });
  
  const [votedIds, setVotedIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('voxpop_votes_v2');
    return saved ? JSON.parse(saved) : [];
  });

  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [roadmapSummary, setRoadmapSummary] = useState<string | null>(null);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);

  useEffect(() => {
    localStorage.setItem('voxpop_feedback_v2', JSON.stringify(feedbacks));
  }, [feedbacks]);

  useEffect(() => {
    localStorage.setItem('voxpop_votes_v2', JSON.stringify(votedIds));
  }, [votedIds]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(feedbacks.map(f => f.category)));
    return cats;
  }, [feedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return feedbacks
      .filter(f => filter === 'All' || f.category === filter)
      .filter(f => 
        f.title.toLowerCase().includes(search.toLowerCase()) || 
        f.description.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a, b) => b.votes - a.votes);
  }, [feedbacks, filter, search]);

  const handleAddFeedback = (newFeedback: FeedbackItem) => {
    setFeedbacks(prev => [newFeedback, ...prev]);
  };

  const handleVote = (id: string) => {
    if (votedIds.includes(id)) {
      setVotedIds(prev => prev.filter(vId => vId !== id));
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, votes: f.votes - 1 } : f));
    } else {
      setVotedIds(prev => [...prev, id]);
      setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, votes: f.votes + 1 } : f));
    }
  };

  const handleGenerateRoadmap = async () => {
    if (feedbacks.length === 0) return;
    setIsGeneratingRoadmap(true);
    const summary = await generateRoadmapSummary(feedbacks);
    setRoadmapSummary(summary);
    setIsGeneratingRoadmap(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] selection:bg-indigo-100">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 rotate-3 group-hover:rotate-0 transition-transform">
              V
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-gray-900 leading-none">VoxPop</h1>
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">AI Feedback</span>
            </div>
          </div>
          
          <div className="flex-1 max-w-lg mx-12 hidden md:block">
            <div className="relative group">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors"></i>
              <input
                type="text"
                placeholder="Search feedback..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-100/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-100 transition-all outline-none font-medium text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end mr-2">
                <span className="text-xs font-bold text-gray-900">Admin Panel</span>
                <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Online</span>
             </div>
             <div className="w-10 h-10 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors cursor-pointer">
                <i className="fa-solid fa-cog"></i>
             </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          
          {/* Sidebar */}
          <aside className="lg:col-span-3 lg:sticky lg:top-32 h-fit">
            <Sidebar 
              categories={categories} 
              currentCategory={filter} 
              onCategoryChange={setFilter} 
            />
            
            <div className="mt-8 pt-8 border-t border-gray-100">
              <button 
                onClick={handleGenerateRoadmap}
                disabled={isGeneratingRoadmap || feedbacks.length === 0}
                className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-white border border-indigo-100 text-indigo-700 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-indigo-50 hover:shadow-xl hover:shadow-indigo-100 transition-all disabled:opacity-50 group"
              >
                {isGeneratingRoadmap ? (
                  <i className="fa-solid fa-spinner animate-spin"></i>
                ) : (
                  <i className="fa-solid fa-compass group-hover:rotate-45 transition-transform"></i>
                )}
                AI Roadmap Vision
              </button>
            </div>
          </aside>

          {/* Feed Container */}
          <div className="lg:col-span-5 space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-1">
                  {filter === 'All' ? 'Latest Feedback' : filter}
                </h2>
                <p className="text-sm font-bold text-gray-400">Showing {filteredFeedbacks.length} community suggestions</p>
              </div>
            </div>

            {roadmapSummary && (
              <div className="bg-gradient-to-br from-indigo-700 to-indigo-900 text-white rounded-3xl p-8 relative overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <i className="fa-solid fa-wand-sparkles text-[120px] -rotate-12"></i>
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <i className="fa-solid fa-star"></i>
                      </div>
                      <h3 className="font-black text-lg tracking-tight">AI Strategy Roadmap</h3>
                    </div>
                    <button onClick={() => setRoadmapSummary(null)} className="w-8 h-8 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center">
                      <i className="fa-solid fa-times"></i>
                    </button>
                  </div>
                  <div className="text-sm text-indigo-100 space-y-4 font-medium leading-relaxed">
                    {roadmapSummary.split('\n').map((line, i) => (
                      <p key={i} className={line.startsWith('-') ? 'pl-4 relative before:content-["•"] before:absolute before:left-0' : ''}>
                        {line.replace(/^- /, '')}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {filteredFeedbacks.length > 0 ? (
                filteredFeedbacks.map(f => (
                  <FeedbackCard 
                    key={f.id} 
                    feedback={f} 
                    hasVoted={votedIds.includes(f.id)}
                    onVote={handleVote}
                  />
                ))
              ) : (
                <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                  <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <i className="fa-solid fa-folder-open text-3xl text-gray-200"></i>
                  </div>
                  <h3 className="text-xl font-bold text-gray-400">Nothing here yet</h3>
                  <p className="text-sm text-gray-300 font-medium">Be the first to suggest an improvement!</p>
                </div>
              )}
            </div>
          </div>

          {/* Form Area */}
          <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit">
            <FeedbackForm onAdd={handleAddFeedback} />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
