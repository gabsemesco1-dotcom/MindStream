/**
 * MindStream Action Parser
 * Safely extracts structured AI action blocks from model responses.
 */

import { AIAction, AIActionType } from '../types/actions';

export function extractAction(rawText: string): { cleanText: string; action: AIAction | null; actions: AIAction[] } {
  if (!rawText) {
    return { cleanText: '', action: null, actions: [] };
  }

  const validTypes: AIActionType[] = [
    'CREATE_TASK',
    'DELETE_TASK',
    'UPDATE_TASK',
    'CREATE_EVENT',
    'DELETE_EVENT',
    'UPDATE_EVENT',
    'DELETE_ALL_TASKS',
    'DELETE_ALL_EVENTS',
  ];

  const actions: AIAction[] = [];
  let cleanText = rawText;

  // Regex matches ```json:mindstream-action ... ``` or ```json ... ```
  const actionBlockRegex = /```(?:json:mindstream-action|json)\s*\n?([\s\S]*?)\s*\n?```/gi;
  let match: RegExpExecArray | null;

  while ((match = actionBlockRegex.exec(rawText)) !== null) {
    const fullBlock = match[0];
    const blockContent = match[1].trim();

    try {
      const parsed = JSON.parse(blockContent);
      let matchedAny = false;

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item === 'object') {
            const rawType = (item.type || item.action || '').toUpperCase() as AIActionType;
            if (validTypes.includes(rawType)) {
              actions.push({
                type: rawType,
                params: item.params || item.data || {},
              });
              matchedAny = true;
            }
          }
        }
      } else if (parsed && typeof parsed === 'object') {
        const rawType = (parsed.type || parsed.action || '').toUpperCase() as AIActionType;
        if (validTypes.includes(rawType)) {
          actions.push({
            type: rawType,
            params: parsed.params || parsed.data || {},
          });
          matchedAny = true;
        }
      }

      if (matchedAny) {
        cleanText = cleanText.replace(fullBlock, '');
      }
    } catch {
      // Not valid JSON or not an action block, leave it intact in text
    }
  }

  return {
    cleanText: cleanText.trim(),
    action: actions[0] || null,
    actions,
  };
}
