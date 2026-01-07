// Chutes AI Service for LLM Feedback Analysis
// Uses Chutes AI's job system to invoke deployed LLM models

const CHUTES_API_BASE = 'https://api.chutes.ai';
const API_KEY = process.env.CHUTES_API_KEY || '';
const CHUTE_ID = process.env.CHUTE_ID || ''; // The deployed model chute ID to use

export interface AIAnalysisResult {
  category: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  suggestedTags: string[];
  impactScore: number;
  aiInsight: string;
}

/**
 * Analyzes feedback using Chutes AI deployed LLM model
 * Creates a job, polls for completion, and returns parsed result
 */
export const analyzeFeedback = async (
  title: string,
  description: string,
  screenshotBase64?: string
): Promise<AIAnalysisResult | null> => {
  try {
    if (!CHUTE_ID) {
      console.error('CHUTE_ID not set. Please deploy a model and set CHUTE_ID in .env');
      return null;
    }

    const prompt = `Analyze this customer feedback and respond with JSON containing:
{
  "category": "Feature | Bug | UI/UX | Performance | Mobile | Security",
  "sentiment": "positive | neutral | negative",
  "suggestedTags": ["tag1", "tag2"],
  "impactScore": 1-10,
  "aiInsight": "concise insight"
}

Feedback Title: ${title}
Feedback Description: ${description}
${screenshotBase64 ? 'Screenshot: [Provided for visual context]' : ''}`;

    // Create a job to invoke the chute
    const createJobResponse = await fetch(`${CHUTES_API_BASE}/jobs/${CHUTE_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        job_args: {
          messages: [
            {
              role: 'system',
              content: 'You are a feedback analysis AI. Always respond with valid JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        }
      })
    });

    if (!createJobResponse.ok) {
      const errorText = await createJobResponse.text();
      console.error('Chutes AI Job Creation Failed:', errorText);
      return null;
    }

    const job = await createJobResponse.json();
    const jobId = job.job_id;

    if (!jobId) {
      console.error('No job ID returned from Chutes AI');
      return null;
    }

    // Poll for job completion
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max wait

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${CHUTES_API_BASE}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const statusData = await statusResponse.json();

      if (statusData.active === false && statusData.result) {
        // Job completed, parse the result
        const resultContent = statusData.result;
        
        // Try to parse JSON from the response
        const jsonMatch = resultContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
        }
        
        return {
          category: 'Other',
          sentiment: 'neutral',
          suggestedTags: [],
          impactScore: 5,
          aiInsight: resultContent
        };
      }

      // Wait 1 second between polls
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    console.error('Chutes AI Job timed out');
    return null;
  } catch (error) {
    console.error('Chutes AI Analysis Error:', error);
    return null;
  }
};

/**
 * Summarizes feedback items into a roadmap summary using Chutes AI
 */
export const generateRoadmapSummary = async (feedbacks: any[]): Promise<string> => {
  try {
    if (!CHUTE_ID) {
      return 'Please configure CHUTE_ID in environment variables to use AI features.';
    }

    const feedbackText = feedbacks
      .map(f => `- [${f.category}] ${f.title}: ${f.description}`)
      .join('\n');

    const prompt = `As a senior product manager, generate a brief, professional roadmap summary with key themes and prioritization based on this feedback:\n${feedbackText}`;

    const createJobResponse = await fetch(`${CHUTES_API_BASE}/jobs/${CHUTE_ID}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        job_args: {
          messages: [
            {
              role: 'system',
              content: 'You are a senior product manager generating roadmap summaries.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.5,
          max_tokens: 800
        }
      })
    });

    if (!createJobResponse.ok) {
      return 'Unable to generate roadmap summary.';
    }

    const job = await createJobResponse.json();
    const jobId = job.job_id;

    // Poll for completion
    let attempts = 0;
    const maxAttempts = 30;

    while (attempts < maxAttempts) {
      const statusResponse = await fetch(`${CHUTES_API_BASE}/jobs/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`
        }
      });

      const statusData = await statusResponse.json();

      if (statusData.active === false && statusData.result) {
        return statusData.result;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    return 'Unable to generate roadmap summary.';
  } catch (error) {
    console.error('Chutes AI Roadmap Error:', error);
    return 'Unable to generate roadmap summary.';
  }
};

/**
 * Lists available chutes for the user
 */
export const listChutes = async () => {
  try {
    const response = await fetch(`${CHUTES_API_BASE}/chutes/`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error listing chutes:', error);
    return [];
  }
};
