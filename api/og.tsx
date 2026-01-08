import { ImageResponse } from '@vercel/og';

// Import translations
import enTranslations from '../i18n/locales/en.json';
import esTranslations from '../i18n/locales/es.json';
import ptTranslations from '../i18n/locales/pt.json';

// Edge runtime is required for @vercel/og
export const config = {
  runtime: 'edge',
};

type Language = 'en' | 'es' | 'pt';

const translations = {
  en: enTranslations,
  es: esTranslations,
  pt: ptTranslations,
};

export default async function handler(req: Request) {
  // Parse URL to get language parameter
  const { searchParams } = new URL(req.url);
  const langParam = searchParams.get('lang') || 'en';

  // Validate and set language
  const lang: Language = ['en', 'es', 'pt'].includes(langParam)
    ? (langParam as Language)
    : 'en';

  const t = translations[lang];

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '1200px',
          height: '630px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          padding: '60px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header Section */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: '40px',
          }}
        >
          {/* Logo/Icon */}
          <div
            style={{
              fontSize: '80px',
              marginBottom: '20px',
            }}
          >
            💬
          </div>

          {/* Title */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              margin: '0',
              textAlign: 'center',
              textShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            VoxPop
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontSize: '32px',
              margin: '10px 0 0 0',
              opacity: 0.95,
              textAlign: 'center',
            }}
          >
            {t.metadata.subtitle}
          </p>
        </div>

        {/* Divider */}
        <div
          style={{
            width: '200px',
            height: '4px',
            background: 'rgba(255, 255, 255, 0.5)',
            borderRadius: '2px',
            margin: '30px 0',
          }}
        />

        {/* Description */}
        <p
          style={{
            fontSize: '28px',
            textAlign: 'center',
            maxWidth: '900px',
            lineHeight: 1.4,
            opacity: 0.95,
          }}
        >
          {t.metadata.description}
        </p>

        {/* Footer/CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginTop: '50px',
            padding: '20px 40px',
            background: 'rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <span
            style={{
              fontSize: '24px',
              fontWeight: '600',
            }}
          >
            {t.metadata.cta}
          </span>
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: 'absolute',
            top: '40px',
            left: '40px',
            fontSize: '40px',
            opacity: 0.3,
          }}
        >
          ⭐
        </div>
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '60px',
            fontSize: '30px',
            opacity: 0.3,
          }}
        >
          🎯
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            left: '60px',
            fontSize: '35px',
            opacity: 0.3,
          }}
        >
          🚀
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            right: '50px',
            fontSize: '45px',
            opacity: 0.3,
          }}
        >
          💡
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
