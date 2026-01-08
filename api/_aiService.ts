// Multi-Provider AI Service (GitHub Models + Groq API)
// GitHub Models API: https://docs.github.com/en/rest/ai/using-github-models
// Groq API: https://console.groq.com/docs/quickstart
// Provider routing for optimal task performance and cost

const isProduction = process.env.NODE_ENV === 'production';

const log = (...args: any[]) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const logError = (...args: any[]) => {
  if (isProduction) {
    console.error(...args);
  } else {
    console.error(...args);
  }
};

const logWarn = (...args: any[]) => {
  if (isProduction) {
    console.warn(...args);
  } else {
    console.warn(...args);
  }
};

const LANGUAGE_NAMES: Record<string, string> = {
  'en': 'English',
  'es': 'Spanish',
  'pt': 'Portuguese'
};

const getLanguageInstruction = (language: string = 'en'): string => {
  const langName = LANGUAGE_NAMES[language] || 'English';
  return `You MUST respond in ${langName}. All output including category names, insights, and any text must be in ${langName}.`;
};

export interface AIAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}

export interface ImageAnalysisResult {
  subject: string;
  details: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}

export interface DetailedSummary {
  summary: string;
  enhancedSubject: string;
  enhancedDetails: string;
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  aiInsight: string;
  technicalAnalysis?: string;
  visualAnalysis?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  suggestedActions: string[];
  affectedComponents: string[];
  reproducibility: string;
}

// GitHub Models Configuration
const GITHUB_API_URL = 'https://models.github.ai/inference/chat/completions';

const GITHUB_MODELS = {
  // GPT-4o - Vision capable, good for general tasks
  VISION: 'gpt-4o',
  
  // GPT-4o-mini - Fast, cost-effective for general tasks
  REASONING: 'gpt-4o-mini',
  
  // GPT-4o-mini - Good for all tasks
  GENERAL: 'gpt-4o-mini',
  
  // GPT-4o - Good for code analysis
  CODER: 'gpt-4o'
};

// Groq API Configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const GROQ_MODELS = {
  // Llama 3.3 70B - Fast, capable
  FAST_GENERAL: 'llama-3.3-70b-versatile',
  
  // Mixtral 8x7B - Very fast, good for simple tasks
  ULTRA_FAST: 'mixtral-8x7b-32768',
  
  // Llama 3.1 70B - Balanced
  BALANCED: 'llama-3.1-70b-versatile'
};

// Provider types
type Provider = 'github' | 'groq';

// API key retrieval
export const getGitHubToken = (): string | null => {
  const token = process.env.GITHUB_TOKEN || null;
  log('🔑 GitHub token:', token ? 'Found' : 'Not configured');
  return token;
};

export const getGroqApiKey = (): string | null => {
  const apiKey = process.env.GROQ_API_KEY || null;
  log('🔑 Groq API key:', apiKey ? 'Found' : 'Not configured');
  return apiKey;
};

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

// Call GitHub Models API
const callGitHubAPI = async (
  messages: Message[],
  model: string,
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<string | null> => {
  const token = getGitHubToken();
  if (!token) {
    logWarn('⚠️ GITHUB_TOKEN not configured');
    return null;
  }

  try {
    log(`🤖 Calling GitHub Models API with model: ${model}`);

    const response = await fetch(GITHUB_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-GitHub-Api-Version': '2024-01-01'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    log(`📡 GitHub API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`❌ GitHub API error (${model}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    log('✅ GitHub API response received');
    const content = data.choices?.[0]?.message?.content || null;
    log(`📄 Content length: ${content?.length || 0} chars`);
    return content;
  } catch (error) {
    logError(`❌ GitHub API request failed (${model}):`, error);
    logError('Error details:', (error as Error).message);
    return null;
  }
};

// Call Groq API
const callGroqAPI = async (
  messages: Message[],
  model: string,
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<string | null> => {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    logWarn('⚠️ GROQ_API_KEY not configured');
    return null;
  }

  try {
    log(`🚀 Calling Groq API with model: ${model}`);

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature
      })
    });

    log(`📡 Groq API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`❌ Groq API error (${model}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    log('✅ Groq API response received');
    const content = data.choices?.[0]?.message?.content || null;
    log(`📄 Content length: ${content?.length || 0} chars`);
    return content;
  } catch (error) {
    logError(`❌ Groq API request failed (${model}):`, error);
    logError('Error details:', (error as Error).message);
    return null;
  }
};

