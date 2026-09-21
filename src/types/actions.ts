/**
 * MindStream AI Action Protocol - Types & Interfaces
 * Strongly-typed definitions for AI actions, parameters, responses, and context.
 */

import { Priority } from '../types';


export type AIActionType =
  | 'CREATE_TASK'
  | 'DELETE_TASK'
  | 'UPDATE_TASK'
  | 'CREATE_EVENT'
  | 'DELETE_EVENT'
  | 'UPDATE_EVENT'
  | 'DELETE_ALL_TASKS'
  | 'DELETE_ALL_EVENTS';

export interface CreateTaskParams {
  title: string;
  dueDate?: string; // YYYY-MM-DD
  dueTime?: string; // e.g. "10:00 AM" or "15:00"
  priority?: Priority; // 'low' | 'medium' | 'high'
  category?: string; // e.g. 'Work', 'Personal', 'Study'
  notes?: string;
  location?: string;
  reminder?: boolean;
}

export interface DeleteTaskParams {
  taskId: string;
  taskTitle: string;
}

export interface UpdateTaskParams {
  taskId: string;       // required — exact existing task ID from context
  taskTitle: string;   // required — exact existing task title from context
  title?: string;      // new title
  dueDate?: string;    // new due date in YYYY-MM-DD
  dueTime?: string;    // new due time e.g. "03:00 PM"
  priority?: Priority; // 'low' | 'medium' | 'high'
  status?: string;     // 'pending' | 'progress' | 'completed'
  category?: string;
  notes?: string;
  location?: string;
}

export interface CreateEventParams {
  title: string;
  date: string; // YYYY-MM-DD
  time?: string; // e.g. "09:00 AM" or "02:30 PM"
  duration?: number; // in hours, e.g. 1.0 or 1.5
  location?: string;
  type?: 'exam' | 'study' | 'class' | 'submission';
  subject?: string;
}

export interface DeleteEventParams {
  eventId: string;
  eventTitle: string;
}

export interface UpdateEventParams {
  eventId: string;
  eventTitle: string;
  title?: string;
  date?: string;
  time?: string;
  duration?: number;
  location?: string;
  type?: 'exam' | 'study' | 'class' | 'submission';
  subject?: string;
}

export interface DeleteAllTasksParams {}

export interface DeleteAllEventsParams {}

export interface AIAction {
  type: AIActionType;
  params: any; // typed per action: CreateTaskParams | UpdateTaskParams | DeleteTaskParams | CreateEventParams | UpdateEventParams | DeleteEventParams | DeleteAllTasksParams | DeleteAllEventsParams
}

export interface AIActionResponse {
  text: string;
  action?: AIAction | null;
  actions?: AIAction[];
}

export interface TaskSummary {
  id: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  priority: Priority;
  status: string;
  category?: string;
  notes?: string;
  location?: string;
}

export interface EventSummary {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  location?: string;
  type?: string;
  subject?: string;
}

export interface AIRequestContext {
  currentDate: string; // YYYY-MM-DD
  currentTime: string; // e.g. "04:25 PM"
  currentDay: string; // e.g. "Sunday"
  tasks: TaskSummary[];
  events: EventSummary[];
}

export interface PendingConfirmation {
  type: 'DELETE_TASK' | 'DELETE_EVENT' | 'DELETE_ALL_TASKS' | 'DELETE_ALL_EVENTS' | 'DELETE_ALL_TASKS_AND_EVENTS';
  targetId?: string;
  targetTitle?: string;
  actions?: AIAction[];
}
