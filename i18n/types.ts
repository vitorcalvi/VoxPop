// Internationalization Types

export type Language = 'en' | 'es' | 'pt';

export interface LanguageInfo {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  dateLocale: string;
  currencyCode: string;
  currencySymbol: string;
}

export const LANGUAGES: Record<Language, LanguageInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    dateLocale: 'en-US',
    currencyCode: 'USD',
    currencySymbol: '$'
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    dateLocale: 'es-ES',
    currencyCode: 'EUR',
    currencySymbol: '€'
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    dateLocale: 'pt-BR',
    currencyCode: 'BRL',
    currencySymbol: 'R$'
  }
};

// Translation keys structure
export interface TranslationKeys {
  // Common
  common: {
    loading: string;
    error: string;
    success: string;
    cancel: string;
    save: string;
    delete: string;
    edit: string;
    close: string;
    search: string;
    filter: string;
    all: string;
    yes: string;
    no: string;
    confirm: string;
    retry: string;
  };

  // Navigation
  nav: {
    adminPanel: string;
    online: string;
    searchPlaceholder: string;
    settings: string;
  };

  // Sidebar
  sidebar: {
    filterByCategory: string;
    allFeedback: string;
    multimodalAI: string;
    multimodalDescription: string;
    aiRoadmapVision: string;
  };

  // Categories
  categories: {
    all: string;
    general: string;
    feature: string;
    bug: string;
    uiux: string;
    performance: string;
    security: string;
    documentation: string;
  };

  // Status
  status: {
    open: string;
    planned: string;
    inProgress: string;
    completed: string;
    closed: string;
  };

  // Sentiment
  sentiment: {
    positive: string;
    neutral: string;
    negative: string;
  };

  // Priority
  priority: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };

  // Feedback Form
  feedbackForm: {
    title: string;
    subjectLabel: string;
    subjectPlaceholder: string;
    detailsLabel: string;
    detailsPlaceholder: string;
    visualContextLabel: string;
    attachScreenshot: string;
    attachDescription: string;
    addMore: string;
    clearAll: string;
    imagesAttached: string;
    imageAttached: string;
    aiPostFeedback: string;
    analyzing: string;
    analysisComplete: string;
    attachScreenshotsToEnable: string;
    aiWillAnalyze: string;
  };

  // AI Analysis
  aiAnalysis: {
    inProgress: string;
    initializing: string;
    analyzingText: string;
    processingImages: string;
    generatingInsights: string;
    finalizing: string;
    preparingSummary: string;
    summaryComplete: string;
    aiInsight: string;
    aiAnalyze: string;
    applyAIChanges: string;
    changesApplied: string;
    analysisEnhanced: string;
  };

  // Feedback List
  feedbackList: {
    latestFeedback: string;
    showingCount: string;
    nothingYet: string;
    beFirst: string;
    votes: string;
  };

  // Feedback Modal
  feedbackModal: {
    feedbackDetails: string;
    id: string;
    created: string;
    confirmDelete: string;
  };

  // Roadmap
  roadmap: {
    aiStrategyRoadmap: string;
    generatingRoadmap: string;
    roadmapFailed: string;
  };

  // Errors
  errors: {
    loadFailed: string;
    submitFailed: string;
    voteFailed: string;
    updateFailed: string;
    deleteFailed: string;
    analysisFailed: string;
    analysisCancelled: string;
    roadmapFailed: string;
    tryAgain: string;
  };

  // Date/Time
  datetime: {
    today: string;
    yesterday: string;
    daysAgo: string;
    weeksAgo: string;
    monthsAgo: string;
    justNow: string;
    minutesAgo: string;
    hoursAgo: string;
  };

  // Metadata for SEO and OG
  metadata: {
    title: string;
    subtitle: string;
    description: string;
    cta: string;
  };
}