// Smart provider routing based on task requirements
const callAI = async (
  messages: Message[],
  taskType: 'vision' | 'reasoning' | 'general' | 'coding',
  provider?: Provider,
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<string | null> => {
  // If provider is explicitly specified, use it
  if (provider === 'github') {
    return callGitHubAPI(messages, getGitHubModel(taskType), maxTokens, temperature);
  } else if (provider === 'groq') {
    return callGroqAPI(messages, getGroqModel(taskType), maxTokens, temperature);
  }

  // Auto-routing: prioritize GitHub for complex tasks, Groq for fast/general tasks
  const githubToken = getGitHubToken();
  const groqApiKey = getGroqApiKey();

  // For vision or complex reasoning, always prefer GitHub if available
  if ((taskType === 'vision' || taskType === 'reasoning') && githubToken) {
    log(`🎯 Routing to GitHub Models for ${taskType} task`);
    return callGitHubAPI(messages, getGitHubModel(taskType), maxTokens, temperature);
  }

  // For general tasks, prefer Groq for speed (if available)
  if (taskType === 'general' && groqApiKey) {
    log(`🎯 Routing to Groq for fast ${taskType} task`);
    return callGroqAPI(messages, getGroqModel(taskType), maxTokens, temperature);
  }

  // Fallback to available provider
  if (githubToken) {
    log(`🎯 Fallback to GitHub Models`);
    return callGitHubAPI(messages, getGitHubModel(taskType), maxTokens, temperature);
  } else if (groqApiKey) {
    log(`🎯 Fallback to Groq`);
    return callGroqAPI(messages, getGroqModel(taskType), maxTokens, temperature);
  }

  logWarn('⚠️ No AI provider configured. Please set GITHUB_TOKEN or GROQ_API_KEY.');
  return null;
};

const getGitHubModel = (taskType: string): string => {
  switch (taskType) {
    case 'vision': return GITHUB_MODELS.VISION;
    case 'reasoning': return GITHUB_MODELS.REASONING;
    case 'coding': return GITHUB_MODELS.CODER;
    default: return GITHUB_MODELS.GENERAL;
  }
};

const getGroqModel = (taskType: string): string => {
  switch (taskType) {
    case 'general': return GROQ_MODELS.FAST_GENERAL;
    default: return GROQ_MODELS.ULTRA_FAST;
  }
};

const parseJSONResponse = <T>(content: string): T | null => {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    logError('Failed to parse AI response as JSON:', error);
    return null;
  }
};

// Analyze feedback with AI
export const analyzeFeedback = async (
  title: string,
  description: string,
  screenshotBase64?: string,
  language: string = 'en'
): Promise<AIAnalysisResult | null> => {
  const languageInstruction = getLanguageInstruction(language);

  const systemPrompt = `You are an expert AI feedback analyst. Analyze user's feedback thoroughly and provide a detailed, structured analysis.

${languageInstruction}

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "suggestedTags": ["array", "of", "5-8", "relevant", "tags"],
  "impactScore": <number from 1-10, where 10 is critical>,
  "aiInsight": "A detailed, actionable insight about this feedback (2-3 sentences). Be specific about issue and potential solutions."
}`;

  const userPrompt = `Analyze this feedback thoroughly:

Title: ${title}
Description: ${description}
${screenshotBase64 ? '\n[Screenshot attached - analyze visual context for additional insights]' : ''}

Provide a comprehensive analysis. Respond with ONLY JSON object.`;

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    'general',
    undefined,
    1500,
    0.3
  );

  if (!response) return null;

  const parsed = parseJSONResponse<AIAnalysisResult>(response);
  if (!parsed) {
    return {
      category: 'General',
      sentiment: 'neutral',
      suggestedTags: [],
      impactScore: 5,
      aiInsight: response.substring(0, 300)
    };
  }

  return parsed;
};

