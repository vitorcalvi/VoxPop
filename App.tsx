import React, { useState, useEffect, useMemo } from 'react';
import { FeedbackForm } from './components/FeedbackForm';
import { FeedbackCard } from './components/FeedbackCard';
import { FeedbackModal } from './components/FeedbackModal';
import { Sidebar } from './components/Sidebar';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { I18nProvider, useI18n } from './i18n';
import { FeedbackItem } from './types';

const INITIAL_DATA: FeedbackItem[] = [];

// API helper function
const getApiBase = () => '/api';

const AppContent: React.FC = () => {
  const { t } = useI18n();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(INITIAL_DATA);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [roadmapSummary, setRoadmapSummary] = useState<string | null>(null);
  const [isGeneratingRoadmap, setIsGeneratingRoadmap] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>(() => {
    const role = localStorage.getItem('voxpop_user_role') as 'user' | 'admin';
    return role || 'user';
  });

  // Generate a simple user ID for this browser session
  const userId = useMemo(() => {
    let id = localStorage.getItem('voxpop_user_id');
    if (!id) {
      id = Math.random().toString(36).substr(2, 9);
      localStorage.setItem('voxpop_user_id', id);
    }
    return id;
  }, []);

  // Toggle user role for demo purposes
  const toggleUserRole = () => {
    const newRole = userRole === 'user' ? 'admin' : 'user';
    setUserRole(newRole);
    localStorage.setItem('voxpop_user_role', newRole);
  };

  // Fetch feedbacks on mount and when filter/search changes
  useEffect(() => {
    fetchFeedbacks();
    fetchUserVotes();
  }, [filter, search]);

  const fetchUserVotes = async () => {
    try {
      const response = await fetch(`${getApiBase()}/user/votes/${userId}`);
      if (response.ok) {
        const votedFeedbackIds = await response.json();
        setVotedIds(votedFeedbackIds);
      }
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  };

  const fetchFeedbacks = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const params = new URLSearchParams();
      if (filter !== 'All') params.append('category', filter);
      if (search) params.append('search', search);

      const response = await fetch(`${getApiBase()}/feedback?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setFeedbacks(data);

      setVotedIds(prev => {
        const newVotedIds = [...prev];
        data.forEach((item: FeedbackItem) => {
          if (!newVotedIds.includes(item.id) && item.votes > 0) {
          }
        });
        return newVotedIds;
      });
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
      setErrorMessage(t('errors.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const categories = useMemo(() => {
    const cats = Array.from(new Set(feedbacks.map(f => f.category)));
    return cats;
  }, [feedbacks]);

  const handleAddFeedback = async (newFeedback: FeedbackItem) => {
    try {
      const createResponse = await fetch(`${getApiBase()}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newFeedback.title,
          description: newFeedback.description,
          category: 'General',
          sentiment: 'neutral',
          aiInsight: 'Feedback submitted with AI analysis.',
          screenshots: newFeedback.screenshots,
          status: 'open'
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Create failed: ${createResponse.status}`);
      }

      const created = await createResponse.json();

      setFeedbacks(prev => [created, ...prev]);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error adding feedback:', error);
      setErrorMessage(t('errors.submitFailed'));
      throw error;
    }
  };

  const handleVote = async (id: string) => {
    const hasVoted = votedIds.includes(id);

    try {
      const response = await fetch(`${getApiBase()}/feedback/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          vote: !hasVoted
        })
      });

      if (!response.ok) {
        throw new Error(`Vote failed: ${response.status}`);
      }

      const updated = await response.json();

      setVotedIds(prev =>
        hasVoted ? prev.filter(vId => vId !== id) : [...prev, id]
      );
      setFeedbacks(prev =>
        prev.map(f => f.id === id ? updated : f)
      );
      setErrorMessage(null);
    } catch (error) {
      console.error('Error voting:', error);
      setErrorMessage(t('errors.voteFailed'));
    }
  };

  const handleGenerateRoadmap = async () => {
    if (feedbacks.length === 0) return;
    setIsGeneratingRoadmap(true);
    setErrorMessage(null);

    try {
      const optimizedFeedbacks = feedbacks.map(f => ({
        id: f.id,
        title: f.title,
        category: f.category,
        votes: f.votes,
        sentiment: f.sentiment,
        aiInsight: f.aiInsight ? f.aiInsight.substring(0, 200) : undefined
      }));

      const response = await fetch(`${getApiBase()}/roadmap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks: optimizedFeedbacks })
      });

      if (!response.ok) {
        if (response.status === 413) {
          throw new Error('Payload too large. Try reducing the number of feedback items.');
        }
        throw new Error(`Roadmap generation failed: ${response.status}`);
      }

      const data = await response.json();
      setRoadmapSummary(data.summary);
    } catch (error) {
      console.error('Error generating roadmap:', error);
      setErrorMessage(t('errors.roadmapFailed'));
    } finally {
      setIsGeneratingRoadmap(false);
    }
  };

  const handleDismissError = () => {
    setErrorMessage(null);
  };

  const handleCardClick = (feedback: FeedbackItem) => {
    setSelectedFeedback(feedback);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedFeedback(null);
  };

  const handleUpdateFeedback = async (updated: FeedbackItem) => {
    try {
      const response = await fetch(`${getApiBase()}/feedback/${updated.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updated.title,
          description: updated.description,
          category: updated.category,
          status: updated.status,
          sentiment: updated.sentiment,
          aiInsight: updated.aiInsight
        })
      });

      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`);
      }

      const savedFeedback = await response.json();
      setFeedbacks(prev => prev.map(f => f.id === savedFeedback.id ? savedFeedback : f));
      setSelectedFeedback(savedFeedback);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error updating feedback:', error);
      setErrorMessage(t('errors.updateFailed'));
      throw error;
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    try {
      const response = await fetch(`${getApiBase()}/feedback/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
      }

      setFeedbacks(prev => prev.filter(f => f.id !== id));
      setIsModalOpen(false);
      setSelectedFeedback(null);
      setErrorMessage(null);
    } catch (error) {
      console.error('Error deleting feedback:', error);
      setErrorMessage(t('errors.deleteFailed'));
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] selection:bg-indigo-100">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => window.location.reload()}>
            <img
              src="https://www.dyagnosys.com/logo.webp"
              alt="Dyagnosys"
              className="w-10 h-10 rounded-lg object-contain transition-transform group-hover:scale-105"
            />
          </div>

          <div className="flex-1 max-w-lg mx-12 hidden md:block">
            <div className="relative group">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-indigo-500 transition-colors"></i>
              <input
                type="text"
                placeholder={t('nav.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-gray-100/50 border-2 border-transparent rounded-2xl focus:bg-white focus:border-indigo-100 transition-all outline-none font-medium text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
             {/* Language Switcher */}
             <LanguageSwitcher variant="dropdown" showLabel={true} />
             <button
               onClick={toggleUserRole}
               className="w-10 h-10 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 hover:bg-indigo-200 hover:text-indigo-700 transition-colors cursor-pointer"
               title={`Current role: ${userRole === 'admin' ? 'Admin' : 'User'} (Click to toggle)`}
             >
               <i className={`fa-solid ${userRole === 'admin' ? 'fa-user-shield' : 'fa-user'}`}></i>
             </button>
          </div>
        </div>
      </nav>

      {/* Error Banner */}
      {errorMessage && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <i className="fa-solid fa-circle-exclamation text-red-500"></i>
              <span className="text-sm font-bold text-red-700">{errorMessage}</span>
            </div>
            <button
              onClick={handleDismissError}
              className="text-red-500 hover:text-red-700 transition-colors"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 pt-10 pb-20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <i className="fa-solid fa-spinner fa-spin text-4xl text-indigo-600"></i>
            <span className="text-sm font-medium text-gray-500">{t('common.loading')}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Sidebar */}
            <aside className="lg:col-span-3 lg:sticky lg:top-32 h-fit">
              <Sidebar
                categories={categories}
                currentCategory={filter}
                onCategoryChange={setFilter}
              />

              <div className="mt-8 pt-8 border-t border-gray-100">
                <div className="relative group">
                  <button
                    onClick={userRole === 'admin' ? handleGenerateRoadmap : undefined}
                    disabled={userRole !== 'admin' || isGeneratingRoadmap || feedbacks.length === 0}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 border text-xs font-black uppercase tracking-widest transition-all group ${
                      userRole === 'admin'
                        ? 'bg-white border-indigo-100 text-indigo-700 rounded-2xl hover:bg-indigo-50 hover:shadow-xl hover:shadow-indigo-100'
                        : 'bg-gray-50 border-gray-200 text-gray-400 rounded-xl cursor-not-allowed'
                    } ${isGeneratingRoadmap ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    {isGeneratingRoadmap ? (
                      <i className="fa-solid fa-spinner animate-spin"></i>
                    ) : (
                      <i className={`fa-solid fa-compass ${userRole === 'admin' ? 'group-hover:rotate-45' : ''} transition-transform`}></i>
                    )}
                    {t('sidebar.aiRoadmapVision')}
                  </button>
                  {userRole !== 'admin' && (
                    <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 px-3 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                      Access Restricted: Administrator privileges required.
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                    </div>
                  )}
                </div>
              </div>
            </aside>

            {/* Feed Container */}
            <div className="lg:col-span-5 space-y-8 relative z-0">
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 mb-1">
                    {filter === 'All' ? t('feedbackList.latestFeedback') : filter}
                  </h2>
                  <p className="text-sm font-bold text-gray-400">
                    {t('feedbackList.showingCount', { count: feedbacks.length })}
                  </p>
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
                        <h3 className="font-black text-lg tracking-tight">{t('roadmap.aiStrategyRoadmap')}</h3>
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
                {feedbacks.length > 0 ? (
                  feedbacks.map(f => (
                    <FeedbackCard
                      key={f.id}
                      feedback={f}
                      hasVoted={votedIds.includes(f.id)}
                      onVote={handleVote}
                      onClick={handleCardClick}
                    />
                  ))
                ) : (
                  <div className="text-center py-32 bg-white rounded-3xl border-2 border-dashed border-gray-100">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                      <i className="fa-solid fa-folder-open text-3xl text-gray-200"></i>
                    </div>
                    <h3 className="text-xl font-bold text-gray-400">{t('feedbackList.nothingYet')}</h3>
                    <p className="text-sm text-gray-300 font-medium">{t('feedbackList.beFirst')}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Form Area */}
            <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit relative z-10">
              <FeedbackForm onAdd={handleAddFeedback} />
            </div>
          </div>
        )}
      </main>

      {/* Feedback Modal */}
      <FeedbackModal
        feedback={selectedFeedback}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleUpdateFeedback}
        onDelete={handleDeleteFeedback}
      />
    </div>
  );
};

// Main App component with I18nProvider
const App: React.FC = () => {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
};

export default App;
