/**
 * MindStream Action Parser
 * Safely extracts structured AI action blocks from model responses.
 */

import { AIAction, AIActionType } from '../types/actions';

export function extractAction(rawText: string): { cleanText: string; action: AIAction | null } {
  if (!rawText) {
    return { cleanText: '', action: null };
  }

  // Regex matches ```json:mindstream-action { ... } ``` or ```json { "type"|"action": ... } ```
  const actionBlockRegex = /```(?:json:mindstream-action|json)\s*\n?(\{[\s\S]*?"(?:action|type)"[\s\S]*?\})\s*\n?```/i;
  const match = actionBlockRegex.exec(rawText);

  if (!match) {
    return { cleanText: rawText.trim(), action: null };
  }

  try {
    const parsed = JSON.parse(match[1]);
    const rawType = (parsed.type || parsed.action || '').toUpperCase() as AIActionType;
    const validTypes: AIActionType[] = ['CREATE_TASK', 'DELETE_TASK', 'CREATE_EVENT', 'DELETE_EVENT'];

    if (!validTypes.includes(rawType)) {
      return { cleanText: rawText.trim(), action: null };
    }

    const params = parsed.params || parsed.data || {};
    // Strip the action block from the visible conversational text
    const cleanText = rawText.replace(match[0], '').trim();

    return {
      cleanText,
      action: {
        type: rawType,
        params,
      },
    };
  } catch (err) {
    console.warn('[ActionParser] Failed to parse action block JSON:', err);
    return { cleanText: rawText.trim(), action: null };
  }
}
