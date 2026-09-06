export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'progress' | 'completed';
export type RepeatUnit = 'day' | 'week' | 'month' | 'year';
export type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export interface Task {
  id: string;

  // Core task information
  title: string;
  category?: string;          // Study, Work, Personal, Health, Shopping, etc.
  subject?: string;          // Only used when category is "Study"

  // Scheduling
  dueDate: string;
  startDate?: string;
  dueTime?: string;

  // Status
  priority: Priority;
  status: TaskStatus;

  // Details
  notes: string;
  tags?: string[];
  location?: string;
  reminder?: boolean;

  // Progress
  completedPercent?: number;
  nextMilestone?: string;

  // Recurrence
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  repeatInterval?: number;
  repeatUnit?: 'day' | 'week' | 'month' | 'year';
  repeatDays?: string[];
  repeatEndDate?: string;
  repeatCount?: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  time: string; // "09:00 AM" or similar
  duration: number; // in hours, e.g. 1.5
  location: string;
  date: string; // "YYYY-MM-DD" e.g., "2023-10-04" or "2026-06-23"
  type: 'exam' | 'study' | 'class' | 'submission';
  subject: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // formatted time, e.g. "10:00 AM"
  typing?: boolean;
}

export interface FocusSession {
  id: string;
  durationSeconds: number;
  category: string;
  timestamp: string;
}

export interface DashboardStats {
  tasksDueToday: number;
  studyHours: number;
  productivityScore: number;
  upcomingExams: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
}