// Generate detailed roadmap with AI
export const generateRoadmapSummary = async (
  feedbacks: any[],
  language: string = 'en'
): Promise<string> => {
  if (!feedbacks || feedbacks.length === 0) {
    return 'No feedback items to analyze for roadmap generation.';
  }

  const languageInstruction = getLanguageInstruction(language);

  const feedbackSummary = feedbacks.slice(0, 25).map((f, i) =>
    `${i + 1}. [${f.category}] "${f.title}" - ${f.votes} votes, ${f.sentiment || 'neutral'} sentiment${f.aiInsight ? ` | Insight: ${f.aiInsight.substring(0, 100)}` : ''}`
  ).join('\n');

  const systemPrompt = `You are a senior product strategist AI. Analyze community feedback and create a comprehensive, prioritized product roadmap.

${languageInstruction}

Structure your response as:
1. Executive Summary (2-3 sentences)
2. Phase 1: Critical/Urgent (items requiring immediate attention)
3. Phase 2: High Priority (important improvements)
4. Phase 3: Medium Priority (valuable enhancements)
5. Phase 4: Future Considerations
6. Key Metrics to Track

Consider:
- Vote counts indicate community priority
- Negative sentiment indicates urgency/pain points
- Group related items together
- Balance quick wins with strategic improvements`;

  const userPrompt = `Create a detailed product roadmap based on this community feedback:

${feedbackSummary}

Total items: ${feedbacks.length}
Provide a comprehensive, actionable roadmap with clear phases and initiatives.`;

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    'reasoning',
    undefined,
    3000,
    0.5
  );

  return response || 'Failed to generate roadmap. Please try again.';
};

export const listProviders = async () => {
  const githubAvailable = !!getGitHubToken();
  const groqAvailable = !!getGroqApiKey();
  
  return [
    {
      name: 'GitHub Models',
      available: githubAvailable,
      models: Object.entries(GITHUB_MODELS).map(([key, value]) => ({
        name: key,
        id: value
      }))
    },
    {
      name: 'Groq',
      available: groqAvailable,
      models: Object.entries(GROQ_MODELS).map(([key, value]) => ({
        name: key,
        id: value
      }))
    }
  ];
};

export const analyzeImagesToFeedback = async (
  imagesBase64: string[],
  language: string = 'en'
): Promise<ImageAnalysisResult | null> => {
  const languageInstruction = getLanguageInstruction(language);

  const systemPrompt = `You are an AI specialized in analyzing screenshots and visual feedback. Examine of provided screenshot(s) and generate structured feedback.

${languageInstruction}

You MUST respond with ONLY a valid JSON object:
{
  "subject": "A clear, descriptive title based on what you see",
  "details": "Detailed description of visual issue or feedback point",
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "suggestedTags": ["relevant", "visual", "tags"],
  "impactScore": <1-10>,
  "aiInsight": "What does screenshot reveal and recommended actions"
}`;

  const userPrompt = `Analyze ${imagesBase64.length} screenshot(s) and provide detailed visual feedback analysis. Respond with ONLY JSON object.`;

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    'vision',
    undefined,
    1500,
    0.3
  );

  if (!response) return null;

  const parsed = parseJSONResponse<ImageAnalysisResult>(response);
  if (!parsed) {
    return {
      subject: 'Visual Feedback',
      details: 'Please describe what you see in screenshots.',
      category: 'General',
      sentiment: 'neutral',
      suggestedTags: ['screenshot', 'visual'],
      impactScore: 5,
      aiInsight: 'Screenshots attached for visual context.'
    };
  }

  return parsed;
};

