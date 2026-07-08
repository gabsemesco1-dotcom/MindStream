export type Priority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  subject: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  notes: string;
  completedPercent?: number; // for tasks that have progress, e.g. 65% for Senior Thesis
  nextMilestone?: string;
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
