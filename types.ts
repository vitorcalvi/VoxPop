export type FeedbackStatus = 'OPEN' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';

export interface FeedbackItem {
  id: string;
  title: string;
  description: string;
  category: string;
  votes: number;
  status: FeedbackStatus;
  createdAt: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  aiInsight?: string;
  screenshot?: string; // Legacy single screenshot
  screenshots?: string[]; // Multiple screenshots as array
}

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
