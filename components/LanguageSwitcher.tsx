import React, { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGES, Language } from '../i18n';

interface Props {
  variant?: 'dropdown' | 'buttons' | 'compact';
  showLabel?: boolean;
}

export const LanguageSwitcher: React.FC<Props> = ({ variant = 'dropdown', showLabel = true }) => {
  const { language, setLanguage, languageInfo } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Dropdown variant
  if (variant === 'dropdown') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors text-sm font-medium"
          aria-label="Select language"
          aria-expanded={isOpen}
        >
          <span className="text-lg">{languageInfo.flag}</span>
          {showLabel && (
            <span className="hidden sm:inline text-gray-700">{languageInfo.nativeName}</span>
          )}
          <i className={`fa-solid fa-chevron-down text-xs text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
            {(Object.keys(LANGUAGES) as Language[]).map((lang) => {
              const info = LANGUAGES[lang];
              const isSelected = lang === language;

              return (
                <button
                  key={lang}
                  onClick={() => {
                    setLanguage(lang);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className="text-xl">{info.flag}</span>
                  <div className="flex-1">
                    <div className="font-medium">{info.nativeName}</div>
                    <div className="text-xs text-gray-400">{info.name}</div>
                  </div>
                  {isSelected && (
                    <i className="fa-solid fa-check text-indigo-600"></i>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Buttons variant (inline)
  if (variant === 'buttons') {
    return (
      <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
        {(Object.keys(LANGUAGES) as Language[]).map((lang) => {
          const info = LANGUAGES[lang];
          const isSelected = lang === language;

          return (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                isSelected
                  ? 'bg-white text-indigo-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title={info.name}
            >
              <span>{info.flag}</span>
              {showLabel && <span className="hidden md:inline">{info.code.toUpperCase()}</span>}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant (just flags)
  return (
    <div className="flex items-center gap-0.5">
      {(Object.keys(LANGUAGES) as Language[]).map((lang) => {
        const info = LANGUAGES[lang];
        const isSelected = lang === language;

        return (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg text-lg transition-all ${
              isSelected
                ? 'bg-indigo-100 ring-2 ring-indigo-500'
                : 'hover:bg-gray-100 opacity-60 hover:opacity-100'
            }`}
            title={`${info.nativeName} (${info.name})`}
          >
            {info.flag}
          </button>
        );
      })}
    </div>
  );
};
