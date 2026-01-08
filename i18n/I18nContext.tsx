import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Language, LANGUAGES, LanguageInfo } from './types';

// Import translations
import enTranslations from './locales/en.json';
import esTranslations from './locales/es.json';
import ptTranslations from './locales/pt.json';

type TranslationsType = typeof enTranslations;

const translations: Record<Language, TranslationsType> = {
  en: enTranslations,
  es: esTranslations,
  pt: ptTranslations
};

interface I18nContextType {
  language: Language;
  languageInfo: LanguageInfo;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string, options?: Intl.DateTimeFormatOptions) => string;
  formatRelativeTime: (date: Date | string) => string;
  formatCurrency: (amount: number, currencyOverride?: string) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'voxpop_language';

// Function to update OG meta tags
const updateMetaTags = (lang: Language) => {
  const baseUrl = window.location.origin;
  const ogImageUrl = `${baseUrl}/api/og?lang=${lang}`;

  // Update OG image
  const ogImage = document.querySelector('meta[property="og:image"]');
  const twitterImage = document.querySelector('meta[name="twitter:image"]');
  if (ogImage) ogImage.setAttribute('content', ogImageUrl);
  if (twitterImage) twitterImage.setAttribute('content', ogImageUrl);
};

// Get nested value from object using dot notation
const getNestedValue = (obj: any, path: string): string => {
  const keys = path.split('.');
  let value = obj;

  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return path; // Return the key if not found
    }
  }

  return typeof value === 'string' ? value : path;
};

// Detect browser language
const detectBrowserLanguage = (): Language => {
  if (typeof navigator === 'undefined') return 'en';

  const browserLang = navigator.language.toLowerCase();

  if (browserLang.startsWith('es')) return 'es';
  if (browserLang.startsWith('pt')) return 'pt';
  return 'en';
};

// Get initial language
const getInitialLanguage = (): Language => {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (stored && stored in LANGUAGES) {
      return stored;
    }
  }
  return detectBrowserLanguage();
};

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // Persist language choice
  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
    updateMetaTags(lang);
  }, []);

  // Set document language on mount and update meta tags
  useEffect(() => {
    document.documentElement.lang = language;
    updateMetaTags(language);
  }, [language]);

  // Translation function with parameter interpolation
  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let text = getNestedValue(translations[language], key);

    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), String(value));
      });
    }

    return text;
  }, [language]);

  // Date formatting
  const formatDate = useCallback((date: Date | string, options?: Intl.DateTimeFormatOptions): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };

    return new Intl.DateTimeFormat(LANGUAGES[language].dateLocale, defaultOptions).format(dateObj);
  }, [language]);

  // Relative time formatting
  const formatRelativeTime = useCallback((date: Date | string): string => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);

    if (diffSecs < 60) {
      return t('datetime.justNow');
    } else if (diffMins < 60) {
      return t('datetime.minutesAgo', { count: diffMins });
    } else if (diffHours < 24) {
      return t('datetime.hoursAgo', { count: diffHours });
    } else if (diffDays === 0) {
      return t('datetime.today');
    } else if (diffDays === 1) {
      return t('datetime.yesterday');
    } else if (diffDays < 7) {
      return t('datetime.daysAgo', { count: diffDays });
    } else if (diffWeeks < 4) {
      return t('datetime.weeksAgo', { count: diffWeeks });
    } else {
      return t('datetime.monthsAgo', { count: diffMonths });
    }
  }, [language, t]);

  // Currency formatting
  const formatCurrency = useCallback((amount: number, currencyOverride?: string): string => {
    const currency = currencyOverride || LANGUAGES[language].currencyCode;

    return new Intl.NumberFormat(LANGUAGES[language].dateLocale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }, [language]);

  // Number formatting
  const formatNumber = useCallback((num: number, options?: Intl.NumberFormatOptions): string => {
    return new Intl.NumberFormat(LANGUAGES[language].dateLocale, options).format(num);
  }, [language]);

  const languageInfo = useMemo(() => LANGUAGES[language], [language]);

  const contextValue = useMemo(() => ({
    language,
    languageInfo,
    setLanguage,
    t,
    formatDate,
    formatRelativeTime,
    formatCurrency,
    formatNumber
  }), [language, languageInfo, setLanguage, t, formatDate, formatRelativeTime, formatCurrency, formatNumber]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
};

// Hook to use i18n
export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

// Hook for just translations (lighter weight)
export const useTranslation = () => {
  const { t, language } = useI18n();
  return { t, language };
};

// Hook for formatting functions
export const useFormatters = () => {
  const { formatDate, formatRelativeTime, formatCurrency, formatNumber, language } = useI18n();
  return { formatDate, formatRelativeTime, formatCurrency, formatNumber, language };
};

export { LANGUAGES, type Language };
