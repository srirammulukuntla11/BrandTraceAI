/**
 * Centralized Predefined Gemini Model Candidate Configuration (Frontend)
 *
 * Current official production Google Gemini models supporting generateContent:
 * https://ai.google.dev/gemini-api/docs/models
 *
 * Retired legacy models (Gemini 1.5 and Gemini 2.0 series) were deprecated and shut down
 * by Google, returning 404 Not Found.
 *
 * Current supported candidates:
 * - gemini-3.8-flash: Frontier intelligent Flash model (Recommended)
 * - gemini-3.6-flash: Proven high-speed production Flash workhorse
 * - gemini-2.5-flash: Low-latency multimodal model for policy verification
 * - gemini-2.5-flash-lite: Ultra-fast, cost-efficient Flash-Lite model for high-volume text analysis
 */

export interface PredefinedGeminiModel {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isRecommended?: boolean;
}

export const PREDEFINED_GEMINI_MODELS: PredefinedGeminiModel[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Frontier high-speed multimodal reasoning model (Recommended for real-time compliance)',
    badge: 'Recommended',
    isRecommended: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: 'Proven high-speed, low-latency Flash model for production compliance workflows',
    badge: 'High-Speed',
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Versatile, low-latency multimodal workhorse optimized for brand policy verification',
    badge: 'Versatile',
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Ultra-lightweight, high-throughput model designed for cost-efficient text analysis',
    badge: 'Cost-Efficient',
  },
];

export const PREDEFINED_MODEL_IDS: readonly string[] = PREDEFINED_GEMINI_MODELS.map((m) => m.id);

export function isValidPredefinedModel(modelId: string): boolean {
  if (!modelId) return false;
  return PREDEFINED_MODEL_IDS.includes(modelId.trim());
}

export function getPredefinedModel(modelId: string): PredefinedGeminiModel | undefined {
  if (!modelId) return undefined;
  return PREDEFINED_GEMINI_MODELS.find((m) => m.id === modelId.trim());
}
