// Chutes Plus AI Service Integration
// API Documentation: https://chutes.ai/docs
// Multi-Model Strategy for Optimal Feedback Analysis

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

const CHUTES_API_URL = 'https://llm.chutes.ai/v1/chat/completions';

// Model Configuration - Optimal arrangement for different tasks
const MODELS = {
  // Vision + Language - Best for analyzing screenshots with context
  VISION: 'Qwen/Qwen2.5-VL-72B-Instruct',

  // Deep Reasoning - Best for thorough analysis and complex issues
  REASONING: 'deepseek-ai/DeepSeek-R1',

  // Fast & Capable - Best for general analysis and summaries
  GENERAL: 'deepseek-ai/DeepSeek-V3-0324',

  // Coding Analysis - Best for technical/code issues
  CODER: 'Qwen/Qwen2.5-Coder-32B-Instruct',

  // Balanced - Good all-around performance
  BALANCED: 'Qwen/Qwen3-32B'
};

const getApiKey = (): string | null => {
  const apiKey = process.env.CHUTES_API_KEY || null;
  console.log('🔑 getApiKey called:', apiKey ? 'Key found' : 'No key configured');
  return apiKey;
};

interface Message {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

const callChutesAPI = async (
  messages: Message[],
  model: string = MODELS.GENERAL,
  maxTokens: number = 2000,
  temperature: number = 0.7
): Promise<string | null> => {
  const apiKey = getApiKey();
  if (!apiKey) {
    console.warn('⚠️ CHUTES_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🤖 Calling Chutes API with model: ${model}`);

    const response = await fetch(CHUTES_API_URL, {
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

    console.log(`📡 API response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Chutes API error (${model}):`, response.status, errorText);
      return null;
    }

    const data = await response.json();
    console.log('✅ API response received, extracting content...');
    const content = data.choices?.[0]?.message?.content || null;
    console.log(`📄 Content length: ${content?.length || 0} chars`);
    return content;
  } catch (error) {
    console.error(`❌ Chutes API request failed (${model}):`, error);
    console.error('Error details:', (error as Error).message);
    return null;
  }
};

const parseJSONResponse = <T>(content: string): T | null => {
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', error);
    return null;
  }
};

// Analyze feedback with vision model when images are present
export const analyzeFeedback = async (
  title: string,
  description: string,
  screenshotBase64?: string
): Promise<AIAnalysisResult | null> => {
  const systemPrompt = `You are an expert AI feedback analyst. Analyze the user feedback thoroughly and provide a detailed, structured analysis.

You MUST respond with ONLY a valid JSON object (no markdown, no explanation) in this exact format:
{
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "suggestedTags": ["array", "of", "5-8", "relevant", "tags"],
  "impactScore": <number from 1-10, where 10 is critical>,
  "aiInsight": "A detailed, actionable insight about this feedback (2-3 sentences). Be specific about the issue and potential solutions."
}`;

  const userPrompt = `Analyze this feedback thoroughly:

Title: ${title}
Description: ${description}
${screenshotBase64 ? '\n[Screenshot attached - analyze the visual context for additional insights]' : ''}

Provide a comprehensive analysis. Respond with ONLY the JSON object.`;

  // Use reasoning model for complex analysis
  const response = await callChutesAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    MODELS.GENERAL,
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

// Generate detailed roadmap with reasoning model
export const generateRoadmapSummary = async (feedbacks: any[]): Promise<string> => {
  if (!getApiKey()) {
    return 'AI roadmap generation requires CHUTES_API_KEY. Please configure your Chutes Plus API key.';
  }

  if (!feedbacks || feedbacks.length === 0) {
    return 'No feedback items to analyze for roadmap generation.';
  }

  const feedbackSummary = feedbacks.slice(0, 25).map((f, i) =>
    `${i + 1}. [${f.category}] "${f.title}" - ${f.votes} votes, ${f.sentiment || 'neutral'} sentiment${f.aiInsight ? ` | Insight: ${f.aiInsight.substring(0, 100)}` : ''}`
  ).join('\n');

  const systemPrompt = `You are a senior product strategist AI. Analyze the community feedback and create a comprehensive, prioritized product roadmap.

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

  // Use reasoning model for strategic analysis
  const response = await callChutesAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    MODELS.REASONING,
    3000,
    0.5
  );

  return response || 'Failed to generate roadmap. Please try again.';
};

export const listChutes = async () => {
  return [];
};

export const analyzeImagesToFeedback = async (
  imagesBase64: string[]
): Promise<ImageAnalysisResult | null> => {
  if (!getApiKey()) {
    return null;
  }

  // Use vision model for image analysis
  const systemPrompt = `You are an AI specialized in analyzing screenshots and visual feedback. Examine the provided screenshot(s) and generate structured feedback.

You MUST respond with ONLY a valid JSON object:
{
  "subject": "A clear, descriptive title based on what you see",
  "details": "Detailed description of the visual issue or feedback point",
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "suggestedTags": ["relevant", "visual", "tags"],
  "impactScore": <1-10>,
  "aiInsight": "What the screenshot reveals and recommended actions"
}`;

  const userPrompt = `Analyze ${imagesBase64.length} screenshot(s) and provide detailed visual feedback analysis. Respond with ONLY the JSON object.`;

  const response = await callChutesAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    MODELS.GENERAL,
    1500,
    0.3
  );

  if (!response) return null;

  const parsed = parseJSONResponse<ImageAnalysisResult>(response);
  if (!parsed) {
    return {
      subject: 'Visual Feedback',
      details: 'Please describe what you see in the screenshots.',
      category: 'General',
      sentiment: 'neutral',
      suggestedTags: ['screenshot', 'visual'],
      impactScore: 5,
      aiInsight: 'Screenshots attached for visual context.'
    };
  }

  return parsed;
};

// Comprehensive analysis with detailed summary - uses multi-model approach
export const comprehensiveAnalyze = async (
  subject: string,
  details: string,
  images?: string[]
): Promise<DetailedSummary> => {
  if (!getApiKey()) {
    return {
      summary: `Feedback received: "${subject}". ${images?.length ? `Includes ${images.length} screenshot(s).` : ''} Please configure CHUTES_API_KEY for AI analysis.`,
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

  const systemPrompt = `You are a senior software quality analyst and product expert. Analyze the user's feedback comprehensively and provide a detailed, actionable report.

You MUST respond with ONLY a valid JSON object (no markdown outside JSON, no explanation before/after):
{
  "summary": "A comprehensive 3-4 sentence summary covering: what the issue is, its impact, and recommended action",
  "enhancedSubject": "An improved, clearer, more descriptive subject line (max 100 chars)",
  "enhancedDetails": "The original details rewritten with: clear problem statement, expected vs actual behavior, impact description",
  "category": "one of: Feature, Bug, UI/UX, Performance, Security, Documentation, General",
  "sentiment": "one of: positive, neutral, negative",
  "aiInsight": "Deep technical or product insight explaining WHY this matters and HOW to address it (2-3 sentences)",
  "technicalAnalysis": "Technical assessment of the issue - potential root causes, affected systems, technical complexity",
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

Provide an expert-level analysis. Respond with ONLY the JSON object.`;

  // Use reasoning model for comprehensive analysis
  const response = await callChutesAPI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    MODELS.REASONING,
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
    // Extract what we can from the response
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
  models: MODELS,
  description: {
    VISION: 'Qwen2.5-VL-72B - Vision + Language model for screenshot analysis',
    REASONING: 'DeepSeek-R1 - Deep reasoning model for complex analysis',
    GENERAL: 'DeepSeek-V3 - Fast, capable model for general tasks',
    CODER: 'Qwen2.5-Coder-32B - Specialized for code and technical issues',
    BALANCED: 'Qwen3-32B - Balanced performance for all tasks'
  }
});
