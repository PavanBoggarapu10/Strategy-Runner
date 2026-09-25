import { CustomRulesConfig } from './trading';

export interface StrategyImprovementSuggestion {
  title: string;
  category: 'ENTRY_FILTER' | 'EXIT_LOGIC' | 'RISK_MANAGEMENT' | 'INDICATOR_ADDITION';
  description: string;
  whyItFailed: string;
  suggestedAction: string;
  impactScore: number; // 1 to 10
}

export interface GeminiAnalysisResult {
  executiveSummary: string;
  userEnhancementPrompt?: string;
  userPromptGuidanceSummary?: string;
  failureDiagnosis: {
    primaryFlaw: string;
    detailedReasons: string[];
    losingTradePatterns: string;
    marketRegimeMismatch: string;
  };
  efficiencyAudit: {
    currentGrade: string;
    efficiencyScore: number;
    feeDragAnalysis: string;
    drawdownRiskAnalysis: string;
  };
  keyImprovements: StrategyImprovementSuggestion[];
  suggestedAdditions: {
    recommendedIndicators: string[];
    recommendedStopLossLogic: string;
    recommendedTakeProfitLogic: string;
    recommendedFilterRules: string[];
  };
  improvedStrategy: {
    explanation: string;
    patchesSummary?: string[];
    suggestedRules?: CustomRulesConfig;
    suggestedScript?: string;
    suggestedPineScript?: string;
  };
  modelUsed?: string;
  isFallback?: boolean;
  notice?: string;
}