// Comprehensive analysis with detailed summary
export const comprehensiveAnalyze = async (
  subject: string,
  details: string,
  images?: string[],
  language: string = 'en'
): Promise<DetailedSummary> => {
  const hasApiKey = getGitHubToken() || getGroqApiKey();
  
  if (!hasApiKey) {
    return {
      summary: `Feedback received: "${subject}". ${images?.length ? `Includes ${images.length} screenshot(s).` : ''} Please configure GITHUB_TOKEN or GROQ_API_KEY for AI analysis.`,
      enhancedSubject: subject,
      enhancedDetails: details,
      category: 'General',
      sentiment: 'neutral',
      aiInsight: 'AI analysis unavailable - API key not configured.',
      priority: 'medium',
      suggestedActions: ['Configure API key for detailed analysis'],
      affectedComponents: [],
      reproducibility: 'Unknown'
    };
  }

  const languageInstruction = getLanguageInstruction(language);

  const systemPrompt = `You are a senior software quality analyst and product expert. Analyze user's feedback comprehensively and provide a detailed, actionable report.

${languageInstruction}

You MUST respond with ONLY a valid JSON object (no markdown outside JSON, no explanation before/after):
{
  "summary": "A comprehensive 3-4 sentence summary covering: what is issue is, its impact, and recommended action",
  "enhancedSubject": "An improved, clearer, more descriptive subject line (max 100 chars)",
  "enhancedDetails": "The original details rewritten with: clear problem statement, expected vs actual behavior, impact description",
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "aiInsight": "Deep technical or product insight explaining WHY this matters and HOW to address it (2-3 sentences)",
  "technicalAnalysis": "Technical assessment of issue - potential root causes, affected systems, technical complexity",
  "visualAnalysis": "Analysis of any visual elements mentioned or screenshots (if applicable)",
  "priority": "one of: critical, high, medium, low - based on impact and urgency",
  "suggestedActions": ["array", "of", "3-5", "specific", "actionable", "next", "steps"],
  "affectedComponents": ["array", "of", "potentially", "affected", "system", "components"],
  "reproducibility": "Assessment of how consistently this issue can be reproduced"
}`;

  const hasImages = images && images.length > 0;

  const userPrompt = `Analyze this feedback thoroughly and provide a comprehensive assessment:

**Subject:** ${subject}

**Details:** ${details}

${hasImages ? `**Visual Context:** ${images.length} screenshot(s) attached - incorporate visual analysis into your assessment` : '**Visual Context:** No screenshots provided'}

Provide an expert-level analysis. Respond with ONLY JSON object.`;

  const response = await callAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    hasImages ? 'vision' : 'reasoning',
    undefined,
    3000,
    0.4
  );

  if (!response) {
    return {
      summary: `Feedback: "${subject}". Analysis temporarily unavailable.`,
      enhancedSubject: subject,
      enhancedDetails: details,
      category: 'General',
      sentiment: 'neutral',
      aiInsight: 'AI analysis failed - please try again.',
      priority: 'medium',
      suggestedActions: ['Retry analysis'],
      affectedComponents: [],
      reproducibility: 'Unknown'
    };
  }

  const parsed = parseJSONResponse<DetailedSummary>(response);

  if (!parsed) {
    return {
      summary: response.substring(0, 500),
      enhancedSubject: subject,
      enhancedDetails: details,
      category: 'General',
      sentiment: 'neutral',
      aiInsight: 'Analysis completed with partial results.',
      priority: 'medium',
      suggestedActions: ['Review raw analysis'],
      affectedComponents: [],
      reproducibility: 'Unknown'
    };
  }

  return parsed;
};

// Export model configuration for reference
export const getModelConfig = () => ({
  github: {
    models: GITHUB_MODELS,
    description: {
      VISION: 'GPT-4o - Vision + Language model for screenshot analysis',
      REASONING: 'GPT-4o-mini - Fast, capable model for complex analysis',
      GENERAL: 'GPT-4o-mini - Fast, capable model for general tasks',
      CODER: 'GPT-4o - Specialized for code and technical issues'
    }
  },
  groq: {
    models: GROQ_MODELS,
    description: {
      FAST_GENERAL: 'Llama 3.3 70B - Fast, capable model for general tasks',
      ULTRA_FAST: 'Mixtral 8x7B - Ultra-fast model for simple tasks',
      BALANCED: 'Llama 3.1 70B - Balanced performance for all tasks'
    }
  }
});
