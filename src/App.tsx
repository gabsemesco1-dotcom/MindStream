/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  LayoutDashboard,
  Calendar as CalendarIcon,
  ListTodo,
  Timer as ClockIcon,
  User,
  Bell,
  Plus,
  X,
  ChevronDown,
  Cpu,
  Send,
  Paperclip,
  TrendingUp,
  Sparkles,
  School,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  CheckCircle2,
  MoreVertical,
  Award,
  ArrowRight,
  Bot,
  Mail,
  Lock,
  LogOut,
  ArrowLeft,
  Settings,
  Moon,
  Sun,
  Monitor,
  HelpCircle,
  Pencil,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { INITIAL_TASKS, INITIAL_EVENTS, IMAGES } from './data';
import { Task, CalendarEvent, ChatMessage, Priority, TaskStatus, ChatConversation } from './types';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import {
  createConversation,
  saveMessage,
  getConversationMessages,
  generateTitleFromMessage,
  updateConversationTitle
} from "./lib/ai";
import { ChatMessageRenderer } from './components/ChatMessageRenderer';
import { AIRequestContext, PendingConfirmation, AIAction, CreateTaskParams, CreateEventParams, DeleteTaskParams, DeleteEventParams, UpdateEventParams, UpdateTaskParams } from './types/actions';

// Generate a secure, valid RFC4122 v4 UUID for database compatibility
const generateUuid = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Check if a string is a valid UUID to prevent database casting exceptions
const isValidUuid = (id: string) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

// Get current date string in local YYYY-MM-DD format
const getLocalDateString = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function App() {
  const { t, i18n } = useTranslation();
  // Supabase Auth Integration hook
  const {
    user,
    profile: authProfile,
    loading: authLoading,
    signUp: supabaseSignUp,
    signIn: supabaseSignIn,
    signInWithGoogle: supabaseSignInWithGoogle,
    signOut: supabaseSignOut,
    resetPassword: supabaseResetPassword,
    updateProfile: supabaseUpdateProfile
  } = useAuth();

  // User Authentication State
  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    email: string;
    studentLevel: string;
    avatarUrl?: string;
  } | null>(null);

  // Screens navigation state: 'onboarding' | 'login' | 'register' | 'preloader' | 'main'
  const [currentScreen, setCurrentScreen] = useState<'onboarding' | 'login' | 'register' | 'preloader' | 'main'>('onboarding');

  // Sync Supabase Auth profile with application states
  useEffect(() => {
    if (!authLoading) {
      if (user) {
        const fallbackProfile = {
          fullName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Gabriel Semesco',
          email: user.email || '',
          studentLevel: user.user_metadata?.student_level || 'Undergraduate (Senior)',
          avatarUrl: user.user_metadata?.avatar_url || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.email || 'Gabriel Semesco')}`
        };
        setCurrentUser(authProfile || fallbackProfile);
        if (currentScreen === 'onboarding' || currentScreen === 'login' || currentScreen === 'register') {
          setCurrentScreen('preloader');
        }
      } else {
        setCurrentUser(null);
        const onboardingDone = localStorage.getItem('mindstream_onboarding_completed') === 'true';
        if (currentScreen === 'main' || currentScreen === 'preloader') {
          setCurrentScreen('login');
        } else if (currentScreen === 'onboarding' && onboardingDone) {
          setCurrentScreen('login');
        }
      }
    }
  }, [user, authProfile, authLoading, currentScreen]);

  // Auth processing status for UI feedback (disabling buttons, spinner)
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);

  // Carousel slides index for onboarding
  const [onboardingSlide, setOnboardingSlide] = useState(0);

  // Active navigation sub-tab in main app: 'dashboard' | 'calendar' | 'tasks' | 'timer' | 'profile' | 'aitutor'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'calendar' | 'tasks' | 'timer' | 'profile' | 'aitutor'>('dashboard');

  // Profile Menu open/closed state
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);


  // Theme Mode preference state (saved in localStorage)
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(() => {
    const saved = localStorage.getItem('mindstream_theme_mode');
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    const legacy = localStorage.getItem('mindstream_dark_mode');
    if (legacy === 'true') return 'dark';
    if (legacy === 'false') return 'light';
    return 'system';
  });

  // Calculate actual dark mode status for inline conditional rendering
  const [isDarkActive, setIsDarkActive] = useState<boolean>(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = themeMode === 'dark' || (themeMode === 'system' && mediaQuery.matches);
      setIsDarkActive(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();
    localStorage.setItem('mindstream_theme_mode', themeMode);

    if (themeMode === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
  }, [themeMode]);

  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginRememberMe, setLoginRememberMe] = useState(true);

  // Register Form States
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [registerConfirmPassword, setRegisterConfirmPassword] = useState('');
  const [registerStudentLevel, setRegisterStudentLevel] = useState(t("undergraduateStudent"));

  // Core mutable application state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const eventsRef = useRef<CalendarEvent[]>(events);
  eventsRef.current = events;

  // Persistent conversations and chat sessions
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    const saved = localStorage.getItem('mindstream_conversations');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Failed to parse conversations:", e);
      }
    }
    const defaultConv: ChatConversation = {
      id: 'conv-default',
      title: t("defaultConversationTitle"),
      messages: [{
        id: 'msg-welcome-init',
        role: 'assistant',
        text: 'SPECIAL_TOKEN_WELCOME',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }],
      createdAt: new Date().toLocaleDateString()
    };
    return [defaultConv];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const savedActive = localStorage.getItem('mindstream_active_conv_id');
    return savedActive || 'conv-default';
  });
  // Authoritative ref to eliminate stale closures across async operations
  const activeConversationIdRef = useRef<string>(activeConversationId);
  activeConversationIdRef.current = activeConversationId;

  // Monotonically increasing request ID for async conversation loading (stale-guard)
  const conversationLoadReqRef = useRef<number>(0);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const savedActive = localStorage.getItem('mindstream_active_conv_id') || 'conv-default';
    const savedConvs = localStorage.getItem('mindstream_conversations');
    if (savedConvs) {
      try {
        const parsed = JSON.parse(savedConvs);
        if (Array.isArray(parsed)) {
          const found = parsed.find((c: any) => c.id === savedActive);
          if (found && found.messages && found.messages.length > 0) return found.messages;
        }
      } catch (e) {
        console.error("Failed to load initial messages from active conversation:", e);
      }
    }
    return [{
      id: 'msg-welcome-init',
      role: 'assistant',
      text: 'SPECIAL_TOKEN_WELCOME',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }];
  });

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);

  // Authoritative deduplicated conversations for sidebar and mobile drawer rendering
  const displayConversations = useMemo(() => {
    const seen = new Set<string>();
    return conversations.filter(c => {
      if (!c.id || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  }, [conversations]);

  // Form state for creating a new task
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(getLocalDateString());
  const [taskDueTime, setTaskDueTime] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskNotes, setTaskNotes] = useState('');
  const [taskCategory, setTaskCategory] = useState('Personal');
  const [taskLocation, setTaskLocation] = useState('');
  const [taskReminder, setTaskReminder] = useState(false);
  const [taskStartDate, setTaskStartDate] = useState('');
  const [taskRepeat, setTaskRepeat] = useState<
    'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'
  >('none');
  const [taskRepeatInterval, setTaskRepeatInterval] = useState(1);
  const [taskRepeatUnit, setTaskRepeatUnit] = useState<
    'day' | 'week' | 'month' | 'year'
  >('day');
  const [taskRepeatDays, setTaskRepeatDays] = useState<string[]>([]);
  const [taskRepeatEndDate, setTaskRepeatEndDate] = useState('');
  const [taskRepeatCount, setTaskRepeatCount] = useState<number | null>(null);
  const [taskRepeatEnds, setTaskRepeatEnds] = useState<'never' | 'date' | 'count'>('never');

  // Form state for creating/editing an event
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('09:00 AM');
  const [eventDuration, setEventDuration] = useState(1.0);
  const [eventLocation, setEventLocation] = useState('');
  const [eventDate, setEventDate] = useState(getLocalDateString());
  const [eventType, setEventType] = useState<'exam' | 'study' | 'class' | 'submission'>('study');
  const [eventSubject, setEventSubject] = useState('');

  // Calendar interactive state: currently selected date, current month, and current year
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [calendarView, setCalendarView] = useState<'month' | 'week'>('month');

  // Task filter state
  const [taskFilter, setTaskFilter] = useState<'pending' | 'progress' | 'completed'>('pending');

  // Dynamic Calendar calculations
  const monthNames = useMemo(() => [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ], []);

  const calendarDaysInfo = useMemo(() => {
    // Number of days in the current month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // First day of current month (adjusted so 0 is Monday, 1 is Tuesday, ..., 6 is Sunday)
    const rawFirstDay = new Date(currentYear, currentMonth, 1).getDay();
    const firstDayIndex = rawFirstDay === 0 ? 6 : rawFirstDay - 1;

    // Number of days in previous month
    const prevMonthVal = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYearVal = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonthDays = new Date(prevYearVal, prevMonthVal + 1, 0).getDate();

    // Filler days from the previous month
    const fillerDays = Array.from({ length: firstDayIndex }, (_, i) => prevMonthDays - firstDayIndex + 1 + i);

    // Filler days from the next month to complete the grid (standard 35 or 42 cells)
    const totalCells = fillerDays.length + daysInMonth;
    const nextMonthFillerCount = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    const nextMonthFiller = Array.from({ length: nextMonthFillerCount }, (_, i) => i + 1);

    return { daysInMonth, fillerDays, nextMonthFiller };
  }, [currentMonth, currentYear]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // Focus Timer Pomodoro State
  const [timerMinutes, setTimerMinutes] = useState(25);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerCategory, setTimerCategory] = useState('Focus');
  const [sessionGoal, setSessionGoal] = useState('');
  const getIntentDescription = (intent: string) => {
    switch (intent) {
      case 'Focus': return t('intentFocusDesc');
      case 'Create': return t('intentCreateDesc');
      case 'Learn': return t('intentLearnDesc');
      case 'Think': return t('intentThinkDesc');
      default: return t('intentFocusDesc');
    }
  };
  const [timerTargetMinutes, setTimerTargetMinutes] = useState(25);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Cumulative study hours logged
  const [studyHours, setStudyHours] = useState(0);
  const [studySessions, setStudySessions] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // DB To App Mappers for resilient data structure conversion
  const dbToTask = (row: any): Task => ({
    id: row.id || generateUuid(),
    title: row.title || '',
    category: row.category || 'Personal',
    subject: row.subject || '',
    startDate: row.start_date || "",
    dueDate: row.due_date || row.dueDate || '',
    dueTime: row.due_time || row.dueTime || '',
    priority: (row.priority || 'medium') as Priority,
    status: (row.status || 'pending') as TaskStatus,
    notes: row.notes || '',
    location: row.location || "",
    tags: row.tags || [],
    reminder: row.reminder ?? false,
    completedPercent: row.completed_percent ?? row.completedPercent ?? 0,
    nextMilestone: row.next_milestone ?? row.nextMilestone ?? '',

    // Recurrence
    repeat: row.repeat ?? 'none',
    repeatInterval: row.repeat_interval ?? row.repeatInterval ?? 1,
    repeatUnit: row.repeat_unit ?? row.repeatUnit ?? 'day',
    repeatDays: row.repeat_days ?? row.repeatDays ?? [],
    repeatEndDate: row.repeat_end_date ?? row.repeatEndDate ?? '',
    repeatCount: row.repeat_count ?? row.repeatCount ?? 0
  });

  const taskToDb = (task: Task, userId: string) => ({
    id: task.id,
    user_id: userId,
    title: task.title,
    category: task.category,
    subject: task.subject ?? '',
    due_date: task.dueDate || null,
    due_time: task.dueTime ?? '',
    priority: task.priority,
    start_date: task.startDate || null,
    status: task.status,
    location: task.location,
    notes: task.notes,
    tags: task.tags ?? [],
    reminder: task.reminder ?? false,
    completed_percent: task.completedPercent ?? 0,
    next_milestone: task.nextMilestone ?? '',

    // Recurrence
    repeat: task.repeat,
    repeat_interval: task.repeatInterval,
    repeat_unit: task.repeatUnit,
    repeat_days: task.repeatDays,
    repeat_end_date: task.repeatEndDate || null,
    repeat_count: task.repeatCount
  });

  const dbToEvent = (row: any): CalendarEvent => ({
    id: row.id || generateUuid(),
    title: row.title || '',
    time: row.time || '',
    duration: Number(row.duration || 0),
    location: row.location || '',
    date: (row.event_date || row.date || '').split('T')[0],
    type: (row.event_type || row.type || 'study') as 'exam' | 'study' | 'class' | 'submission',
    subject: row.subject || ''
  });

  const dbToChatMessage = (row: any): ChatMessage => ({
    id: row.id,
    role: row.role as 'user' | 'assistant',
    text: row.message,
    timestamp: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  const eventToDb = (event: CalendarEvent, userId: string) => ({
    id: event.id,
    user_id: userId,
    title: event.title,
    event_date: event.date,
    event_type: event.type,
    subject: event.subject,
    time: event.time,
    location: event.location,
    type: event.type,
    duration: event.duration
  });

  // Resilient insert helper that automatically handles missing columns by filtering them out and retrying
  const resilientInsert = async (table: string, data: any | any[]) => {
    let records = Array.isArray(data) ? [...data] : [data];
    if (records.length === 0) return { data: [], error: null };

    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: result, error } = await supabase.from(table).insert(records).select();
      if (!error) {
        return { data: result, error: null };
      }

      console.warn(`[Resilient Supabase ${table} Insert] Attempt ${attempts + 1} failed:`, error);
      const errMsg = (error.message || '').toLowerCase();
      const errDetails = (error.details || '').toLowerCase();
      const fullErrStr = `${errMsg} ${errDetails}`;

      let colMatch = fullErrStr.match(/column "([^"]+)"/) ||
        fullErrStr.match(/column ([^\s]+) does not exist/) ||
        fullErrStr.match(/has no column "([^"]+)"/);

      let columnToRemove = colMatch ? colMatch[1] : null;

      if (!columnToRemove && records.length > 0) {
        const sampleRecord = records[0];
        for (const key of Object.keys(sampleRecord)) {
          if (fullErrStr.includes(key.toLowerCase())) {
            columnToRemove = key;
            break;
          }
        }
      }

      if (columnToRemove) {
        console.log(`[Resilient Supabase ${table} Insert] Detected missing column "${columnToRemove}". Filtering out and retrying...`);
        records = records.map(record => {
          const cleanRecord = { ...record };
          delete cleanRecord[columnToRemove!];
          return cleanRecord;
        });
        attempts++;
      } else {
        if (table === 'tasks') {
          let modified = false;
          records = records.map(record => {
            const cleanRecord = { ...record };
            if ('completed_percent' in cleanRecord) { delete cleanRecord.completed_percent; modified = true; }
            if ('completedPercent' in cleanRecord) { delete cleanRecord.completedPercent; modified = true; }
            if ('next_milestone' in cleanRecord) { delete cleanRecord.next_milestone; modified = true; }
            if ('nextMilestone' in cleanRecord) { delete cleanRecord.nextMilestone; modified = true; }
            if ('notes' in cleanRecord) { delete cleanRecord.notes; modified = true; }
            return cleanRecord;
          });
          if (modified && attempts < 1) {
            attempts++;
            continue;
          }
        } else if (table === 'events') {
          let modified = false;
          records = records.map(record => {
            const cleanRecord = { ...record };
            if ('location' in cleanRecord) { delete cleanRecord.location; modified = true; }
            if ('subject' in cleanRecord) { delete cleanRecord.subject; modified = true; }
            if ('duration' in cleanRecord) { delete cleanRecord.duration; modified = true; }
            return cleanRecord;
          });
          if (modified && attempts < 1) {
            attempts++;
            continue;
          }
        }

        return { data: null, error };
      }
    }

    return await supabase.from(table).insert(records);
  };

  // Resilient update helper that automatically handles missing columns by filtering them out and retrying
  const resilientUpdate = async (table: string, id: string, userId: string, data: any) => {
    let record = { ...data };
    let attempts = 0;
    const maxAttempts = 5;

    while (attempts < maxAttempts) {
      const { data: result, error } = await supabase
        .from(table)
        .update(record)
        .eq('id', id)
        .eq('user_id', userId)
        .select();

      if (!error) {
        return { data: result, error: null };
      }

      console.warn(`[Resilient Supabase ${table} Update] Attempt ${attempts + 1} failed:`, error);
      const errMsg = (error.message || '').toLowerCase();
      const errDetails = (error.details || '').toLowerCase();
      const fullErrStr = `${errMsg} ${errDetails}`;

      let colMatch = fullErrStr.match(/column "([^"]+)"/) ||
        fullErrStr.match(/column ([^\s]+) does not exist/) ||
        fullErrStr.match(/has no column "([^"]+)"/);

      let columnToRemove = colMatch ? colMatch[1] : null;

      if (!columnToRemove) {
        for (const key of Object.keys(record)) {
          if (fullErrStr.includes(key.toLowerCase())) {
            columnToRemove = key;
            break;
          }
        }
      }

      if (columnToRemove) {
        console.log(`[Resilient Supabase ${table} Update] Detected missing column "${columnToRemove}". Filtering out and retrying...`);
        delete record[columnToRemove];
        attempts++;
      } else {
        if (table === 'tasks') {
          let modified = false;
          if ('completed_percent' in record) { delete record.completed_percent; modified = true; }
          if ('completedPercent' in record) { delete record.completedPercent; modified = true; }
          if ('next_milestone' in record) { delete record.next_milestone; modified = true; }
          if ('nextMilestone' in record) { delete record.nextMilestone; modified = true; }
          if ('notes' in record) { delete record.notes; modified = true; }
          if (modified && attempts < 1) {
            attempts++;
            continue;
          }
        } else if (table === 'events') {
          let modified = false;
          if ('location' in record) { delete record.location; modified = true; }
          if ('subject' in record) { delete record.subject; modified = true; }
          if ('duration' in record) { delete record.duration; modified = true; }
          if (modified && attempts < 1) {
            attempts++;
            continue;
          }
        }
        return { data: null, error };
      }
    }

    return await supabase
      .from(table)
      .update(record)
      .eq('id', id)
      .eq('user_id', userId);
  };

  // Load & Sync data from Supabase using stable useCallback
  const syncSupabaseData = useCallback(async (silent = false) => {
    if (!user) return;
    if (!silent) setIsRefreshing(true);

    try {
      // Parallelize independent initial data requests with Promise.allSettled
      const [tasksResult, eventsResult, sessionsResult, convsResult] = await Promise.allSettled([
        supabase.from('tasks').select('*').eq('user_id', user.id),
        supabase.from('events').select('*').eq('user_id', user.id),
        supabase.from('study_sessions').select('*').eq('user_id', user.id),
        supabase.from('ai_conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      ]);

      // 1. Process Tasks
      if (tasksResult.status === 'fulfilled') {
        const { data: dbTasks, error: tasksError } = tasksResult.value;
        if (tasksError) {
          console.error('Error fetching tasks from Supabase:', tasksError);
        } else if (dbTasks) {
          setTasks(dbTasks.map(dbToTask));
        }
      } else {
        console.error('Tasks request rejected:', tasksResult.reason);
      }

      // 2. Process Events
      if (eventsResult.status === 'fulfilled') {
        const { data: dbEvents, error: eventsError } = eventsResult.value;
        if (eventsError) {
          console.error('Error fetching events from Supabase:', eventsError);
        } else if (dbEvents && dbEvents.length > 0) {
          const mappedEvents = dbEvents.map(dbToEvent);
          setEvents(mappedEvents);
          localStorage.setItem(`mindstream_events_seeded_${user.id}`, 'true');
        } else {
          // No events found in DB: check if this user was already initialized previously
          const hasSeeded = localStorage.getItem(`mindstream_events_seeded_${user.id}`);
          if (!hasSeeded) {
            localStorage.setItem(`mindstream_events_seeded_${user.id}`, 'true');
            const seededEvents = INITIAL_EVENTS.map(e => ({
              ...e,
              id: generateUuid()
            }));
            setEvents(seededEvents);

            const dbSeededEvents = seededEvents.map(e => eventToDb(e, user.id));
            resilientInsert('events', dbSeededEvents).catch(err => {
              console.error('Failed to seed events in Supabase:', err);
            });
          } else {
            setEvents([]);
          }
        }
      } else {
        console.error('Events request rejected:', eventsResult.reason);
      }

      // 3. Process Study Sessions
      if (sessionsResult.status === 'fulfilled') {
        const { data: dbSessions, error: sessionsError } = sessionsResult.value;
        if (sessionsError) {
          console.error('Error fetching study sessions:', sessionsError);
        } else if (dbSessions && dbSessions.length > 0) {
          setStudySessions(dbSessions);
          const totalHours = dbSessions.reduce((sum, s) => {
            const h = s.study_hours || s.studyHours || Number((s.duration_seconds || s.durationSeconds || 0) / 3600);
            return sum + Number(h);
          }, 0);
          setStudyHours(parseFloat(totalHours.toFixed(1)));
        } else {
          setStudySessions([]);
          setStudyHours(0);
        }
      } else {
        console.error('Study sessions request rejected:', sessionsResult.reason);
      }

      // 4. Process AI Conversations
      if (convsResult.status === 'fulfilled') {
        const { data: dbConversations, error: convError } = convsResult.value;
        if (convError) {
          console.error('Error fetching AI conversations:', convError);
        } else if (dbConversations && dbConversations.length > 0) {
          let currentActiveConvId = localStorage.getItem('mindstream_active_conv_id') || activeConversationIdRef.current;
          if (!currentActiveConvId || currentActiveConvId === 'conv-default' || !dbConversations.some(c => c.id === currentActiveConvId)) {
            currentActiveConvId = dbConversations[0].id;
          }

          if (!silent) {
            const reqToken = ++conversationLoadReqRef.current;
            try {
              const messages = await getConversationMessages(currentActiveConvId);
              if (conversationLoadReqRef.current !== reqToken || activeConversationIdRef.current !== currentActiveConvId) {
                return;
              }

              const mappedMessages = (messages || []).map(dbToChatMessage);
              const hasWelcome = mappedMessages.some(m => m.text === 'SPECIAL_TOKEN_WELCOME');
              if (!hasWelcome) {
                mappedMessages.unshift({
                  id: 'msg-welcome-init',
                  role: 'assistant',
                  text: 'SPECIAL_TOKEN_WELCOME',
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
              }

              setConversations(prev => {
                const prevMap = new Map(prev.map(c => [c.id, c]));
                const mappedConvs: ChatConversation[] = dbConversations.map(dbConv => {
                  const existing = prevMap.get(dbConv.id);
                  return {
                    id: dbConv.id,
                    title: dbConv.title || 'New Conversation',
                    createdAt: new Date(dbConv.created_at).toLocaleDateString(),
                    messages: dbConv.id === currentActiveConvId ? mappedMessages : (existing?.messages || [])
                  };
                });
                prev.forEach(c => {
                  if ((c.id === 'conv-default' || c.id.startsWith('conv-') || c.id === activeConversationIdRef.current) && !mappedConvs.some(m => m.id === c.id)) {
                    mappedConvs.push(c);
                  }
                });
                const seen = new Set<string>();
                const deduplicated = mappedConvs.filter(c => {
                  if (seen.has(c.id)) return false;
                  seen.add(c.id);
                  return true;
                });
                localStorage.setItem('mindstream_conversations', JSON.stringify(deduplicated));
                return deduplicated;
              });

              setActiveConversationId(currentActiveConvId);
              activeConversationIdRef.current = currentActiveConvId;
              localStorage.setItem('mindstream_active_conv_id', currentActiveConvId);
              setChatMessages(mappedMessages);
            } catch (msgErr) {
              console.error('Error fetching AI messages:', msgErr);
            }
          } else {
            setConversations(prev => {
              const prevMap = new Map(prev.map(c => [c.id, c]));
              const mappedConvs: ChatConversation[] = dbConversations.map(dbConv => {
                const existing = prevMap.get(dbConv.id);
                return {
                  id: dbConv.id,
                  title: dbConv.title || 'New Conversation',
                  createdAt: new Date(dbConv.created_at).toLocaleDateString(),
                  messages: existing?.messages || []
                };
              });
              prev.forEach(c => {
                if ((c.id === 'conv-default' || c.id.startsWith('conv-') || c.id === activeConversationIdRef.current) && !mappedConvs.some(m => m.id === c.id)) {
                  mappedConvs.push(c);
                }
              });
              const seen = new Set<string>();
              const deduplicated = mappedConvs.filter(c => {
                if (seen.has(c.id)) return false;
                seen.add(c.id);
                return true;
              });
              localStorage.setItem('mindstream_conversations', JSON.stringify(deduplicated));
              return deduplicated;
            });
          }
        } else if (!convError) {
          if (!silent) {
            const defaultConv: ChatConversation = {
              id: 'conv-default',
              title: t("defaultConversationTitle"),
              messages: [{
                id: 'msg-welcome-init',
                role: 'assistant',
                text: 'SPECIAL_TOKEN_WELCOME',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              }],
              createdAt: new Date().toLocaleDateString()
            };
            setConversations([defaultConv]);
            setActiveConversationId('conv-default');
            activeConversationIdRef.current = 'conv-default';
            localStorage.setItem('mindstream_active_conv_id', 'conv-default');
            localStorage.setItem('mindstream_conversations', JSON.stringify([defaultConv]));
            setChatMessages(defaultConv.messages);
          }
        }
      } else {
        console.error('AI conversations request rejected:', convsResult.reason);
      }
    } catch (err) {
      console.error('Unexpected error during Supabase sync:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [user]);

  // Track last synced user ID to avoid redundant full sync on session token refresh
  const lastSyncedUserIdRef = useRef<string | null>(null);

  // Initial sync on mount/login
  useEffect(() => {
    if (user && user.id !== lastSyncedUserIdRef.current) {
      lastSyncedUserIdRef.current = user.id;
      syncSupabaseData(false);
    }
  }, [user, syncSupabaseData]);

  // Auto-refresh data from Supabase periodically in the background
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      syncSupabaseData(true); // silent refresh
    }, 15000); // Poll every 15 seconds for hot updates
    return () => clearInterval(interval);
  }, [user, syncSupabaseData]);

  // Chat message input bar
  const [chatInput, setChatInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Pending destructive action awaiting explicit user confirmation before executing
  const [pendingConfirmation, setPendingConfirmation] = useState<PendingConfirmation | null>(null);

  // Notification message overlay
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiTyping]);

  // Prevent background body scrolling when a modal is open
  useEffect(() => {
    if (isAddingTask || isAddingEvent) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isAddingTask, isAddingEvent]);

  // Handle Pomodoro timer intervals
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        if (timerSeconds > 0) {
          setTimerSeconds((prev) => prev - 1);
        } else if (timerSeconds === 0) {
          if (timerMinutes > 0) {
            setTimerMinutes((prev) => prev - 1);
            setTimerSeconds(59);
          } else {
            // Timer complete! Log study hours
            setIsTimerRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            const addedHours = Number((timerTargetMinutes / 60).toFixed(2));
            setStudyHours((prev) => parseFloat((prev + addedHours).toFixed(1)));
            showBannerNotification(
              sessionGoal.trim()
                ? `Session complete! You worked on "${sessionGoal}". Great job!`
                : 'Session complete! Great job!',
              "success"
            );
            setTimerMinutes(timerTargetMinutes);
            setTimerSeconds(0);

            const newSession = {
              id: crypto.randomUUID(),
              user_id: user?.id,
              category: timerCategory,
              duration_seconds: timerTargetMinutes * 60,
              study_hours: addedHours,
              completed_at: new Date().toISOString()
            };
            setStudySessions((prev) => [...prev, newSession]);

            // Log session to Supabase
            if (user) {
              supabase
                .from('study_sessions')
                .insert({
                  id: newSession.id,
                  user_id: user.id,
                  category: newSession.category,
                  duration_seconds: newSession.duration_seconds,
                  study_hours: newSession.study_hours,
                  completed_at: newSession.completed_at
                })
                .then(({ data, error }) => {
                  console.log("Insert result:", data);
                  console.log("Insert error:", error);

                  if (error) {
                    console.error("Failed to log study session:", error);
                  }
                });
            }
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, timerMinutes, timerSeconds, timerCategory, sessionGoal, user, timerTargetMinutes]);

  // Utility to show global helper status banners
  const showBannerNotification = (message: string, type: 'success' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Authentication Helper functions
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      showBannerNotification(t('pleaseFillRegFields'), "info");
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await supabaseSignIn(loginEmail.trim(), loginPassword);
      showBannerNotification(t('welcomeToMindstream'), "success");
      setCurrentScreen('preloader');
    } catch (error: any) {
      console.error(error);
      showBannerNotification(error.message || t('registrationFailed'), "info");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsAuthSubmitting(true);

    // 1. Open the popup immediately to bypass browser popup blocker on user gesture
    const popup = window.open('', 'google_oauth_popup', 'width=550,height=680,scrollbars=yes,status=yes');
    if (!popup) {
      showBannerNotification(t('enterEmailFirst'), "info");
      setIsAuthSubmitting(false);
      return;
    }
    popup.document.write(`<div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif; text-align:center; padding-top:100px; color:#0A192F;"><p style="font-size:16px; font-weight:600;">${t('connectingWithGoogle')}</p><p style="font-size:12px; color:#777587;">${t('completingSecureHandshake')}</p></div>`);

    try {
      const data = await supabaseSignInWithGoogle();
      if (data?.url) {
        // 2. Redirect the popup to Google auth endpoint
        popup.location.href = data.url;
        showBannerNotification(t('accountCreatedSuccess'), "success");
      } else {
        popup.close();
        throw new Error("Could not retrieve Google sign-in URL from Supabase.");
      }
    } catch (error: any) {
      console.error(error);
      popup.close();
      showBannerNotification(error.message || t('registrationFailed'), "info");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim() || !registerEmail.trim() || !registerPassword.trim() || !registerConfirmPassword.trim()) {
      showBannerNotification(t('pleaseFillRegFields'), "info");
      return;
    }

    if (registerPassword !== registerConfirmPassword) {
      showBannerNotification(t('passwordsDoNotMatch'), "info");
      return;
    }

    setIsAuthSubmitting(true);
    try {
      await supabaseSignUp(
        registerEmail.trim(),
        registerPassword,
        registerName.trim(),
        registerStudentLevel
      );
      showBannerNotification(t('accountCreatedSuccess'), "success");
      // Clear registration fields
      setRegisterName('');
      setRegisterEmail('');
      setRegisterPassword('');
      setRegisterConfirmPassword('');
      setCurrentScreen('login');
    } catch (error: any) {
      console.error(error);
      showBannerNotification(error.message || t('registrationFailed'), "info");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      showBannerNotification(t('enterEmailFirst'), "info");
      return;
    }
    setIsAuthSubmitting(true);
    try {
      await supabaseResetPassword(loginEmail.trim());
      showBannerNotification(t('resetLinkSent', { email: loginEmail.trim() }), "success");
    } catch (error: any) {
      console.error(error);
      showBannerNotification(error.message || t('failedSendReset'), "info");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabaseSignOut();
      // Clear user data from application state
      setCurrentUser(null);
      setTasks([]);
      setEvents(INITIAL_EVENTS);
      setStudyHours(4.5);
      // Clear authentication session / tokens from localStorage and sessionStorage
      localStorage.removeItem('mindstream_currentUser');
      localStorage.removeItem('mindstream_auth_token');
      localStorage.removeItem('mindstream_conversations');
      localStorage.removeItem('mindstream_active_conv_id');
      sessionStorage.removeItem('mindstream_currentUser');
      sessionStorage.removeItem('mindstream_auth_token');

      const defaultConv: ChatConversation = {
        id: 'conv-default',
        title: t("defaultConversationTitle"),
        messages: [{
          id: 'msg-welcome-init',
          role: 'assistant',
          text: 'SPECIAL_TOKEN_WELCOME',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }],
        createdAt: new Date().toLocaleDateString()
      };
      setConversations([defaultConv]);
      setActiveConversationId('conv-default');
      activeConversationIdRef.current = 'conv-default';
      setChatMessages(defaultConv.messages);

      // Close the profile menu
      setIsProfileMenuOpen(false);

      // Display precise toast message
      showBannerNotification(t('loggedOutSuccess'), "success");

      // Redirect to login page
      setCurrentScreen('login');
    } catch (error: any) {
      console.error(error);
      showBannerNotification(t('failedSignOut'), "info");
    }
  };

  // Skip onboarding entirely or transition slides
  const handleOnboardingNext = () => {
    if (onboardingSlide < 3) {
      setOnboardingSlide((prev) => prev + 1);
    } else {
      localStorage.setItem('mindstream_onboarding_completed', 'true');
      setCurrentScreen('login');
    }
  };

  const handleOnboardingSkip = () => {
    localStorage.setItem('mindstream_onboarding_completed', 'true');
    setCurrentScreen('login');
  };

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  // Preloader progress bar self-acting transition
  useEffect(() => {
    if (currentScreen === 'preloader') {
      const timer = setTimeout(() => {
        setCurrentScreen('main');
        showBannerNotification(t('goodMorningSynced', { name: currentUserRef.current?.fullName?.split(' ')[0] || 'Gabriel' }), "info");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);

  // Protected Routes Enforcer: redirect to login if currentScreen is main but no user is logged in
  useEffect(() => {
    if (!authLoading && currentScreen === 'main' && !user) {
      setCurrentScreen('login');
    }
  }, [currentScreen, user, authLoading]);

  // Helper methods to manage chat conversations and sessions
  const handleSelectConversation = useCallback(async (convId: string) => {
    if (!convId) return;

    // 1. Authoritative active ID update
    setActiveConversationId(convId);
    activeConversationIdRef.current = convId;
    localStorage.setItem('mindstream_active_conv_id', convId);

    // 2. Increment request token to invalidate in-flight fetches for previous conversations (stale-guard)
    const reqToken = ++conversationLoadReqRef.current;

    // 3. Immediately display cached messages from memory if available
    const existing = conversations.find(c => c.id === convId);
    if (existing && existing.messages && existing.messages.length > 0) {
      setChatMessages(existing.messages);
    } else {
      setChatMessages([{
        id: 'msg-welcome-init',
        role: 'assistant',
        text: 'SPECIAL_TOKEN_WELCOME',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }

    // 4. If logged in and this is a persisted Supabase conversation, fetch authoritative messages
    if (user && isValidUuid(convId)) {
      try {
        const messages = await getConversationMessages(convId);
        // STALE GUARD: check if the user is still on this conversation and this request is the latest
        if (conversationLoadReqRef.current !== reqToken || activeConversationIdRef.current !== convId) {
          return;
        }

        const mappedMessages = (messages || []).map(dbToChatMessage);
        if (!mappedMessages.some(m => m.text === 'SPECIAL_TOKEN_WELCOME')) {
          mappedMessages.unshift({
            id: 'msg-welcome-init',
            role: 'assistant',
            text: 'SPECIAL_TOKEN_WELCOME',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          });
        }

        setChatMessages(mappedMessages);
        setConversations(prev => {
          const updated = prev.map(c => c.id === convId ? { ...c, messages: mappedMessages } : c);
          localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
          return updated;
        });
      } catch (err) {
        console.error('Failed to load messages for conversation:', convId, err);
      }
    }
  }, [conversations, user]);

  const handleNewChat = async () => {
    // Check if current conversation is already an empty conversation with no user messages
    const currentConv = conversations.find(c => c.id === activeConversationIdRef.current);
    const hasUserMessages = chatMessages.some(m => m.role === 'user');
    const isCurrentEmpty = !hasUserMessages && (!currentConv || currentConv.messages.every(m => m.role !== 'user'));

    if (isCurrentEmpty && currentConv) {
      // Already on a clean empty session: avoid duplicate empty database entries
      showBannerNotification(t('startedNewStudySession'), "info");
      return;
    }

    let newId = `conv-${Date.now()}`;
    let title = t('newChat') || 'New Conversation';
    let createdAt = new Date().toLocaleDateString();

    if (user) {
      try {
        const dbConv = await createConversation(user.id, "New Conversation");
        if (dbConv && dbConv.id) {
          newId = dbConv.id;
          title = dbConv.title || 'New Conversation';
          createdAt = new Date(dbConv.created_at || Date.now()).toLocaleDateString();
        }
      } catch (err) {
        console.error('Failed to create new conversation in Supabase:', err);
      }
    }

    const welcomeMessage: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      role: 'assistant',
      text: 'SPECIAL_TOKEN_WELCOME',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newConv: ChatConversation = {
      id: newId,
      title,
      messages: [welcomeMessage],
      createdAt
    };

    setConversations(prev => {
      const updated = [newConv, ...prev.filter(c => c.id !== newId)];
      localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
      return updated;
    });
    setActiveConversationId(newId);
    activeConversationIdRef.current = newId;
    localStorage.setItem('mindstream_active_conv_id', newId);
    setChatMessages([welcomeMessage]);
    showBannerNotification(t('startedNewStudySession'), "success");
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      showBannerNotification(t('mustKeepOneChat'), "info");
      return;
    }
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
    if (activeConversationIdRef.current === id) {
      const nextActive = updated[0].id;
      handleSelectConversation(nextActive);
    }
    if (user && isValidUuid(id)) {
      try {
        await supabase.from('ai_conversations').delete().eq('id', id).eq('user_id', user.id);
      } catch (err) {
        console.error('Failed to delete conversation from Supabase:', err);
      }
    }
    showBannerNotification(t('chatSessionDeleted'), "info");
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(id);
    setRenameTitleInput(currentTitle);
  };

  const handleSaveRename = async (id: string, e: React.FormEvent) => {
    e.preventDefault();
    const newTitle = renameTitleInput.trim();
    if (!newTitle) return;
    setConversations(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, title: newTitle } : c);
      localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
      return updated;
    });
    setEditingConvId(null);
    if (user && isValidUuid(id)) {
      updateConversationTitle(id, newTitle);
    }
    showBannerNotification(t('conversationRenamed'), "success");
  };

  // Helper to render markdown-like text formatting for messages
  const renderMessageText = (text: string, msgId?: string) => {
    const isWelcomeMessage =
      text === 'SPECIAL_TOKEN_WELCOME' ||
      (msgId && (msgId === 'msg-welcome-init' || msgId.startsWith('msg-welcome-'))) ||
      text.includes("MindStream AI Assistant") ||
      text.includes("assistant IA MindStream") ||
      text.includes("Asisten AI MindStream") ||
      text.includes("Asistente de IA MindStream") ||
      text.includes("مساعد الذكاء الاصطناعي");

    if (isWelcomeMessage) {
      text = t('aiAssistantWelcome');
    }

    if (!text) return null; const lines = text.split('\n');
    return lines.map((line, idx) => {
      // Check if line is a bullet point
      const isBullet = line.trim().startsWith('- ') || line.trim().startsWith('* ');
      let content = line;
      if (isBullet) {
        content = line.trim().replace(/^[\-\*]\s+/, '');
      }

      // Replace bold syntax **text** with strong elements
      const parts = [];
      const boldRegex = /\*\*([^*]+)\*\*/g;
      let match;
      let lastIndex = 0;

      while ((match = boldRegex.exec(content)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
          parts.push(content.substring(lastIndex, match.index));
        }
        // Add strong element
        parts.push(
          <strong key={match.index} className="font-extrabold text-brand">
            {match[1]}
          </strong>
        );
        lastIndex = boldRegex.lastIndex;
      }

      if (lastIndex < content.length) {
        parts.push(content.substring(lastIndex));
      }

      let lineElement;
      if (parts.length === 0) {
        lineElement = <span>{content}</span>;
      } else {
        lineElement = <>{parts}</>;
      }

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc pl-1 text-xs md:text-sm leading-relaxed mt-1 first:mt-0 text-main-text">
            {lineElement}
          </li>
        );
      } else {
        return (
          <p key={idx} className="text-xs md:text-sm leading-relaxed min-h-[1.25rem] text-main-text">
            {lineElement}
          </p>
        );
      }
    });
  };

  // ─── AI Action Execution Helpers ─────────────────────────────────────────────

  // Helper: add a system-style result message to chat
  const appendAiMessage = (text: string) => {
    const currentActiveId = activeConversationIdRef.current;
    const msg: ChatMessage = {
      id: `msg-ai-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: 'assistant',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages((prev) => [...prev, msg]);
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === currentActiveId ? { ...c, messages: [...c.messages, msg] } : c
      );
      localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
      return updated;
    });
  };

  // Create a task via AI action — reuses generateUuid, setTasks, taskToDb, resilientInsert
  const executeCreateTask = async (params: CreateTaskParams) => {
    const newTaskId = generateUuid();
    const todayStr = getLocalDateString();
    const newTask: Task = {
      id: newTaskId,
      title: params.title,
      category: params.category || 'General',
      dueDate: params.dueDate || todayStr,
      dueTime: params.dueTime || '',
      priority: params.priority || 'medium',
      status: 'pending',
      notes: params.notes || '',
      location: params.location || '',
      reminder: params.reminder || false,
      completedPercent: 0
    };

    setTasks((prev) => [newTask, ...prev]);

    let persistMsg = '';
    if (user) {
      try {
        const { error } = await resilientInsert('tasks', taskToDb(newTask, user.id));
        if (error) {
          console.error('[AI Action] Task insert error:', error);
          persistMsg = ' *(saved locally; cloud sync failed)*';
        }
      } catch (err) {
        console.error('[AI Action] Task insert exception:', err);
        persistMsg = ' *(saved locally; cloud sync failed)*';
      }
    }

    const dateDisplay = newTask.dueDate !== todayStr ? newTask.dueDate : 'today';
    const timeDisplay = newTask.dueTime ? ` at ${newTask.dueTime}` : '';
    appendAiMessage(`✓ Task created: **${newTask.title}** — ${dateDisplay}${timeDisplay}.${persistMsg}`);
  };

  // Create a calendar event via AI action — reuses generateUuid, setEvents, eventToDb, resilientInsert
  const executeCreateEvent = async (params: CreateEventParams) => {
    const newEventId = generateUuid();
    const newEvent: CalendarEvent = {
      id: newEventId,
      title: params.title,
      date: params.date,
      time: params.time || '09:00 AM',
      duration: params.duration ?? 1.0,
      location: params.location || '',
      type: (params.type as CalendarEvent['type']) || 'study',
      subject: params.subject || ''
    };

    setEvents((prev) => [...prev, newEvent]);

    let persistMsg = '';
    if (user) {
      try {
        const { error } = await resilientInsert('events', eventToDb(newEvent, user.id));
        if (error) {
          console.error('[AI Action] Event insert error:', error);
          persistMsg = ' *(saved locally; cloud sync failed)*';
        }
      } catch (err) {
        console.error('[AI Action] Event insert exception:', err);
        persistMsg = ' *(saved locally; cloud sync failed)*';
      }
    }

    appendAiMessage(`✓ Calendar event created: **${newEvent.title}** — ${newEvent.date} at ${newEvent.time}.${persistMsg}`);
  };

  // Execute an event update via AI action
  const executeUpdateEvent = async (params: UpdateEventParams) => {
    const rawId = params.eventId ? String(params.eventId).trim() : '';
    const currentEvents = eventsRef.current || events;
    const targetEvent = currentEvents.find(
      (e) => e.id === rawId || e.id.toLowerCase() === rawId.toLowerCase()
    );

    if (!targetEvent) {
      appendAiMessage(`⚠️ I couldn't find that calendar event right now. Please try again.`);
      return;
    }

    const updatedEvent: CalendarEvent = {
      ...targetEvent,
      title: params.title ?? targetEvent.title,
      date: params.date ?? targetEvent.date,
      time: params.time ?? targetEvent.time,
      duration: params.duration !== undefined ? Number(params.duration) : targetEvent.duration,
      location: params.location ?? targetEvent.location,
      type: (params.type as CalendarEvent['type']) ?? targetEvent.type,
      subject: params.subject ?? targetEvent.subject
    };

    eventsRef.current = currentEvents.map((e) => (e.id === targetEvent.id ? updatedEvent : e));
    setEvents((prev) => prev.map((e) => (e.id === targetEvent.id ? updatedEvent : e)));

    let persistMsg = '';
    if (user && isValidUuid(updatedEvent.id)) {
      try {
        const { error } = await resilientUpdate('events', updatedEvent.id, user.id, eventToDb(updatedEvent, user.id));
        if (error) {
          console.error('[AI Action] Event update error:', error);
          persistMsg = ' *(saved locally; cloud sync failed)*';
        }
      } catch (err) {
        console.error('[AI Action] Event update exception:', err);
        persistMsg = ' *(saved locally; cloud sync failed)*';
      }
    }

    appendAiMessage(`✓ Calendar event updated: **${updatedEvent.title}**${persistMsg}`);
  };

  // Execute a task update via AI action — mirrors executeUpdateEvent
  const executeUpdateTask = async (params: UpdateTaskParams) => {
    const rawId = params.taskId ? String(params.taskId).trim() : '';
    const targetTask = tasks.find(
      (t) => t.id === rawId || t.id.toLowerCase() === rawId.toLowerCase()
    );

    if (!targetTask) {
      appendAiMessage(`⚠️ I couldn't find that task. Could you tell me which task you mean?`);
      return;
    }

    // Validate status value if provided
    const allowedStatuses: Task['status'][] = ['pending', 'progress', 'completed'];
    const newStatus = params.status && allowedStatuses.includes(params.status as Task['status'])
      ? (params.status as Task['status'])
      : targetTask.status;

    // Validate priority value if provided
    const allowedPriorities: Priority[] = ['low', 'medium', 'high'];
    const newPriority = params.priority && allowedPriorities.includes(params.priority as Priority)
      ? (params.priority as Priority)
      : targetTask.priority;

    const updatedTask: Task = {
      ...targetTask,
      title: params.title !== undefined ? params.title : targetTask.title,
      dueDate: params.dueDate !== undefined ? params.dueDate : targetTask.dueDate,
      dueTime: params.dueTime !== undefined ? params.dueTime : targetTask.dueTime,
      priority: newPriority,
      status: newStatus,
      category: params.category !== undefined ? params.category : targetTask.category,
      notes: params.notes !== undefined ? params.notes : targetTask.notes,
      location: params.location !== undefined ? params.location : targetTask.location,
    };

    setTasks((prev) => prev.map((t) => (t.id === targetTask.id ? updatedTask : t)));

    // Build a human-readable summary of what changed
    const changes: string[] = [];
    if (params.title !== undefined) changes.push(`title changed to "${updatedTask.title}"`);
    if (params.dueDate !== undefined) changes.push(`due date changed to ${updatedTask.dueDate}`);
    if (params.dueTime !== undefined) changes.push(`due time changed to ${updatedTask.dueTime}`);
    if (params.priority !== undefined) changes.push(`priority changed to ${updatedTask.priority}`);
    if (params.status !== undefined) changes.push(`status changed to ${updatedTask.status}`);
    if (params.category !== undefined) changes.push(`category changed to ${updatedTask.category}`);
    if (params.notes !== undefined) changes.push(`notes updated`);
    if (params.location !== undefined) changes.push(`location changed to ${updatedTask.location}`);
    const changeSummary = changes.length > 0 ? ` — ${changes.join(', ')}` : '';

    let persistMsg = '';
    if (user && isValidUuid(updatedTask.id)) {
      try {
        const { error } = await resilientUpdate('tasks', updatedTask.id, user.id, taskToDb(updatedTask, user.id));
        if (error) {
          console.error('[AI Action] Task update error:', error);
          persistMsg = ' *(saved locally; cloud sync failed)*';
        }
      } catch (err) {
        console.error('[AI Action] Task update exception:', err);
        persistMsg = ' *(saved locally; cloud sync failed)*';
      }
    }

    appendAiMessage(`✓ Task updated: **${updatedTask.title}**${changeSummary}.${persistMsg}`);
  };

  // Execute a confirmed task deletion — reuses the existing deleteTask function
  const executeDeleteTask = async (taskId: string, taskTitle: string) => {
    try {
      await deleteTask(taskId);
      appendAiMessage(`✓ Task deleted: **${taskTitle}**.`);
    } catch (err) {
      console.error('[AI Action] Task delete failed:', err);
      appendAiMessage(`❌ Could not delete task **${taskTitle}**. Please try again from the Tasks screen.`);
    }
  };

  // Execute a confirmed event deletion — reuses the existing deleteEvent function
  const executeDeleteEvent = async (eventId: string, eventTitle: string) => {
    try {
      await deleteEvent(eventId);
      appendAiMessage(`✓ Calendar event deleted: **${eventTitle}**.`);
    } catch (err) {
      console.error('[AI Action] Event delete failed:', err);
      appendAiMessage(`❌ Could not delete event **${eventTitle}**. Please try again from the Calendar screen.`);
    }
  };

  // Execute a confirmed bulk deletion of all tasks
  const executeDeleteAllTasks = async (): Promise<boolean> => {
    let dbSuccess = true;
    let errorMessage = '';
    let deletedCount = 0;

    if (user) {
      try {
        const { data: deletedRows, error } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .select('id');
        if (error) {
          dbSuccess = false;
          errorMessage = error.message;
          console.error('[AI Action] Failed to delete all tasks from Supabase:', error);
        } else {
          deletedCount = Array.isArray(deletedRows) ? deletedRows.length : tasks.length;
        }
      } catch (err: any) {
        dbSuccess = false;
        errorMessage = err?.message || 'Database error';
        console.error('[AI Action] Task bulk delete exception:', err);
      }
    } else {
      deletedCount = tasks.length;
    }

    if (!dbSuccess) {
      appendAiMessage(`❌ Failed to delete tasks: ${errorMessage}. Your tasks were preserved.`);
      return false;
    }

    // Update React state immediately upon successful database deletion
    setTasks([]);
    showBannerNotification(t('taskRemoved') || 'All tasks removed', "info");

    if (deletedCount === 0) {
      appendAiMessage("You had no tasks across any date. 0 records were found to delete.");
    } else {
      appendAiMessage(`✓ All tasks have been permanently deleted across every date (${deletedCount} ${deletedCount === 1 ? 'task' : 'tasks'} removed).`);
    }
    return true;
  };

  // Execute a confirmed bulk deletion of all calendar events
  const executeDeleteAllEvents = async (): Promise<boolean> => {
    let dbSuccess = true;
    let errorMessage = '';
    let deletedCount = 0;

    if (user) {
      try {
        const { data: deletedRows, error } = await supabase
          .from('events')
          .delete()
          .eq('user_id', user.id)
          .select('id');
        if (error) {
          dbSuccess = false;
          errorMessage = error.message;
          console.error('[AI Action] Failed to delete all events from Supabase:', error);
        } else {
          deletedCount = Array.isArray(deletedRows) ? deletedRows.length : events.length;
          // Mark that events have been initialized/managed for this user so refresh won't re-seed
          localStorage.setItem(`mindstream_events_seeded_${user.id}`, 'true');
        }
      } catch (err: any) {
        dbSuccess = false;
        errorMessage = err?.message || 'Database error';
        console.error('[AI Action] Event bulk delete exception:', err);
      }
    } else {
      deletedCount = events.length;
    }

    if (!dbSuccess) {
      appendAiMessage(`❌ Failed to delete calendar events: ${errorMessage}. Your calendar events were preserved.`);
      return false;
    }

    // Update React state immediately upon successful database deletion
    setEvents([]);
    showBannerNotification(t('eventRemoved') || 'All events removed', "info");

    if (deletedCount === 0) {
      appendAiMessage("You had no calendar events across any date. 0 records were found to delete.");
    } else {
      appendAiMessage(`✓ All calendar events have been permanently deleted across every date (${deletedCount} ${deletedCount === 1 ? 'event' : 'events'} removed).`);
    }
    return true;
  };

  // Execute confirmed combined bulk deletion of tasks AND calendar events
  const executeDeleteAllTasksAndEvents = async () => {
    let tasksSuccess = true;
    let eventsSuccess = true;
    let tasksErrMsg = '';
    let eventsErrMsg = '';
    let tasksDeletedCount = 0;
    let eventsDeletedCount = 0;

    if (user) {
      // 1. Delete tasks scoped to user
      try {
        const { data: deletedTasks, error: taskErr } = await supabase
          .from('tasks')
          .delete()
          .eq('user_id', user.id)
          .select('id');
        if (taskErr) {
          tasksSuccess = false;
          tasksErrMsg = taskErr.message;
          console.error('[AI Action] Bulk tasks delete error:', taskErr);
        } else {
          tasksDeletedCount = Array.isArray(deletedTasks) ? deletedTasks.length : tasks.length;
        }
      } catch (err: any) {
        tasksSuccess = false;
        tasksErrMsg = err?.message || 'Database error';
        console.error('[AI Action] Bulk tasks delete exception:', err);
      }

      // 2. Delete events scoped to user
      try {
        const { data: deletedEvents, error: eventErr } = await supabase
          .from('events')
          .delete()
          .eq('user_id', user.id)
          .select('id');
        if (eventErr) {
          eventsSuccess = false;
          eventsErrMsg = eventErr.message;
          console.error('[AI Action] Bulk events delete error:', eventErr);
        } else {
          eventsDeletedCount = Array.isArray(deletedEvents) ? deletedEvents.length : events.length;
          localStorage.setItem(`mindstream_events_seeded_${user.id}`, 'true');
        }
      } catch (err: any) {
        eventsSuccess = false;
        eventsErrMsg = err?.message || 'Database error';
        console.error('[AI Action] Bulk events delete exception:', err);
      }
    } else {
      tasksDeletedCount = tasks.length;
      eventsDeletedCount = events.length;
    }

    // Update React state only for successful operations
    if (tasksSuccess) {
      setTasks([]);
    }
    if (eventsSuccess) {
      setEvents([]);
    }

    if (tasksSuccess && eventsSuccess) {
      showBannerNotification(t('taskRemoved') || 'Tasks and events removed', "info");
      if (tasksDeletedCount === 0 && eventsDeletedCount === 0) {
        appendAiMessage("You had no tasks or calendar events across any date. 0 records were found to delete.");
      } else if (tasksDeletedCount > 0 && eventsDeletedCount === 0) {
        appendAiMessage(`✓ All tasks have been permanently deleted across every date (${tasksDeletedCount} ${tasksDeletedCount === 1 ? 'task' : 'tasks'} removed). No calendar events were found to delete.`);
      } else if (tasksDeletedCount === 0 && eventsDeletedCount > 0) {
        appendAiMessage(`✓ All calendar events have been permanently deleted across every date (${eventsDeletedCount} ${eventsDeletedCount === 1 ? 'event' : 'events'} removed). No tasks were found to delete.`);
      } else {
        appendAiMessage(`✓ All tasks (${tasksDeletedCount}) and calendar events (${eventsDeletedCount}) have been permanently deleted across every date.`);
      }
    } else if (tasksSuccess && !eventsSuccess) {
      showBannerNotification(t('taskRemoved') || 'Tasks removed', "info");
      const taskPart = tasksDeletedCount === 0
        ? "0 tasks were found to delete."
        : `All tasks were permanently deleted (${tasksDeletedCount} removed).`;
      appendAiMessage(`✓ ${taskPart} ❌ However, calendar events could not be deleted (${eventsErrMsg}). Your calendar events were preserved.`);
    } else if (!tasksSuccess && eventsSuccess) {
      showBannerNotification(t('eventRemoved') || 'Events removed', "info");
      const eventPart = eventsDeletedCount === 0
        ? "0 calendar events were found to delete."
        : `All calendar events were permanently deleted (${eventsDeletedCount} removed).`;
      appendAiMessage(`✓ ${eventPart} ❌ However, tasks could not be deleted (${tasksErrMsg}). Your tasks were preserved.`);
    } else {
      appendAiMessage(`❌ Failed to delete tasks (${tasksErrMsg}) and calendar events (${eventsErrMsg}). Your data was preserved.`);
    }
  };

  // ─── Main Chat Message Handler ────────────────────────────────────────────────

  // Post User chat prompts server-side to Gemini
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim()) return;

    // ── Authoritative Conversation Identity Captured Immediately ─────────────
    const sendConversationId = activeConversationIdRef.current;

    const userMsgId = `msg-user-${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: timeStr
    };

    // Single optimistic UI append
    setChatMessages((prev) => [...prev, newUserMessage]);
    setChatInput('');

    // ── Confirmation Intercept ──────────────────────────────────────────────────
    // If a destructive action is waiting for confirmation, resolve it before
    // sending anything to Gemini.
    if (pendingConfirmation) {
      const cleanInput = textToSend.toLowerCase().trim().replace(/[.,!?;:]+$/, '');
      const isConfirm = ['yes', 'y', 'confirm', 'delete it', 'sure', 'proceed', 'ok', 'go ahead', 'do it'].some(w => cleanInput === w || cleanInput.startsWith(w + ' '));
      const isCancel = ['no', 'n', 'cancel', 'stop', 'keep it', 'never mind', 'nevermind', 'abort', "don't", 'dont', "don't delete", "dont delete", "do not delete"].some(w => cleanInput === w || cleanInput.startsWith(w + ' '));

      if (isConfirm) {
        const { type, targetId, targetTitle } = pendingConfirmation;
        setPendingConfirmation(null);
        if (type === 'DELETE_TASK' && targetId && targetTitle) {
          await executeDeleteTask(targetId, targetTitle);
        } else if (type === 'DELETE_EVENT' && targetId && targetTitle) {
          await executeDeleteEvent(targetId, targetTitle);
        } else if (type === 'DELETE_ALL_TASKS') {
          await executeDeleteAllTasks();
        } else if (type === 'DELETE_ALL_EVENTS') {
          await executeDeleteAllEvents();
        } else if (type === 'DELETE_ALL_TASKS_AND_EVENTS') {
          await executeDeleteAllTasksAndEvents();
        }
        return; // Handled locally — no Gemini call needed
      } else if (isCancel) {
        const { type, targetTitle } = pendingConfirmation;
        setPendingConfirmation(null);
        if (type === 'DELETE_ALL_TASKS') {
          appendAiMessage("Deletion cancelled. All tasks were kept.");
        } else if (type === 'DELETE_ALL_EVENTS') {
          appendAiMessage("Deletion cancelled. All calendar events were kept.");
        } else if (type === 'DELETE_ALL_TASKS_AND_EVENTS') {
          appendAiMessage("Deletion cancelled. Nothing was deleted.");
        } else {
          appendAiMessage(`Deletion cancelled. **${targetTitle || 'Item'}** was kept.`);
        }
        return; // Handled locally — no Gemini call needed
      } else {
        // User said something ambiguous — clear pending action and let Gemini respond
        setPendingConfirmation(null);
      }
    }

    setIsAiTyping(true);

    // ── Target Conversation Resolution & Persistence ─────────────────────────
    let persistedConvId = sendConversationId;
    const isUnpersistedLocal = !sendConversationId || sendConversationId === 'conv-default' || sendConversationId.startsWith('conv-');

    if (user && isUnpersistedLocal) {
      // First message in an unpersisted session: create exactly ONE database row with generated title
      const autoTitle = generateTitleFromMessage(textToSend);
      try {
        const dbConv = await createConversation(user.id, autoTitle);
        if (dbConv && dbConv.id) {
          persistedConvId = dbConv.id;
          if (activeConversationIdRef.current === sendConversationId) {
            setActiveConversationId(persistedConvId);
            activeConversationIdRef.current = persistedConvId;
            localStorage.setItem('mindstream_active_conv_id', persistedConvId);
          }

          setConversations(prev => {
            // Precise replacement: only replace this exact session, never blanket match
            const updated = prev.map(c =>
              c.id === sendConversationId
                ? { ...c, id: persistedConvId, title: autoTitle, messages: [...c.messages, newUserMessage] }
                : c
            );
            localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
            return updated;
          });
        }
      } catch (convErr) {
        console.error('Failed to create conversation in Supabase:', convErr);
      }
    } else if (user && isValidUuid(sendConversationId)) {
      persistedConvId = sendConversationId;
      const currentConv = conversations.find(c => c.id === sendConversationId);
      const isPlaceholder =
        !currentConv ||
        currentConv.title === 'New Conversation' ||
        currentConv.title === t('newChat') ||
        currentConv.title === t('defaultConversationTitle') ||
        currentConv.title === t('untitledConversation');

      if (isPlaceholder) {
        const autoTitle = generateTitleFromMessage(textToSend);
        updateConversationTitle(persistedConvId, autoTitle);
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === persistedConvId
              ? { ...c, title: autoTitle, messages: [...c.messages, newUserMessage] }
              : c
          );
          localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
          return updated;
        });
      } else {
        setConversations(prev => {
          const updated = prev.map(c =>
            c.id === persistedConvId ? { ...c, messages: [...c.messages, newUserMessage] } : c
          );
          localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
          return updated;
        });
      }
    } else {
      // Guest or local mode
      setConversations(prev => {
        const updated = prev.map(c =>
          c.id === sendConversationId ? { ...c, messages: [...c.messages, newUserMessage] } : c
        );
        localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
        return updated;
      });
    }

    if (user && isValidUuid(persistedConvId)) {
      try {
        await saveMessage(persistedConvId, 'user', textToSend);
      } catch (saveErr) {
        console.error('Failed to save user message to Supabase:', saveErr);
      }
    }

    try {
      // ── Build real-time workspace context for Gemini ───────────────────────
      const nowForCtx = new Date();
      const ctx: AIRequestContext = {
        currentDate: getLocalDateString(nowForCtx),
        currentTime: nowForCtx.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
        currentDay: nowForCtx.toLocaleDateString('en-US', { weekday: 'long' }),
        tasks: tasks
          .filter(t => t.status !== 'completed')
          .slice(0, 50)
          .map(t => ({
            id: t.id,
            title: t.title,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            priority: t.priority,
            status: t.status,
            category: t.category,
            notes: t.notes ? t.notes.slice(0, 120) : undefined,
            location: t.location
          })),
        events: (eventsRef.current || events)
          .slice(0, 50)
          .map(e => ({
            id: e.id,
            title: e.title,
            date: e.date,
            time: e.time,
            duration: e.duration,
            location: e.location,
            type: e.type,
            subject: e.subject
          }))
      };

      // Package conversation history specific to this conversation (exclude welcome tokens and current message)
      const targetConv = conversations.find(c => c.id === sendConversationId || c.id === persistedConvId);
      const historySource = targetConv?.messages && targetConv.messages.length > 0
        ? targetConv.messages
        : chatMessages;

      const chatHistory = historySource
        .filter(m => m.text !== 'SPECIAL_TOKEN_WELCOME' && m.id !== userMsgId)
        .map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          text: m.text
        }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, history: chatHistory, context: ctx })
      });

      if (!response.ok) {
        throw new Error('Server issues processing prompt.');
      }

      const data = await response.json();
      const aiResponseText = data.text || 'I was able to analyze that. How else can I help you?';
      const action: AIAction | null = data.action || null;
      const actions: AIAction[] = Array.isArray(data.actions) && data.actions.length > 0
        ? data.actions
        : (action ? [action] : []);

      // Append AI conversational reply to chat if user is still viewing this conversation
      const aiMsgId = `msg-ai-${Date.now()}`;
      const newAiMessage: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (activeConversationIdRef.current === persistedConvId || activeConversationIdRef.current === sendConversationId) {
        setChatMessages((prev) => [...prev, newAiMessage]);
      }

      // Always update the target conversation's cached messages in state and localStorage
      setConversations((prev) => {
        const updated = prev.map((c) =>
          (c.id === persistedConvId || c.id === sendConversationId)
            ? { ...c, messages: [...c.messages, newAiMessage] }
            : c
        );
        localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
        return updated;
      });

      if (user && isValidUuid(persistedConvId)) {
        try {
          await saveMessage(persistedConvId, 'assistant', aiResponseText);
        } catch (saveErr) {
          console.error('Failed to save assistant message to Supabase:', saveErr);
        }
      }

      // ── Execute or stage the action(s) ─────────────────────────────────────
      const hasDeleteAllTasks = actions.some(a => a.type === 'DELETE_ALL_TASKS');
      const hasDeleteAllEvents = actions.some(a => a.type === 'DELETE_ALL_EVENTS');

      if (hasDeleteAllTasks && hasDeleteAllEvents) {
        setPendingConfirmation({
          type: 'DELETE_ALL_TASKS_AND_EVENTS',
          targetTitle: 'all tasks and calendar events',
          actions
        });
      } else if (hasDeleteAllTasks) {
        setPendingConfirmation({
          type: 'DELETE_ALL_TASKS',
          targetTitle: 'all tasks',
          actions
        });
      } else if (hasDeleteAllEvents) {
        setPendingConfirmation({
          type: 'DELETE_ALL_EVENTS',
          targetTitle: 'all calendar events',
          actions
        });
      } else if (actions.length > 0) {
        for (const act of actions) {
          if (act.type === 'CREATE_TASK') {
            const p = act.params as CreateTaskParams;
            if (p?.title) {
              await executeCreateTask(p);
            }
          } else if (act.type === 'CREATE_EVENT') {
            const p = act.params as CreateEventParams;
            if (p?.title && p?.date) {
              await executeCreateEvent(p);
            }
          } else if (act.type === 'DELETE_TASK') {
            // Stage for confirmation — do NOT delete yet
            const p = act.params as DeleteTaskParams;
            if (p?.taskId && p?.taskTitle) {
              setPendingConfirmation({
                type: 'DELETE_TASK',
                targetId: p.taskId,
                targetTitle: p.taskTitle
              });
            }
          } else if (act.type === 'DELETE_EVENT') {
            // Stage for confirmation — do NOT delete yet
            const p = act.params as DeleteEventParams;
            if (p?.eventId && p?.eventTitle) {
              setPendingConfirmation({
                type: 'DELETE_EVENT',
                targetId: p.eventId,
                targetTitle: p.eventTitle
              });
            }
          } else if (act.type === 'UPDATE_EVENT') {
            const p = act.params as UpdateEventParams;
            if (p?.eventId) {
              await executeUpdateEvent(p);
            }
          } else if (act.type === 'UPDATE_TASK') {
            // Non-destructive — execute directly without staging for confirmation
            const p = act.params as UpdateTaskParams;
            if (p?.taskId) {
              await executeUpdateTask(p);
            } else {
              appendAiMessage(`⚠️ I couldn't find that task. Could you tell me which task you mean?`);
            }
          }
        }
      }

    } catch (err: any) {
      console.error(err);
      const errMsg: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        text: t('networkIssueGemini'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      if (activeConversationIdRef.current === persistedConvId || activeConversationIdRef.current === sendConversationId) {
        setChatMessages((prev) => [...prev, errMsg]);
      }
      setConversations((prev) => {
        const updated = prev.map((c) =>
          (c.id === persistedConvId || c.id === sendConversationId)
            ? { ...c, messages: [...c.messages, errMsg] }
            : c
        );
        localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
        return updated;
      });
    } finally {
      setIsAiTyping(false);
    }
  };

  // Form submission: save a new or update an existing Academic Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showBannerNotification(t('supplyTaskTitle'), "info");
      return;
    }

    if (taskCategory === "Study" && !taskSubject.trim()) {
      showBannerNotification(t('supplyTaskTitleSubject'), "info");
      return;
    }

    if (editingTask) {
      // Edit mode
      const updatedTask: Task = {
        ...editingTask,
        title: taskTitle.trim(),
        category: taskCategory,
        location: taskLocation,
        reminder: taskReminder,
        startDate: taskStartDate,
        dueTime: taskDueTime,
        subject: taskSubject, // keep temporarily
        dueDate: taskDueDate,
        priority: taskPriority,
        notes: taskNotes.trim() || 'No explicit study guide notes supplied.',
        repeat: taskRepeat,
        repeatInterval: taskRepeatInterval,
        repeatUnit: taskRepeatUnit,
        repeatDays: taskRepeatDays,
        repeatEndDate: taskRepeatEndDate,
        repeatCount: taskRepeatCount ?? undefined,
      };

      setTasks((prev) => prev.map((t) => (t.id === editingTask.id ? updatedTask : t)));
      setIsAddingTask(false);
      setEditingTask(null);

      // Form resetting
      setTaskTitle('');
      setTaskSubject('');
      setTaskDueDate(getLocalDateString());
      setTaskPriority('medium');
      setTaskNotes('');
      setTaskLocation('');
      setTaskStartDate('');
      setTaskDueTime('');
      setTaskRepeat('none');
      setTaskRepeatInterval(1);
      setTaskRepeatUnit('day');
      setTaskRepeatDays([]);
      setTaskRepeatEndDate('');
      setTaskRepeatCount(null);
      showBannerNotification(t('updatedTaskSuccess', { title: updatedTask.title }), "success");

      if (user && isValidUuid(updatedTask.id)) {
        try {
          console.log("About to call resilientUpdate");
          const { error } = await resilientUpdate('tasks', updatedTask.id, user.id, taskToDb(updatedTask, user.id));
          console.log("Updating task:", {
            taskId: updatedTask.id,
            userId: user.id,
            status: updatedTask.status,
            completed: updatedTask.completedPercent
          });
          if (error) {
            console.error('Failed to update task in Supabase:', error);
            showBannerNotification(t('savedLocallyFailedCloud'), "info");
          }
        } catch (err) {
          console.error('Task update error:', err);
        }
      }
    } else {
      // Create mode
      const newTaskId = generateUuid();
      const newTask: Task = {
        id: newTaskId,
        title: taskTitle.trim(),
        category: taskCategory,
        location: taskLocation,
        reminder: taskReminder,
        startDate: taskStartDate,
        dueTime: taskDueTime,
        subject: taskSubject, // keep temporarily
        dueDate: taskDueDate,
        priority: taskPriority,
        repeat: taskRepeat,
        repeatInterval: taskRepeatInterval,
        repeatUnit: taskRepeatUnit,
        repeatDays: taskRepeatDays,
        repeatEndDate: taskRepeatEndDate,
        repeatCount: taskRepeatCount ?? undefined,
        status: 'pending',
        notes: taskNotes.trim() || 'No explicit study guide notes supplied.',
        completedPercent: 0
      };

      setTasks((prev) => [newTask, ...prev]);
      setIsAddingTask(false);

      // Form resetting
      setTaskTitle('');
      setTaskSubject('');
      setTaskDueDate(getLocalDateString());
      setTaskPriority('medium');
      setTaskNotes('');
      setTaskLocation('');
      setTaskStartDate('');
      setTaskDueTime('');
      setTaskRepeat('none');
      setTaskRepeatInterval(1);
      setTaskRepeatUnit('day');
      setTaskRepeatDays([]);
      setTaskRepeatEndDate('');
      setTaskRepeatCount(null);
      showBannerNotification(t('savedTaskSuccess', { title: newTask.title }), "success");

      if (user) {
        try {
          const dbTask = taskToDb(newTask, user.id);

          console.log("TASK GOING TO SUPABASE:", dbTask);

          const { error } = await resilientInsert("tasks", dbTask);

          if (error) {
            console.error("FULL SUPABASE ERROR:");
            console.error(error);
            console.error(JSON.stringify(error, null, 2));

            showBannerNotification(
              t('savedLocallyFailedCloud'),
              "info"
            );
          }
        } catch (err) {
          console.error('Task insert error:', err);
        }
      }
    }
  };

  const startEditTask = (task: Task) => {
    setTaskTitle(task.title);
    setTaskCategory(task.category || 'Personal');
    setTaskLocation(task.location || '');
    setTaskReminder(task.reminder || false);
    setTaskStartDate(task.startDate || '');
    setTaskDueTime(task.dueTime || "");
    setTaskDueDate(task.dueDate);
    setTaskPriority(task.priority);
    setTaskNotes(task.notes);
    setIsAddingTask(true);
    setTaskRepeat(task.repeat ?? 'none');
    setTaskRepeatInterval(task.repeatInterval ?? 1);
    setTaskRepeatUnit(task.repeatUnit ?? 'day');
    setTaskRepeatDays(task.repeatDays ?? []);
    setTaskRepeatEndDate(task.repeatEndDate ?? '');
    setTaskRepeatCount(task.repeatCount ?? null);
  };

  const closeAddTaskModal = () => {
    setIsAddingTask(false);
    setEditingTask(null);
    setTaskTitle('');
    setTaskSubject('');
    setTaskDueDate(getLocalDateString());
    setTaskDueTime("");
    setTaskPriority('medium');
    setTaskNotes('');
    setTaskCategory('Personal');
    setTaskLocation('');
    setTaskReminder(false);
    setTaskStartDate('');
    setTaskRepeat('none');
    setTaskRepeatInterval(1);
    setTaskRepeatUnit('day');
    setTaskRepeatDays([]);
    setTaskRepeatEndDate('');
    setTaskRepeatCount(null);
  };

  // Cycle a task status (Pending -> In Progress -> Completed)
  const toggleTaskStatus = async (taskId: string) => {
    console.log("toggleTaskStatus called", taskId);

    // Find the task first, outside of setTasks()
    const currentTask = tasks.find((task) => task.id === taskId);

    if (!currentTask) {
      console.error("Task not found:", taskId);
      return;
    }

    // Since we want Pending <-> Completed only
    const completed = currentTask.status === "completed";

    const updatedTask: Task = {
      ...currentTask,
      status: completed ? "pending" : "completed",
      completedPercent: completed ? 0 : 100,
    };

    console.log("updatedTask =", updatedTask);

    // Update the UI immediately
    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId ? updatedTask : task
      )
    );

    // Show notification
    showBannerNotification(
      updatedTask.status === "completed"
        ? t("taskCompleted")
        : t("taskReopened"),
      "success"
    );

    // Save the status change to Supabase
    if (user && updatedTask && isValidUuid(taskId)) {
      try {
        const { error } = await resilientUpdate("tasks", taskId, user.id, {
          status: updatedTask.status,
          completed_percent: updatedTask.completedPercent,
        });

        if (error) {
          console.error("❌ Task status update failed:", error);
        } else {
          console.log(
            "✅ Task status successfully saved to Supabase:",
            updatedTask.status
          );
        }
      } catch (err) {
        console.error("❌ Task status update error:", err);
      }
    }

    // Automatically create the next recurring task
    if (
      user &&
      updatedTask.status === "completed" &&
      updatedTask.repeat !== "none"
    ) {
      const nextTask: Task = {
        ...updatedTask,
        id: generateUuid(),
        status: "pending",
        completedPercent: 0,
      };

      const nextDate = new Date(updatedTask.dueDate);

      switch (updatedTask.repeat) {
        case "daily":
          nextDate.setDate(
            nextDate.getDate() + (updatedTask.repeatInterval ?? 1)
          );
          break;

        case "weekly":
          nextDate.setDate(
            nextDate.getDate() + 7 * (updatedTask.repeatInterval ?? 1)
          );
          break;

        case "monthly":
          nextDate.setMonth(
            nextDate.getMonth() + (updatedTask.repeatInterval ?? 1)
          );
          break;

        case "yearly":
          nextDate.setFullYear(
            nextDate.getFullYear() + (updatedTask.repeatInterval ?? 1)
          );
          break;
      }

      nextTask.dueDate = nextDate.toISOString().split("T")[0];

      // Add the next occurrence to the UI
      setTasks((prev) => [nextTask, ...prev]);

      // Save the next occurrence to Supabase
      try {
        const { error } = await resilientInsert(
          "tasks",
          taskToDb(nextTask, user.id)
        );

        if (error) {
          console.error(
            "Failed to create next recurring task:",
            error
          );
        }
      } catch (err) {
        console.error(
          "Recurring task insert error:",
          err
        );
      }
    }
  };

  // Remove a task completely
  const deleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showBannerNotification(t('taskRemoved'), "info");

    if (user && isValidUuid(taskId)) {
      try {
        const { error } = await supabase
          .from('tasks')
          .delete()
          .eq('id', taskId)
          .eq('user_id', user.id);
        if (error) console.error('Failed to delete task from Supabase:', error);
      } catch (err) {
        console.error('Task delete error:', err);
      }
    }
  };

  // Form submission: save a new or update an existing calendar event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim() || !eventLocation.trim() || !eventSubject.trim()) {
      showBannerNotification(t('supplyEventFields'), "info");
      return;
    }

    if (editingEvent) {
      // Edit mode
      const updatedEvent: CalendarEvent = {
        ...editingEvent,
        title: eventTitle.trim(),
        time: eventTime,
        duration: Number(eventDuration || 1.0),
        location: eventLocation.trim(),
        date: eventDate,
        type: eventType,
        subject: eventSubject.trim()
      };

      setEvents((prev) => prev.map((ev) => (ev.id === editingEvent.id ? updatedEvent : ev)));
      setIsAddingEvent(false);
      setEditingEvent(null);

      // Form resetting
      setEventTitle('');
      setEventTime('09:00 AM');
      setEventDuration(1.0);
      setEventLocation('');
      setEventDate(getLocalDateString());
      setEventType('study');
      setEventSubject('');

      showBannerNotification(t('updatedEventSuccess', { title: updatedEvent.title }), "success");

      if (user && isValidUuid(updatedEvent.id)) {
        try {
          const { error } = await resilientUpdate('events', updatedEvent.id, user.id, eventToDb(updatedEvent, user.id));
          if (error) {
            console.error('Failed to update event in Supabase:', error);
            showBannerNotification(t('savedLocallyFailedCloud'), "info");
          }
        } catch (err) {
          console.error('Event update error:', err);
        }
      }
    } else {
      // Create mode
      const newEventId = generateUuid();
      const newEvent: CalendarEvent = {
        id: newEventId,
        title: eventTitle.trim(),
        time: eventTime,
        duration: Number(eventDuration || 1.0),
        location: eventLocation.trim(),
        date: eventDate,
        type: eventType,
        subject: eventSubject.trim()
      };

      eventsRef.current = [...eventsRef.current, newEvent];
      setEvents((prev) => [...prev, newEvent]);
      setIsAddingEvent(false);

      // Form resetting
      setEventTitle('');
      setEventTime('09:00 AM');
      setEventDuration(1.0);
      setEventLocation('');
      setEventDate(getLocalDateString());
      setEventType('study');
      setEventSubject('');

      showBannerNotification(t('savedEventSuccess', { title: newEvent.title }), "success");

      if (user) {
        try {
          const { error } = await resilientInsert(
            'events',
            eventToDb(newEvent, user.id)
          );

          if (error) {
            console.error('Failed to save event to Supabase:', error);
            showBannerNotification(t('savedLocallyFailedCloud'), "info");
          }
        } catch (err) {
          console.error('Event insert error:', err);
        }
      }
    }
  };

  const startEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEventTitle(event.title);
    setEventTime(event.time);
    setEventDuration(event.duration);
    setEventLocation(event.location);
    setEventDate(event.date);
    setEventType(event.type);
    setEventSubject(event.subject);
    setIsAddingEvent(true);
  };

  const closeAddEventModal = () => {
    setIsAddingEvent(false);
    setEditingEvent(null);
    setEventTitle('');
    setEventTime('09:00 AM');
    setEventDuration(1.0);
    setEventLocation('');
    setEventDate(selectedDate);
    setEventType('study');
    setEventSubject('');
  };

  const deleteEvent = async (eventId: string) => {
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    showBannerNotification(t('eventRemoved'), "info");

    if (user && isValidUuid(eventId)) {
      try {
        const { error } = await supabase
          .from('events')
          .delete()
          .eq('id', eventId)
          .eq('user_id', user.id);
        if (error) console.error('Failed to delete event from Supabase:', error);
      } catch (err) {
        console.error('Event delete error:', err);
      }
    }
  };

  // Dynamic statistics calculations
  const pendingCount = tasks.filter((t) => t.status === 'pending').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  // Tasks due today: count of tasks where dueDate matches today's date and is not completed
  const tasksDueTodayCount = useMemo(() => {
    const targetDate = getLocalDateString();
    return tasks.filter((t) => t.dueDate === targetDate && t.status !== 'completed').length;
  }, [tasks]);

  // Productivity score: percentage of completed tasks relative to total tasks
  const productivityRatio = useMemo(() => {
    if (tasks.length === 0) return 100;
    return Math.round((completedCount / tasks.length) * 100);
  }, [tasks, completedCount]);

  // Upcoming events count: events scheduled within the next 7 days
  const upcomingEventsCount = useMemo(() => {
    const startDate = getLocalDateString();

    const end = new Date();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 6);

    const endDate = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

    return events.filter(
      (e) => e.date >= startDate && e.date <= endDate
    ).length;
  }, [events]);

  // Today's events and tasks for the Agenda / Today's Schedule panel
  const todaysEvents = useMemo(() => {
    const todayStr = getLocalDateString();
    return events.filter(e => e.date === todayStr);
  }, [events]);

  const todaysTasks = useMemo(() => {
    const todayStr = getLocalDateString();
    return tasks.filter(t => t.dueDate === todayStr);
  }, [tasks]);

  const selectedDateTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.dueDate === selectedDate &&
        task.status !== 'completed'
    );
  }, [tasks, selectedDate]);

  const upcomingDeadlines = tasks
    .filter(task => task.status !== 'completed')
    .sort(
      (a, b) =>
        new Date(a.dueDate).getTime() -
        new Date(b.dueDate).getTime()
    )
    .slice(0, 2);
  const upcomingHighlights = events
    .filter(event => new Date(event.date) >= new Date())
    .sort(
      (a, b) =>
        new Date(a.date).getTime() -
        new Date(b.date).getTime()
    )
    .slice(0, 2);

  // Dynamic study calculations
  const todayStudyHours = useMemo(() => {
    if (studySessions.length === 0) return 0;
    const todayStr = new Date().toDateString();
    const todaySessions = studySessions.filter(s => {
      const d = s.completed_at || s.completedAt;
      if (!d) return false;
      return new Date(d).toDateString() === todayStr;
    });
    const hours = todaySessions.reduce((sum, s) => {
      const h = s.study_hours || Number((s.duration_seconds || 0) / 3600);
      return sum + Number(h);
    }, 0);
    return parseFloat(hours.toFixed(1));
  }, [studySessions]);

  const weeklyStudyHours = useMemo(() => {
    if (studySessions.length === 0) return 0;
    const now = new Date();
    // Get start of this week (Monday)
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);

    const weeklySessions = studySessions.filter(s => {
      const d = s.completed_at || s.completedAt;
      if (!d) return false;
      return new Date(d) >= monday;
    });
    const hours = weeklySessions.reduce((sum, s) => {
      const h = s.study_hours || Number((s.duration_seconds || 0) / 3600);
      return sum + Number(h);
    }, 0);
    return parseFloat(hours.toFixed(1));
  }, [studySessions]);

  return (
    <div
      id="mindstream-workspace"
      className={`min-h-screen relative selection:bg-brand/20 font-sans transition-colors duration-300 ${isDarkActive
        ? 'dark bg-main-bg text-main-text'
        : 'bg-main-bg text-main-text'
        }`}
    >

      {/* Banner Notifications overlay */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-xl glass-panel border border-brand/20 flex items-center gap-3"
          >
            <div className={`w-2.5 h-2.5 rounded-full ${notification.type === 'success' ? 'bg-[#10B981]' : 'bg-brand'}`} />
            <p className="text-sm font-semibold tracking-tight text-main-text">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. ONBOARDING SCREEN */}
      {currentScreen === 'onboarding' && (
        <div id="screen-onboarding" className="min-h-screen w-full flex flex-col justify-between overflow-y-auto relative py-12 px-6">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#10B981]/5 rounded-full blur-3xl" />
          </div>

          <div className="flex justify-between items-center max-w-md w-full mx-auto relative z-10">
            <div className="flex items-center gap-2">
              <img src="/images/mindstream-emblem.png" alt="MindStream" className="w-6 h-6 object-contain" />
              <span className="font-bold text-lg tracking-tight text-brand">{t('appName')}</span>
            </div>
            <button
              id="skipBtn"
              onClick={handleOnboardingSkip}
              className="text-sm font-semibold text-muted-text hover:text-brand transition-colors"
            >
              Skip
            </button>
          </div>

          {/* Slider Views */}
          <div className="max-w-md w-full mx-auto relative z-10 flex-1 flex flex-col justify-center my-6">
            <AnimatePresence mode="wait">

              {/* SLIDE 1 — ORGANIZE */}
              {onboardingSlide === 0 && (
                <motion.div
                  key="slide-1"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="w-full aspect-square rounded-2xl bg-brand-light flex items-center justify-center p-6 shadow-sm border border-main-border overflow-hidden">
                    <img
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                      src={IMAGES.illustrationSlide1}
                      alt="Organize Your Life"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">{t('planYourStudies')}</h2>
                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('planYourStudiesDesc')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 2 — FOCUS */}
              {onboardingSlide === 1 && (
                <motion.div
                  key="slide-2"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="w-full aspect-square rounded-2xl bg-brand-light flex items-center justify-center p-6 shadow-sm border border-main-border overflow-hidden">
                    <img
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                      src={IMAGES.illustrationSlide2}
                      alt="Stay Focused"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">{t('stayOnTrack')}</h2>
                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('stayOnTrackDesc')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 3 — AI COMPANION */}
              {onboardingSlide === 2 && (
                <motion.div
                  key="slide-3"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="w-full aspect-square rounded-2xl bg-brand-light flex items-center justify-center p-6 shadow-sm border border-main-border overflow-hidden">
                    <img
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                      src={IMAGES.illustrationSlide3}
                      alt="Your Personal AI Companion"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">
                      {t('yourPersonalAICompanion')}
                    </h2>

                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('yourPersonalAICompanionDesc')}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* SLIDE 4 — GET STARTED */}
              {onboardingSlide === 3 && (
                <motion.div
                  key="slide-4"
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center text-center space-y-6"
                >
                  <div className="w-full aspect-square rounded-2xl bg-brand-light flex items-center justify-center p-6 shadow-sm border border-main-border overflow-hidden">
                    <img
                      className="w-full h-full object-contain hover:scale-105 transition-transform duration-700"
                      src={IMAGES.illustrationSlide4}
                      alt="Get Started with MindStream"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">
                      {t('readyToGetStarted')}
                    </h2>

                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('readyToGetStartedDesc')}
                    </p>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

          <div className="max-w-md w-full mx-auto relative z-10 flex flex-col items-center space-y-6">
            {/* Dots */}
            <div className="flex gap-2 justify-center">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className={`h-2.5 rounded-full transition-all duration-300 ${onboardingSlide === idx ? 'w-8 bg-brand' : 'w-2.5 bg-main-border'}`}
                />
              ))}
            </div>

            {/* Next Buttons */}
            <button
              id="nextBtn"
              onClick={handleOnboardingNext}
              className="w-full max-w-xs py-4 bg-brand text-white rounded-full font-semibold shadow-lg hover:bg-brand/90 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 text-sm tracking-tight"
            >
              <span>{onboardingSlide === 3 ? t('getStarted') : t('next')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* LOGIN PAGE */}
      {currentScreen === 'login' && (
        <div id="screen-login" className="min-h-screen w-full flex flex-col items-center justify-center relative px-4 py-8">
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#10b981]/10 rounded-full blur-3xl animate-pulse" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md theme-card backdrop-blur-md rounded-3xl border border-main-border p-8 shadow-xl relative z-10 space-y-6"
          >
            {/* Header / Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex w-12 h-12 items-center justify-center bg-brand-light rounded-2xl border border-main-border text-brand shadow-sm mb-2">
                <img src="/images/mindstream-emblem.png" alt="MindStream" className="w-6 h-6 object-contain" />
              </div>
              <h2 className="text-3xl font-extrabold text-main-text tracking-tight">{t('welcomeToMindstream')}</h2>
              <p className="text-sm text-muted-text">{t('pleaseSignIn')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="login-email">
                  {t('emailAddress')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder={t('nameUniversityPlaceholder')}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="login-password">
                    {t('password')}
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder={t('securityPasswordPlaceholder')}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Remember Me */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={loginRememberMe}
                    onChange={(e) => setLoginRememberMe(e.target.checked)}
                    className="w-4.5 h-4.5 rounded border-main-border bg-brand-light text-brand focus:ring-brand/20"
                  />
                  <span className="text-sm text-secondary-text font-medium">{t('rememberMe')}</span>
                </label>
              </div>

              {/* Sign In Button */}
              <button
                id="btn-login-signin"
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full py-3.5 mt-2 bg-brand text-white rounded-2xl font-semibold shadow-md hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <span>{isAuthSubmitting ? t('signingIn') : t('signIn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative flex items-center justify-center my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-main-border" />
              </div>
              <span className="relative px-3 theme-card text-xs font-bold uppercase tracking-widest text-muted-text">
                {t('or')}
              </span>
            </div>

            {/* Google Login */}
            <button
              id="btn-login-google"
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3.5 border border-main-border hover:bg-brand-light text-main-text rounded-2xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.9 1 12 1 7.24 1 3.2 3.73 1.24 7.73l3.79 2.94C5.93 7.37 8.74 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.98 3.76-4.89 3.76-8.54z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.03 14.77a7.12 7.12 0 010-4.54L1.24 7.29a11.973 11.973 0 000 9.42l3.79-2.94z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.08-4.3 1.08-3.26 0-6.07-2.33-7.05-5.63L1.16 16.63C3.12 20.63 7.16 23 12 23z"
                />
              </svg>
              <span>{t('continueWithGoogle')}</span>
            </button>

            {/* Create Account Link */}
            <p className="text-center text-sm text-secondary-text">
              {t('dontHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => setCurrentScreen('register')}
                className="font-bold text-brand hover:underline"
              >
                {t('createAccount')}
              </button>
            </p>
          </motion.div>
        </div>
      )}

      {/* REGISTER PAGE */}
      {currentScreen === 'register' && (
        <div id="screen-register" className="min-h-screen w-full flex flex-col items-center justify-center relative px-4 py-8">
          <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-[#10b981]/10 rounded-full blur-3xl animate-pulse" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md theme-card backdrop-blur-md rounded-3xl border border-main-border p-8 shadow-xl relative z-10 space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex w-12 h-12 items-center justify-center bg-brand-light rounded-2xl border border-main-border text-brand shadow-sm mb-2">
                <img src="/images/mindstream-emblem.png" alt="MindStream" className="w-6 h-6 object-contain" />
              </div>
              <h2 className="text-3xl font-extrabold text-main-text tracking-tight">{t('createAccount')}</h2>
              <p className="text-sm text-muted-text">{t('joinMindstream')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="register-name">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="register-name"
                    type="text"
                    required
                    placeholder={t('gabrielSemescoPlaceholder')}
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="register-email">
                  {t('emailAddress')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="register-email"
                    type="email"
                    required
                    placeholder={t('gabsemescoEmailPlaceholder')}
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="register-password">
                  {t('password')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="register-password"
                    type="password"
                    required
                    placeholder={t('strongPasswordPlaceholder')}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text" htmlFor="register-confirm">
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="register-confirm"
                    type="password"
                    required
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 theme-surface border border-main-border text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Register Button */}
              <button
                id="btn-register-signup"
                type="submit"
                disabled={isAuthSubmitting}
                className="w-full py-3.5 mt-2 bg-brand text-white rounded-2xl font-semibold shadow-md hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 text-sm"
              >
                <span>{isAuthSubmitting ? t('creatingAccount') : t('createAccount')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="relative flex items-center justify-center my-1">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-main-border" />
              </div>
              <span className="relative px-3 theme-card text-xs font-bold uppercase tracking-widest text-muted-text">
                {t('or')}
              </span>
            </div>

            {/* Google Registration */}
            <button
              id="btn-register-google"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthSubmitting}
              className="w-full py-3.5 border border-main-border hover:bg-brand-light text-main-text rounded-2xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5.04c1.62 0 3.08.56 4.22 1.64l3.15-3.15C17.45 1.68 14.9 1 12 1 7.24 1 3.2 3.73 1.24 7.73l3.79 2.94C5.93 7.37 8.74 5.04 12 5.04z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.43c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.98 3.76-4.89 3.76-8.54z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.03 14.77a7.12 7.12 0 010-4.54L1.24 7.29a11.973 11.973 0 000 9.42l3.79-2.94z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.97-1.07 7.96-2.92l-3.66-2.84c-1.01.68-2.31 1.08-4.3 1.08-3.26 0-6.07-2.33-7.05-5.63L1.16 16.63C3.12 20.63 7.16 23 12 23z"
                />
              </svg>
              <span>{t('continueWithGoogle')}</span>
            </button>

            {/* Link back to Login */}
            <p className="text-center text-sm text-secondary-text pt-2">
              {t('alreadyHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => setCurrentScreen('login')}
                className="font-bold text-brand hover:underline flex items-center justify-center gap-1.5 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('backToSignIn')}</span>
              </button>
            </p>
          </motion.div>
        </div>
      )}

      {/* 2. PRELOADER EXPERIENTIAL SPLASH */}
      {currentScreen === 'preloader' && (
        <div id="screen-preloader" className="h-screen w-full flex flex-col items-center justify-center relative px-6 text-center">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl animate-pulse" />
          </div>

          <div className="relative z-10 max-w-sm w-full space-y-12">
            <div className="relative inline-block mx-auto">
              <div className="absolute inset-0 bg-brand/20 blur-xl rounded-full scale-150 animate-pulse" />
              <div className="relative w-24 h-24 flex items-center justify-center bg-card-bg rounded-3xl shadow-xl border border-main-border">
                <img src="/images/mindstream-emblem.png" alt="MindStream" className="w-12 h-12 object-contain" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold text-brand tracking-tight">{t('appName')}</h1>
              <p className="text-md text-secondary-text dark:text-muted-text font-medium leading-relaxed">{t('studySmarter')}</p>
            </div>

            {/* Loading Bar Experience */}
            <div className="space-y-4">
              <div className="h-2 w-full bg-brand-light rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                  className="h-full bg-brand rounded-full"
                />
              </div>
              <p className="text-xs uppercase tracking-wider font-bold text-muted-text animate-pulse">
                {t('optimizingFlow')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN APP INTERACTIVE SCREEN */}
      {currentScreen === 'main' && (
        <div id="screen-main-app" className="flex flex-col min-h-screen pb-24 md:pb-0">

          {/* Top Sticky App Bar Header */}
          <header className="sticky top-0 z-40 h-20 flex items-center justify-between px-8 bg-main-bg/75 backdrop-blur-xl border-b border-white/5 transition-all duration-300">
            <div className="flex items-center gap-3 relative">
              {/* Profile trigger with downward arrow */}
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-1.5 focus:outline-none hover:opacity-90 active:scale-95 transition-all p-1 rounded-full hover:bg-brand-light/50 dark:hover:bg-brand-light/50 group"
                id="btn-profile-avatar"
                title={t('profileMenu')}
              >
                <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-brand/15 dark:border-brand/30 relative shadow-sm">
                  <img
                    className="w-full h-full object-cover"
                    src={currentUser?.avatarUrl || IMAGES.avatarGabriel}
                    alt="User Avatar"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <ChevronDown className="w-4 h-4 text-muted-text group-hover:text-brand dark:group-hover:text-brand transition-colors" />
              </button>

              <h1 onClick={() => setActiveTab('dashboard')} className="text-lg md:text-xl font-extrabold text-brand tracking-tight cursor-pointer">
                {t('appName')}
              </h1>

              {/* DESKTOP DROPDOWN */}
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <>
                    {/* Backdrop to close on click outside */}
                    <div
                      className="fixed inset-0 z-40 cursor-default hidden md:block"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />

                    <motion.div
                      initial={{ opacity: 0, y: 15, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 15, scale: 0.95 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      className="absolute top-14 left-0 w-80 theme-card border border-main-border rounded-2xl shadow-2xl z-50 p-4 hidden md:flex flex-col gap-4 text-left"
                      id="profile-desktop-dropdown"
                    >
                      {/* Top Profile Banner */}
                      <div className="flex items-center gap-3.5 pb-3.5 border-b border-main-border">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand/10 shrink-0">
                          <img
                            src={currentUser?.avatarUrl || IMAGES.avatarGabriel}
                            alt="User profile"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-main-text text-sm truncate">
                            {currentUser?.fullName || 'Gabriel Semesco'}
                          </h4>
                          <p className="text-xs text-muted-text truncate">
                            {currentUser?.email || 'gabsemesco1@gmail.com'}
                          </p>
                        </div>
                      </div>

                      {/* Score Banner */}
                      <div className="grid grid-cols-1 gap-2 bg-brand-light p-3 rounded-xl border border-main-border text-xs transition-colors duration-300">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-text font-semibold uppercase tracking-wider">{t('productivity')}</span>
                          <span className="font-bold text-brand flex items-center gap-1 mt-0.5">
                            <Award className="w-3.5 h-3.5 text-brand" />
                            {productivityRatio}%
                          </span>
                        </div>
                      </div>

                      {/* Dropdown Menu Links */}
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left"
                        >
                          <User className="w-4 h-4 shrink-0 text-muted-text" />
                          <span>{t('myProfile')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('accountSettingsLoaded'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left"
                        >
                          <Settings className="w-4 h-4 shrink-0 text-muted-text" />
                          <span>{t('accountSettings')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('notificationSettingsActive'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left"
                        >
                          <Bell className="w-4 h-4 shrink-0 text-muted-text" />
                          <span>{t('notificationSettings')}</span>
                        </button>

                        {/* Theme Mode Toggle item */}
                        <button
                          type="button"
                          onClick={() => {
                            if (themeMode === 'light') setThemeMode('dark');
                            else if (themeMode === 'dark') setThemeMode('system');
                            else setThemeMode('light');
                          }}
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
                            {themeMode === 'dark' && <Moon className="w-4 h-4 text-muted-text shrink-0" />}
                            {themeMode === 'system' && <Monitor className="w-4 h-4 text-muted-text shrink-0" />}
                            <span>{t('darkMode')}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-muted-text bg-brand-light px-2 py-0.5 rounded-full">
                            {themeMode}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('supportCenterChat'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left"
                        >
                          <HelpCircle className="w-4 h-4 shrink-0 text-muted-text" />
                          <span>{t('helpAndSupport')}</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-main-border my-0.5" />

                      {/* Log Out option */}
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 transition-all text-left w-full"
                      >
                        <LogOut className="w-4 h-4 shrink-0 text-red-500" />
                        <span>{t('logout')}</span>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              {/* MOBILE BOTTOM SHEET */}
              <AnimatePresence>
                {isProfileMenuOpen && (
                  <>
                    {/* Dark overlay backdrop for mobile */}
                    <div
                      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden cursor-default"
                      onClick={() => setIsProfileMenuOpen(false)}
                    />

                    <motion.div
                      initial={{ y: "100%" }}
                      animate={{ y: 0 }}
                      exit={{ y: "100%" }}
                      transition={{ type: "spring", damping: 25, stiffness: 220 }}
                      className="fixed bottom-0 left-0 right-0 theme-card border-t border-main-border rounded-t-[2.5rem] shadow-2xl z-50 p-6 flex flex-col md:hidden max-h-[85vh] text-left"
                      id="profile-mobile-bottom-sheet"
                    >
                      {/* Pull Indicator handle */}
                      <div className="w-12 h-1.5 bg-brand-light rounded-full mx-auto mb-5 shrink-0" />

                      {/* Profile details */}
                      <div className="flex items-center gap-4 pb-5 border-b border-main-border">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand/15 shrink-0">
                          <img
                            src={currentUser?.avatarUrl || IMAGES.avatarGabriel}
                            alt="User profile"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-main-text text-base truncate">
                            {currentUser?.fullName || 'Gabriel Semesco'}
                          </h4>
                          <p className="text-xs text-muted-text truncate">
                            {currentUser?.email || 'gabsemesco1@gmail.com'}
                          </p>
                        </div>
                      </div>

                      {/* Stats inside bottom sheet */}
                      <div className="flex justify-between items-center bg-brand-light p-2.5 rounded-xl border border-main-border">
                        <span className="text-[10px] text-muted-text font-semibold uppercase">{t('productivity')}</span>
                        <span className="font-bold text-brand">{productivityRatio}%</span>
                      </div>

                      {/* Options list */}
                      <div className="flex-1 overflow-y-auto space-y-1 pr-1 no-scrollbar mb-4">
                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left w-full"
                        >
                          <User className="w-5 h-5 text-muted-text shrink-0" />
                          <span>{t('myProfile')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('settingsViewAvailable'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left w-full"
                        >
                          <Settings className="w-5 h-5 text-muted-text shrink-0" />
                          <span>{t('settings')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('notificationPrefsSynced'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left w-full"
                        >
                          <Bell className="w-5 h-5 text-muted-text shrink-0" />
                          <span>{t('notifications')}</span>
                        </button>

                        {/* Theme Mode toggle item on mobile */}
                        <button
                          onClick={() => {
                            if (themeMode === 'light') setThemeMode('dark');
                            else if (themeMode === 'dark') setThemeMode('system');
                            else setThemeMode('light');
                          }}
                          className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left w-full"
                        >
                          <div className="flex items-center gap-3.5">
                            {themeMode === 'light' && <Sun className="w-5 h-5 text-amber-500 shrink-0" />}
                            {themeMode === 'dark' && <Moon className="w-5 h-5 text-muted-text shrink-0" />}
                            {themeMode === 'system' && <Monitor className="w-5 h-5 text-muted-text shrink-0" />}
                            <span>{t('darkMode')}</span>
                          </div>
                          <span className="text-xs uppercase font-bold text-muted-text bg-brand-light px-2.5 py-0.5 rounded-full">
                            {themeMode}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('supportCenterLoading'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text hover:bg-brand-light hover:text-brand transition-all text-left w-full"
                        >
                          <HelpCircle className="w-5 h-5 text-muted-text shrink-0" />
                          <span>{t('helpAndSupport')}</span>
                        </button>
                      </div>

                      {/* Log Out option sticky at the bottom of sheet */}
                      <div className="shrink-0 pt-4 pb-2 border-t border-main-border theme-card z-10">
                        <button
                          onClick={handleSignOut}
                          className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950/25 text-[#ef4444] rounded-2xl text-sm font-extrabold transition-all active:scale-[0.98]"
                        >
                          <LogOut className="w-5 h-5 shrink-0" />
                          <span>{t('logout')}</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => showBannerNotification(t('mindstreamSyncedUpToDate'), "info")}
                className="w-11 h-11 rounded-2xl bg-card-bg border border-main-border flex items-center justify-center hover:border-brand hover:bg-brand-light transition-all duration-300"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#ffb695]" />
              </button>
            </div>
          </header>

          {/* Desktop Left-Rail Layout Wrapper */}
          <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 md:p-8 flex gap-8">

            {/* Desktop persistent sidebar */}
            <aside className="hidden lg:flex flex-col w-64 shrink-0 space-y-6">

              {/* Profile Greeting Section */}
              <div className="bg-card-bg p-6 rounded-2xl border border-main-border text-center space-y-3 shadow-sm">
                <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-4 border-brand/10">
                  <img src={currentUser?.avatarUrl || IMAGES.avatarGabriel} alt="User profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h3 className="font-bold text-main-text text-md">{currentUser?.fullName || 'Gabriel Semesco'}</h3>
                  <p className="text-xs text-muted-text break-all">{currentUser?.email || 'gabsemesco1@gmail.com'}</p>
                </div>
                <div className="flex items-center gap-1.5 opacity-80 mt-0.5">
                  <Award className="w-3 h-3" />
                  <span>{productivityRatio}% {t('productivity')}</span>
                </div>
              </div>

              {/* Sidebar Tabs Navigation */}
              <div className="bg-card-bg rounded-2xl border border-main-border p-4 shadow-sm space-y-1">
                {[
                  { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
                  { id: 'calendar', label: t('calendar'), icon: CalendarIcon },
                  { id: 'tasks', label: t('tasks'), icon: ListTodo },
                  { id: 'timer', label: t('timer'), icon: ClockIcon },
                  { id: 'aitutor', label: t('aiCompanion'), icon: Cpu },
                  { id: 'profile', label: t('profileSettings'), icon: User }
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${isActive ? 'bg-brand text-white shadow-sm' : 'text-secondary-text hover:bg-brand-light hover:text-brand'}`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all text-[#ef4444] hover:bg-[#fef2f2] hover:text-[#ef4444]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t('logout')}</span>
                </button>
              </div>

            </aside>

            {/* Active Sub-tab View panel Content */}
            <main className="flex-1 min-w-0">
              <AnimatePresence mode="wait">

                {/* SUB TAB: DASHBOARD */}
                {activeTab === 'dashboard' && (
                  <motion.section
                    key="tab-view-dashboard"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    {/* Welcome Header */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <p className="text-xs font-bold text-brand uppercase tracking-wider flex items-center gap-2">
                          <span>
                            {new Date(getLocalDateString() + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                          </span>
                          {isRefreshing && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-text normal-case bg-brand/5 px-2.5 py-0.5 rounded-full font-bold">
                              <span className="w-1.5 h-1.5 bg-brand rounded-full animate-ping" />
                              {t('syncing')}
                            </span>
                          )}
                        </p>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-main-text tracking-tight">
                          {t('goodMorning', { name: currentUser?.fullName?.split(' ')[0] || 'Gabriel' })}
                        </h2>
                      </div>

                      <button
                        onClick={() => syncSupabaseData(false)}
                        disabled={isRefreshing}
                        title={t('syncSupabase')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${isRefreshing
                          ? 'theme-surface text-muted-text cursor-not-allowed opacity-70'
                          : 'theme-surface text-secondary-text hover:text-brand hover:border-brand/40 shadow-2xs'
                          }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? t('refreshing') : t('refresh')}</span>
                      </button>
                    </div>

                    {/* Stat Cards Bento Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                      {/* Stat Card 1 */}
                      <div className="theme-stat-card p-5 rounded-2xl flex flex-col justify-between shadow-md hover:shadow-lg transition-all duration-300 relative overflow-hidden">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand">
                          <ListTodo className="w-5 h-5" />
                        </div>
                        <div className="mt-5">
                          <p className="text-xs font-semibold text-secondary-text">{t('tasksDueToday')}</p>
                          <p className="text-4xl font-extrabold tracking-tight text-main-text mt-1">{tasksDueTodayCount}</p>
                        </div>
                      </div>

                      {/* Stat Card 2 */}
                      <div
                        id="stat-hours"
                        className="theme-stat-card p-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300"
                      >
                        <div className="flex justify-between items-start">
                          <div className="w-12 h-12 rounded-2xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand">
                            <ClockIcon className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-5 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-secondary-text">{t('totalStudyHours')}</p>
                            <p className="text-4xl font-extrabold tracking-tight text-main-text mt-0.5">{studyHours}h</p>
                          </div>
                          <div className="flex justify-between border-t border-main-border pt-2 text-[10px] text-muted-text font-semibold">
                            <span>{t('today')} <strong className="text-[#006f64]">{todayStudyHours}h</strong></span>
                            <span>{t('thisWeek')} <strong className="text-brand">{weeklyStudyHours}h</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Stat Card 3 */}
                      <div className="theme-stat-card p-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="mt-5">
                          <p className="text-xs font-semibold text-secondary-text">{t('productivityScore')}</p>
                          <p className="text-4xl font-extrabold tracking-tight text-main-text mt-0.5">{productivityRatio}%</p>
                        </div>
                      </div>

                      {/* Stat Card 4 */}
                      <div className="theme-stat-card p-5 rounded-2xl shadow-md hover:shadow-lg transition-all duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand">
                          <CalendarIcon className="w-5 h-5" />
                        </div>

                        <div className="mt-5">
                          <p className="text-xs font-semibold text-secondary-text">
                            {t('upcomingEvents')}
                          </p>

                          <p className="text-4xl font-extrabold tracking-tight text-main-text mt-1">
                            {upcomingEventsCount}
                          </p>
                        </div>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                      {/* Timeline: Today's Schedule Card */}
                      <div className="lg:col-span-7 theme-card rounded-3xl border border-main-border p-7 shadow-xl space-y-5">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-main-text tracking-tight">{t('todaysSchedule')}</h3>
                          <button onClick={() => setActiveTab('calendar')} className="text-sm font-semibold text-cyan-300 hover:text-white transition-colors">
                            {t('viewFullCalendar')}
                          </button>
                        </div>

                        <div className="space-y-4 pt-2">
                          {todaysEvents.length === 0 && todaysTasks.length === 0 ? (
                            <div className="text-center py-10 text-muted-text space-y-2">
                              <BookOpen className="w-10 h-10 mx-auto text-cyan-300 opacity-80" />
                              <p className="text-sm font-semibold text-main-text">{t('noTasksEventsToday')}</p>
                              <p className="text-sm text-secondary-text">{t('enjoyFreeTime')}</p>
                            </div>
                          ) : (
                            <>
                              {/* Render events first */}
                              {todaysEvents.map((e, idx) => {
                                let typeColor = 'bg-brand/5 border-brand text-brand';
                                let dotColor = 'bg-brand';
                                if (e.type === 'exam') {
                                  typeColor = 'bg-red-50 border-[#ba1a1a] text-[#ba1a1a]';
                                  dotColor = 'bg-[#ba1a1a]';
                                } else if (e.type === 'study') {
                                  typeColor = 'bg-emerald-50 border-[#006b5f] text-[#006f64]';
                                  dotColor = 'bg-[#006b5f]';
                                } else if (e.type === 'submission') {
                                  typeColor = 'bg-purple-50 border-[#7c3aed] text-[#5b21b6]';
                                  dotColor = 'bg-[#7c3aed]';
                                }

                                const isLast = idx === todaysEvents.length - 1 && todaysTasks.length === 0;

                                return (
                                  <div
                                    key={e.id}
                                    className={`flex gap-4 items-start relative pl-5 ml-2.5 ${!isLast ? 'pb-4 border-l-2 border-main-border' : ''}`}
                                  >
                                    <span className={`absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor}`} />
                                    <div className="text-xs text-muted-text min-w-[65px] whitespace-nowrap">{e.time}</div>
                                    <div className={`flex-1 border-l-4 p-3 rounded-r-xl ${typeColor}`}>
                                      <h4 className="text-xs font-bold">{e.title}</h4>
                                      <p className="text-[11px] opacity-85 mt-1">
                                        {e.location} • {e.duration} Hours • {e.subject}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}

                              {/* Render tasks next */}
                              {todaysTasks.map((task, idx) => {
                                let priorityColor = 'bg-blue-50 border-blue-500 text-blue-700';
                                let dotColor = 'bg-blue-500';
                                if (task.priority === 'high') {
                                  priorityColor = 'bg-orange-50 border-orange-500 text-orange-700';
                                  dotColor = 'bg-orange-500';
                                } else if (task.priority === 'medium') {
                                  priorityColor = 'bg-red-50 border-red-500 text-red-700';
                                  dotColor = 'bg-red-500';
                                } else if (task.priority === 'low') {
                                  priorityColor = 'bg-gray-50 border-gray-400 text-gray-600';
                                  dotColor = 'bg-gray-400';
                                }

                                const isLast = idx === todaysTasks.length - 1;

                                return (
                                  <div
                                    key={task.id}
                                    className={`flex gap-4 items-start relative pl-5 ml-2.5 ${!isLast ? 'pb-4 border-l-2 border-main-border' : ''}`}
                                  >
                                    <span className={`absolute -left-[6px] top-1.5 w-2.5 h-2.5 rounded-full ${dotColor}`} />
                                    <div className="text-xs text-muted-text min-w-[65px] whitespace-nowrap">{t('taskDue')}</div>
                                    <div className={`flex-1 border-l-4 p-3 rounded-r-xl ${priorityColor}`}>
                                      <h4 className="text-xs font-bold flex items-center justify-between gap-2">
                                        <span>{task.title}</span>
                                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-black/20">
                                          {task.status === 'completed' ? '✓ Completed' : 'Pending'}
                                        </span>
                                      </h4>
                                      <p className="text-[11px] opacity-85 mt-1">
                                        {t('subject', { subject: task.subject })} • {t('priority', { priority: task.priority })}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Right Hand: Upcoming Deadlines */}
                      <div className="lg:col-span-5 space-y-6">

                        <div className="theme-card rounded-3xl border border-main-border p-7 shadow-xl space-y-5">
                          <h3 className="text-xl font-bold text-main-text tracking-tight">{t('upcomingDeadlines')}</h3>

                          <div className="space-y-4">
                            {upcomingDeadlines.length > 0 ? (
                              upcomingDeadlines.map((task) => (
                                <div
                                  key={task.id}
                                  className="p-5 rounded-2xl space-y-3 theme-surface hover:opacity-95 transition-all duration-300"
                                >
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-cyan-50 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-400/20">
                                      {task.subject}
                                    </span>

                                    <span
                                      className={`font-bold ${task.priority === "high"
                                        ? "text-red-600 dark:text-red-300"
                                        : task.priority === "medium"
                                          ? "text-amber-600 dark:text-amber-300"
                                          : "text-secondary-text"
                                        }`}
                                    >
                                      {task.dueDate}
                                    </span>
                                  </div>

                                  <h4 className="font-semibold text-base text-main-text leading-snug">
                                    {task.title}
                                  </h4>

                                  <div className="h-2.5 w-full bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 shadow-[0_0_12px_rgba(56,189,248,0.45)]"
                                      style={{ width: `${task.completedPercent ?? 0}%` }}
                                    />
                                  </div>

                                  <p className="text-xs text-cyan-700 dark:text-cyan-200 text-right font-semibold tracking-wide">
                                    {t("percentCompleted", {
                                      percent: task.completedPercent ?? 0
                                    })}
                                  </p>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-8 text-muted-text text-sm">
                                {t("noUpcomingDeadlines")}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive AI Study Companion promo Card */}
                        <div
                          onClick={() => setActiveTab('aitutor')}
                          className="group relative rounded-2xl overflow-hidden h-36 shadow-md border border-main-border cursor-pointer"
                        >
                          <img
                            src={IMAGES.companionCardBg}
                            alt="AI background"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-brand/85 to-brand-hover/70 backdrop-blur-[2px] flex flex-col justify-center p-6 text-white space-y-2">
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-5 h-5 fill-yellow-300 stroke-yellow-300" />
                              <span className="text-xs uppercase tracking-wider font-bold">{t('aiCompanion')}</span>
                            </div>
                            <h4 className="font-bold text-md leading-snug">{t('aiAssistantLive')}</h4>
                            <p className="text-xs opacity-95">{t('aiAssistantDesc')}</p>
                          </div>
                        </div>

                      </div>

                    </div>
                  </motion.section>
                )}

                {/* SUB TAB: CALENDAR */}
                {activeTab === 'calendar' && (
                  <motion.section
                    key="tab-view-calendar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div>
                          <h2 className="text-2xl md:text-3xl font-extrabold text-main-text">
                            {monthNames[currentMonth]} {currentYear}
                          </h2>
                          <p className="text-sm text-secondary-text">{t('academicCheckpoints')}</p>
                        </div>
                        <div className="flex items-center gap-1 bg-brand-light/80 p-1 rounded-xl shadow-xs ml-2">
                          <button
                            onClick={handlePrevMonth}
                            className="p-1.5 hover:bg-brand-light text-brand rounded-lg transition-all"
                            title={t('previousMonth')}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-brand-light text-brand rounded-lg transition-all"
                            title={t('nextMonth')}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Switch view toggle */}
                      <div className="theme-surface p-1 rounded-xl flex items-center justify-start w-fit shadow-xs">
                        <button
                          onClick={() => setCalendarView('month')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${calendarView === 'month'
                            ? 'bg-brand text-white shadow-xs'
                            : 'text-secondary-text hover:bg-brand-light'
                            }`}
                        >
                          {t('month')}
                        </button>
                        <button
                          onClick={() => setCalendarView('week')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${calendarView === 'week'
                            ? 'bg-brand text-white shadow-xs'
                            : 'text-secondary-text hover:bg-brand-light'
                            }`}
                        >
                          {t('week')}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                      {/* Interactive Calendar grid */}
                      <div className="lg:col-span-8 theme-card p-5 rounded-2xl border border-main-border shadow-sm">
                        <div className="grid grid-cols-7 text-center font-bold text-xs text-muted-text pb-3 border-b border-main-border">
                          <span>{t('mon')}</span><span>{t('tue')}</span><span>{t('wed')}</span><span>{t('thu')}</span><span>{t('fri')}</span><span>{t('sat')}</span><span>{t('sun')}</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 md:gap-3 pt-4">
                          {/* Filler dates prior to current month */}
                          {calendarDaysInfo.fillerDays.map((dayNum, idx) => (
                            <div key={`filler-${idx}`} className="aspect-square flex items-center justify-center text-xs text-muted-text/50">
                              {dayNum}
                            </div>
                          ))}

                          {/* Dynamic current month active days */}
                          {Array.from({ length: calendarDaysInfo.daysInMonth }, (_, i) => {
                            const dayNum = i + 1;
                            const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                            const isToday = formattedDay === getLocalDateString();
                            const isSelected = selectedDate === formattedDay;

                            // Check for calendar events
                            const hasEvents = events.some((e) => e.date === formattedDay);

                            // Check for incomplete tasks due on this date
                            const dayTasks = tasks.filter(
                              (task) => task.dueDate === formattedDay && task.status !== 'completed'
                            );

                            return (
                              <button
                                key={dayNum}
                                onClick={() => setSelectedDate(formattedDay)}
                                className={`aspect-square relative flex flex-col items-center justify-center rounded-xl transition-all ${isSelected
                                  ? 'bg-brand text-white font-bold shadow-lg scale-105'
                                  : isToday
                                    ? 'bg-brand/25 dark:bg-brand/25 text-brand font-bold border border-brand/40 shadow-sm'
                                    : 'hover:bg-brand-light text-main-text'
                                  }`}
                              >
                                <span className="text-sm">{dayNum}</span>

                                <div className="absolute bottom-1.5 flex items-center gap-1">
                                  {hasEvents && (
                                    <span
                                      className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#14b8a6]'
                                        }`}
                                    />
                                  )}

                                  {dayTasks.length > 0 && (
                                    <span
                                      className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-brand'
                                        }`}
                                    />
                                  )}
                                </div>
                              </button>
                            );
                          })}

                          {/* Filler dates after current month to balance the grid */}
                          {calendarDaysInfo.nextMonthFiller.map((dayNum, idx) => (
                            <div key={`next-filler-${idx}`} className="aspect-square flex items-center justify-center text-xs text-muted-text/30">
                              {dayNum}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Selected Day Agenda checklist */}
                      <div className="lg:col-span-4 space-y-6">
                        <div className="theme-card p-6 rounded-2xl border border-main-border shadow-sm space-y-4">
                          <div className="flex justify-between items-center pb-2 border-b border-main-border">
                            <h3 className="font-bold text-md text-main-text">{t('todaysAgenda')}</h3>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEventDate(selectedDate);
                                  setEditingEvent(null);
                                  setEventTitle('');
                                  setEventTime('09:00 AM');
                                  setEventDuration(1.0);
                                  setEventLocation('');
                                  setEventType('study');
                                  setEventSubject('');
                                  setIsAddingEvent(true);
                                }}
                                className="p-1 text-brand hover:bg-brand/10 rounded-full transition-all"
                                title={t('addEvent')}
                              >
                                <Plus className="w-5 h-5" />
                              </button>
                              <span className="px-3 py-1 bg-brand/10 text-brand rounded-lg text-xs font-bold">
                                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </span>
                            </div>
                          </div>

                          {/* Display selected date events and tasks */}
                          <div className="space-y-4">

                            {events.some(e => e.date === selectedDate) || selectedDateTasks.length > 0 ? (
                              <>
                                {/* Calendar events */}
                                {events
                                  .filter(e => e.date === selectedDate)
                                  .map((e) => {
                                    let typeColor =
                                      'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300';

                                    if (e.type === 'exam') {
                                      typeColor =
                                        'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-700 dark:text-red-300';
                                    }

                                    if (e.type === 'class') {
                                      typeColor =
                                        'bg-brand/5 dark:bg-brand/15 border-brand text-brand';
                                    }

                                    if (e.type === 'study') {
                                      typeColor =
                                        'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300';
                                    }

                                    if (e.type === 'submission') {
                                      typeColor =
                                        'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300';
                                    }

                                    return (
                                      <div
                                        key={`event-${e.id}`}
                                        className="flex gap-3 text-left group"
                                      >
                                        <div className="text-xs text-muted-text pt-1 whitespace-nowrap w-16">
                                          {e.time}
                                        </div>

                                        <div
                                          className={`flex-1 p-3 border-l-4 rounded-r-xl relative ${typeColor}`}
                                        >
                                          <h4 className="text-xs font-semibold leading-snug pr-12">
                                            {e.title}
                                          </h4>

                                          <p className="text-[10px] opacity-85 mt-0.5">
                                            {e.location} • {e.duration} Hours • {e.subject}
                                          </p>

                                          {/* Edit & Delete hover controls */}
                                          <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-card-bg/90 backdrop-blur-xs p-0.5 rounded-lg transition-opacity border border-main-border shadow-sm">
                                            <button
                                              onClick={() => startEditEvent(e)}
                                              className="p-1 text-muted-text hover:text-brand rounded-md hover:bg-brand-light transition-colors"
                                              title={t('editEvent')}
                                            >
                                              <Pencil className="w-3 h-3" />
                                            </button>

                                            <button
                                              onClick={() => deleteEvent(e.id)}
                                              className="p-1 text-muted-text hover:text-red-500 rounded-md hover:bg-brand-light transition-colors"
                                              title={t('deleteEvent')}
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}

                                {/* Tasks */}
                                {selectedDateTasks.map((task) => {
                                  let priorityColor =
                                    'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-700 dark:text-blue-300';

                                  if (task.priority === 'high') {
                                    priorityColor =
                                      'bg-orange-50 dark:bg-orange-950/40 border-orange-500 text-orange-700 dark:text-orange-300';
                                  } else if (task.priority === 'medium') {
                                    priorityColor =
                                      'bg-red-50 dark:bg-red-950/40 border-red-500 text-red-700 dark:text-red-300';
                                  } else if (task.priority === 'low') {
                                    priorityColor =
                                      'bg-gray-50 dark:bg-gray-800/50 border-gray-400 text-gray-600 dark:text-gray-300';
                                  }

                                  return (
                                    <div
                                      key={`task-${task.id}`}
                                      className="flex gap-3 text-left"
                                    >
                                      <div className="text-xs text-muted-text pt-1 whitespace-nowrap w-16">
                                        {t('taskDue')}
                                      </div>

                                      <div
                                        className={`flex-1 p-3 border-l-4 rounded-r-xl ${priorityColor}`}
                                      >
                                        <h4 className="text-xs font-semibold leading-snug flex items-center justify-between gap-2">
                                          <span>{task.title}</span>

                                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/70 dark:bg-black/20">
                                            Pending
                                          </span>
                                        </h4>

                                        <p className="text-[10px] opacity-85 mt-0.5">
                                          {t('subject', { subject: task.subject })} •{' '}
                                          {t('priority', { priority: task.priority })}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            ) : (
                              <div className="text-center py-8 text-muted-text space-y-2">
                                <BookOpen className="w-8 h-8 opacity-40 mx-auto" />

                                <p className="text-xs font-medium">
                                  {t('noTasksEventsToday')}
                                </p>

                                <button
                                  onClick={() => {
                                    setEventDate(selectedDate);
                                    setEditingEvent(null);
                                    setEventTitle('');
                                    setEventTime('09:00 AM');
                                    setEventDuration(1.0);
                                    setEventLocation('');
                                    setEventType('study');
                                    setEventSubject('');
                                    setIsAddingEvent(true);
                                  }}
                                  className="text-[11px] font-bold text-brand hover:underline"
                                >
                                  {t('createStudyBlock')}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                      </div>

                    </div>
                  </motion.section>
                )}

                {/* SUB TAB: TASKS BOARD */}
                {activeTab === 'tasks' && (
                  <motion.section
                    key="tab-view-tasks"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                      <div>
                        <h2 className="text-2xl md:text-3xl font-extrabold text-main-text">{t('tasks')}</h2>
                        <p className="text-sm text-secondary-text">{t('manageTasksDesc')}</p>
                      </div>

                      {/* Segment Tab controller filter */}
                      <div className="bg-brand-light/80 p-1 rounded-xl flex items-center w-fit shadow-xs">
                        {(['pending', 'completed'] as TaskStatus[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => setTaskFilter(st)}
                            className={`px-5 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${taskFilter === st
                              ? 'bg-brand text-white shadow-xs'
                              : 'text-secondary-text hover:text-brand hover:bg-brand-light'
                              }`}
                          >
                            {st === 'pending' ? t('pending') : t('completed')}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Task Display Bento view */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                      {tasks.filter((t) => t.status === taskFilter).length > 0 ? (
                        tasks
                          .filter((task) => task.status === taskFilter)
                          .map((task) => {
                            const isHigh = task.priority === 'high';
                            const isMed = task.priority === 'medium';
                            return (
                              <motion.div
                                layout
                                key={task.id}
                                className="theme-card p-6 rounded-2xl border border-main-border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                              >
                                {/* Left priority color strip */}
                                <div
                                  className={`absolute top-0 left-0 w-1 h-full ${isHigh
                                    ? 'bg-red-500'
                                    : isMed
                                      ? 'bg-brand'
                                      : 'bg-gray-400 dark:bg-gray-500'
                                    }`}
                                />

                                <div>
                                  <div className="flex justify-between items-start mb-3">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isHigh
                                        ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-300'
                                        : isMed
                                          ? 'bg-indigo-100 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-200 border border-indigo-200/50 dark:border-indigo-400/20'
                                          : 'bg-gray-100 dark:bg-gray-700/80 text-gray-600 dark:text-gray-200 border border-gray-200/60 dark:border-gray-500/30'
                                        }`}
                                    >
                                      {t('priorityLabel', { priority: task.priority })}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => toggleTaskStatus(task.id)}
                                        className="text-muted-text hover:text-brand p-1 rounded-full hover:bg-brand-light transition-colors"
                                        title={t('cycleStatus')}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => startEditTask(task)}
                                        className="text-muted-text hover:text-brand p-1 rounded-full hover:bg-brand-light transition-colors"
                                        title={t('editTaskDetails')}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteTask(task.id)}
                                        className="text-muted-text hover:text-red-500 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                                        title={t('removeTask')}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <h3 className="font-extrabold text-md text-main-text mb-1">{task.title}</h3>
                                  {task.location && (
                                    <p className="text-xs text-brand font-medium flex items-center gap-1.5 mb-3">
                                      <School className="w-3.5 h-3.5" />
                                      <span>{task.location}</span>
                                    </p>
                                  )}

                                  <p className="text-xs text-secondary-text line-clamp-3 leading-relaxed mb-4">{task.notes}</p>
                                </div>

                                <div className="pt-4 border-t border-main-border flex justify-between items-center text-[11px] text-muted-text">
                                  <div className="flex items-center gap-1">
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span>{task.dueDate}</span>
                                  </div>
                                  {task.completedPercent !== undefined && (
                                    <span className="font-bold text-brand">{t('percentCompleteText', { percent: task.completedPercent })}</span>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })
                      ) : (
                        <div className="col-span-full theme-card rounded-2xl border border-main-border py-16 px-4 text-center space-y-3">
                          <ListTodo className="w-12 h-12 text-main-border mx-auto" />
                          <p className="font-extrabold text-md text-main-text">{t('noTasksListed', { filter: taskFilter })}</p>
                          <p className="text-xs text-muted-text max-w-xs mx-auto">{t('clickFloatingIcon')}</p>
                          <button
                            onClick={() => setIsAddingTask(true)}
                            className="px-4 py-2 bg-brand text-white text-xs font-bold rounded-full shadow-xs hover:bg-brand/90 transition-all active:scale-95 mx-auto"
                          >
                            {t('populateCheckpoint')}
                          </button>
                        </div>
                      )}

                    </div>
                  </motion.section>
                )}

                {/* SUB TAB: POMODORO TIMER */}
                {activeTab === 'timer' && (
                  <motion.section
                    key="tab-view-timer"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-md mx-auto theme-card p-8 rounded-2xl border border-main-border shadow-lg text-center space-y-6"
                  >
                    <div>
                      <h2 className="text-xl font-bold text-main-text">{t('pomodoroTimerTitle')}</h2>
                      <p className="text-xs text-muted-text mt-1">{t('pomodoroTimerDesc')}</p>
                    </div>

                    {/* Circular ring countdown display */}
                    <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
                      <div className={`absolute inset-0 rounded-full border-4 ${isTimerRunning ? 'border-brand animate-pulse' : 'border-main-border'}`} />
                      <div className="relative z-10 space-y-1">
                        <div className="text-4xl font-extrabold text-main-text tracking-tight">
                          {timerMinutes.toString().padStart(2, '0')}:{timerSeconds.toString().padStart(2, '0')}
                        </div>
                        <p className="text-xs text-muted-text font-semibold tracking-wider uppercase">{isTimerRunning ? t('activeFlow') : t('paused')}</p>
                      </div>
                    </div>

                    {/* Duration Preset selectors */}
                    <div className="space-y-1.5 text-left">
                      <label className="text-xs font-bold text-secondary-text block">{t('sessionDuration')}</label>
                      <div className="flex theme-surface p-1 rounded-xl">
                        {[15, 25, 45, 60].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setTimerTargetMinutes(mins);
                              setTimerMinutes(mins);
                              setTimerSeconds(0);
                              setIsTimerRunning(false);
                            }}
                            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all ${timerTargetMinutes === mins ? 'bg-brand text-white shadow-xs font-extrabold scale-105' : 'text-secondary-text hover:bg-brand-light'
                              }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category selectors */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary-text block text-left">{t('sessionIntent')}</label>
                      <div className="flex flex-wrap gap-1.5 justify-start">
                        {[
                          { name: 'Focus', icon: '🎯', labelKey: 'intentFocus' },
                          { name: 'Create', icon: '✨', labelKey: 'intentCreate' },
                          { name: 'Learn', icon: '📖', labelKey: 'intentLearn' },
                          { name: 'Think', icon: '💡', labelKey: 'intentThink' }
                        ].map((item) => (
                          <button
                            key={item.name}
                            onClick={() => setTimerCategory(item.name)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${timerCategory === item.name
                              ? 'bg-brand text-white shadow-sm scale-[1.02]'
                              : 'theme-surface text-secondary-text hover:text-brand hover:border-brand/30'
                              }`}
                          >
                            <span className="mr-1">{item.icon}</span>
                            {t(item.labelKey)}
                          </button>
                        ))}
                      </div>

                      <p className="text-xs text-secondary-text text-left mt-2">
                        {getIntentDescription(timerCategory)}
                      </p>
                      <div className="mt-3">
                        <label className="text-xs font-bold text-secondary-text block text-left mb-1.5">
                          {t('sessionGoal')}
                        </label>

                        <input
                          type="text"
                          value={sessionGoal}
                          onChange={(e) => setSessionGoal(e.target.value)}
                          placeholder={t('sessionGoalPlaceholder')}
                          className="w-full px-3 py-2.5 rounded-xl theme-surface text-sm text-main-text placeholder:text-muted-text outline-none focus:border-brand transition-all"
                        />
                      </div>
                    </div>

                    {/* Active Session Context */}
                    <div className="rounded-xl bg-brand-light border border-brand/20 px-4 py-3 text-center">
                      <p className="text-xs font-bold text-brand uppercase tracking-wider">
                        {timerCategory === 'Create' ? t('intentCreate') : timerCategory === 'Learn' ? t('intentLearn') : timerCategory === 'Think' ? t('intentThink') : t('intentFocus')} {t('session')}
                      </p>

                      {sessionGoal.trim() && (
                        <p className="text-sm font-semibold text-main-text mt-1">
                          {sessionGoal}
                        </p>
                      )}

                      <p className="text-xs text-secondary-text mt-1">
                        {isTimerRunning
                          ? t('timerRunningZone')
                          : sessionGoal.trim()
                            ? t('timerReady')
                            : t('timerChooseIntent')}
                      </p>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        onClick={() => {
                          setTimerMinutes(timerTargetMinutes);
                          setTimerSeconds(0);
                          setIsTimerRunning(false);
                        }}
                        className="w-12 h-12 theme-surface text-secondary-text hover:text-brand hover:border-brand/30 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
                        title={t('resetCountdown')}
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-200 active:scale-95 ${isTimerRunning
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-brand hover:bg-brand-hover'
                          }`}
                      >
                        {isTimerRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                      </button>

                      <button
                        onClick={() => {
                          // Fast advance model trigger (dev-shortcut for users to test log updates)
                          setTimerMinutes(0);
                          setTimerSeconds(3);
                          showBannerNotification(t('fastForwardTimer'), "info");
                        }}
                        className="p-2 text-xs font-bold text-brand hover:underline"
                        title={t('skipTimer')}
                      >
                        {t('skip')}
                      </button>
                    </div>

                    {/* Active Study Metrics Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 bg-brand-light p-3.5 rounded-xl border border-brand/20 text-center">
                      <div>
                        <p className="text-[10px] font-bold text-muted-text uppercase">{t('today')}</p>
                        <p className="text-md font-extrabold text-brand">{todayStudyHours}h</p>
                      </div>
                      <div className="border-x border-main-border">
                        <p className="text-[10px] font-bold text-muted-text uppercase">{t('thisWeek')}</p>
                        <p className="text-md font-extrabold text-brand">{weeklyStudyHours}h</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-muted-text uppercase">{t('total')}</p>
                        <p className="text-md font-extrabold text-main-text">{studyHours}h</p>
                      </div>
                    </div>

                    {/* Recent Completed Focus Sessions List */}
                    {studySessions.length > 0 && (
                      <div className="text-left border-t border-main-border pt-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-main-text">{t('completedFocusSessions', { count: studySessions.length })}</h4>
                          <span className="text-[10px] font-bold text-brand bg-brand/5 px-2 py-0.5 rounded-full">{t('durableSync')}</span>
                        </div>
                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                          {studySessions.slice(-4).reverse().map((session, sidx) => (
                            <div key={session.id || sidx} className="flex justify-between items-center text-xs p-2.5 theme-surface rounded-xl transition-colors hover:border-brand/30">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-main-text">{session.category}</p>
                                <p className="text-[10px] text-muted-text font-medium">
                                  {new Date(session.completed_at || session.completedAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(session.completed_at || session.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <span className="text-[11px] font-black text-brand theme-surface px-2 py-1 rounded-lg shadow-2xs">
                                {session.study_hours ? `${parseFloat(Number(session.study_hours).toFixed(2))}h` : `${Math.round((session.duration_seconds || 1500) / 60)}m`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.section>
                )}

                {/* SUB TAB: AI COMPANION TUTOR */}
                {activeTab === 'aitutor' && (
                  <motion.section
                    key="tab-view-aitutor"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-13rem)] lg:h-[650px] relative animate-fade-in"
                  >
                    {/* Left Sidebar: Quick Tools (Glass panel layout) - Desktop */}
                    <aside className="hidden lg:flex flex-col w-64 shrink-0 space-y-4">
                      {/* Primary Action Button: New Chat */}
                      <button
                        onClick={handleNewChat}
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl
                        bg-brand hover:bg-brand-hover
                        text-white font-extrabold text-xs
                        transition-all duration-300
                        hover:scale-[1.02]
                        hover:shadow-[0_12px_30px_rgba(91,76,240,0.25)]
                        active:scale-[0.98]
                        cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('newStudySession')}</span>
                      </button>

                      {/* Saved Conversations list */}
                      <div className="theme-card p-5 rounded-2xl border border-main-border shadow-xs flex-1 flex flex-col min-h-0">
                        <h3 className="text-[11px] font-bold text-muted-text uppercase tracking-wider mb-3">
                          {t('recentSessions')}
                        </h3>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
                          {displayConversations.map((c) => {
                            const isActive = c.id === activeConversationId;
                            const isEditing = c.id === editingConvId;

                            return (
                              <div
                                key={c.id}
                                onClick={() => !isEditing && handleSelectConversation(c.id)}
                                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200 ${isActive
                                  ? 'bg-brand-light text-brand border-brand/20 dark:border-brand/20'
                                  : 'hover:bg-brand-light text-secondary-text border-transparent'
                                  }`}
                              >
                                {isEditing ? (
                                  <form
                                    onSubmit={(e) => handleSaveRename(c.id, e)}
                                    className="flex items-center gap-1.5 w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="text"
                                      value={renameTitleInput}
                                      onChange={(e) => setRenameTitleInput(e.target.value)}
                                      className="w-full theme-surface px-2 py-1 rounded text-xs text-main-text border border-brand/30 outline-none"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') setEditingConvId(null);
                                      }}
                                    />
                                    <button
                                      type="submit"
                                      className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 cursor-pointer"
                                      title={t('saveTitle')}
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                    </button>
                                  </form>
                                ) : (
                                  <>
                                    <span className="truncate max-w-[130px]">{c.title}</span>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                      <button
                                        onClick={(e) => handleStartRename(c.id, c.title, e)}
                                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 dark:text-gray-400 cursor-pointer"
                                        title={t('rename')}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteConversation(c.id, e)}
                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-500 hover:text-red-600 dark:text-red-400 cursor-pointer"
                                        title={t('delete')}
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </aside>

                    {/* Responsive Mobile Drawer overlay for History */}
                    <AnimatePresence>
                      {isMobileHistoryOpen && (
                        <>
                          {/* Backdrop */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.4 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileHistoryOpen(false)}
                            className="lg:hidden absolute inset-0 bg-black z-40 rounded-2xl"
                          />
                          {/* Drawer Content */}
                          <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden absolute left-0 top-0 bottom-0 w-72 theme-card border-r border-main-border z-50 rounded-l-2xl p-5 flex flex-col"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-sm text-main-text">{t('recentSessions')}</h3>
                              <button
                                onClick={() => setIsMobileHistoryOpen(false)}
                                className="p-1 rounded-lg hover:bg-brand-light text-gray-500 cursor-pointer"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <button
                              onClick={() => {
                                handleNewChat();
                                setIsMobileHistoryOpen(false);
                              }}
                              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-xs transition-all duration-200 shadow-sm active:scale-95 cursor-pointer dark:bg-brand mb-4 shrink-0"
                            >
                              <Plus className="w-4 h-4" />
                              <span>{t('newStudySession')}</span>
                            </button>

                            <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar mb-6">
                              {displayConversations.map((c) => {
                                const isActive = c.id === activeConversationId;
                                const isEditing = c.id === editingConvId;
                                return (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      if (!isEditing) {
                                        handleSelectConversation(c.id);
                                        setIsMobileHistoryOpen(false);
                                      }
                                    }}
                                    className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200 ${isActive
                                      ? 'bg-brand-light text-brand border-brand/20 dark:border-brand/20'
                                      : 'hover:bg-gray-50 dark:hover:bg-brand-light/40 text-secondary-text dark:text-muted-text border-transparent'
                                      }`}
                                  >
                                    {isEditing ? (
                                      <form
                                        onSubmit={(e) => handleSaveRename(c.id, e)}
                                        className="flex items-center gap-1.5 w-full"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <input
                                          type="text"
                                          value={renameTitleInput}
                                          onChange={(e) => setRenameTitleInput(e.target.value)}
                                          className="w-full bg-secondary-bg px-2 py-1 rounded text-xs text-main-text border border-brand/30 outline-none"
                                          autoFocus
                                        />
                                        <button type="submit" className="p-1 text-green-600 cursor-pointer">
                                          <CheckCircle2 className="w-4 h-4" />
                                        </button>
                                      </form>
                                    ) : (
                                      <>
                                        <span className="truncate max-w-[150px]">{c.title}</span>
                                        <div className="flex items-center gap-1.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                          <button
                                            onClick={(e) => handleStartRename(c.id, c.title, e)}
                                            className="p-1 text-gray-500 cursor-pointer"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            onClick={(e) => handleDeleteConversation(c.id, e)}
                                            className="p-1 text-red-500 cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="border-t border-main-border pt-4 space-y-3 shrink-0">
                              <h4 className="text-[10px] font-bold text-muted-text uppercase tracking-wider">{t('quickTools')}</h4>
                              <div className="grid grid-cols-1 gap-1.5">
                                {[
                                  { labelKey: 'quickToolSchedule', promptKey: 'quickToolSchedulePrompt' },
                                  { labelKey: 'quickToolBreakdown', promptKey: 'quickToolBreakdownPrompt' },
                                  { labelKey: 'quickToolExplain', promptKey: 'quickToolExplainPrompt' },
                                  { labelKey: 'quickToolBrainstorm', promptKey: 'quickToolBrainstormPrompt' },
                                  { labelKey: 'quickToolFocus', promptKey: 'quickToolFocusPrompt' }
                                ].map((tool) => (
                                  <button
                                    key={tool.labelKey}
                                    onClick={() => {
                                      handleSendChatMessage(t(tool.promptKey));
                                      setIsMobileHistoryOpen(false);
                                    }}
                                    className="w-full text-left p-2 rounded-lg text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-brand-light/40 text-secondary-text dark:text-muted-text truncate cursor-pointer"
                                  >
                                    {t(tool.labelKey)}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* Chat Messenger Box container */}
                    <section className="flex-1 theme-card rounded-2xl border border-main-border flex flex-col justify-between overflow-hidden shadow-sm">

                      {/* Chat Header */}
                      <header className="px-5 py-3.5 border-b border-main-border flex items-center justify-between theme-card">
                        <div className="flex items-center gap-3">
                          {/* Mobile history trigger button */}
                          <button
                            onClick={() => setIsMobileHistoryOpen(true)}
                            className="lg:hidden flex items-center justify-center p-1.5 rounded-lg bg-brand/10 text-brand hover:bg-brand/15 active:scale-95 transition-all mr-1 cursor-pointer"
                            title={t('openHistorySidebar')}
                          >
                            <ClockIcon className="w-4 h-4" />
                          </button>

                          <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
                          <span className="text-xs font-bold text-secondary-text dark:text-muted-text">{t('aiCompanion')}</span>
                        </div>
                      </header>

                      {/* Messages Area scroll frame */}
                      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {chatMessages.map((m) => {
                          const isAI = m.role === 'assistant';
                          return (
                            <div key={m.id} className={`flex gap-3 max-w-[85%] ${isAI ? 'w-full' : 'ml-auto flex-row-reverse'}`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isAI
                                ? 'bg-brand/10 border-brand/15 text-brand'
                                : 'bg-brand/10 border-brand/20 text-brand'
                                }`}>
                                {isAI ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                              </div>
                              <div className={`p-4 rounded-2xl min-w-0 max-w-full ${isAI
                                ? 'bg-brand-light rounded-tl-none text-main-text border border-main-border'
                                : 'bg-brand dark:bg-brand text-white rounded-tr-none shadow-sm'
                                }`}>
                                {isAI ? (
                                  <ChatMessageRenderer content={m.text} msgId={m.id} />
                                ) : (
                                  <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap break-words">
                                    {m.text}
                                  </div>
                                )}
                                <span className={`block text-[9px] mt-2 font-bold uppercase tracking-wider ${isAI ? 'text-muted-text' : 'text-white/70 text-right'}`}>
                                  {m.timestamp}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {isAiTyping && (
                          <div className="flex gap-3 max-w-[85%] animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand/10 flex items-center justify-center shrink-0 text-brand">
                              <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-brand-light p-4 rounded-2xl rounded-tl-none border border-main-border">
                              <div className="flex gap-1.5 items-center py-1.5">
                                <span className="w-2 h-2 bg-brand dark:bg-brand rounded-full animate-bounce" />
                                <span className="w-2 h-2 bg-brand dark:bg-brand rounded-full animate-bounce [animation-delay:0.2s]" />
                                <span className="w-2 h-2 bg-brand dark:bg-brand rounded-full animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div ref={messagesEndRef} />
                      </div>

                      {/* Suggestion Chips & Chat Input block */}
                      <footer className="p-4 border-t border-main-border theme-surface space-y-3 shrink-0">

                        {/* Confirmation Pills — visible only when a destructive action awaits user approval */}
                        {pendingConfirmation ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-semibold text-secondary-text mr-1">Confirm action:</span>
                            <button
                              onClick={() => handleSendChatMessage('yes')}
                              className="px-4 py-1.5 rounded-full border border-red-400/60 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-[11px] font-bold hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all cursor-pointer shadow-xs"
                            >
                              ✓ Confirm Delete
                            </button>
                            <button
                              onClick={() => handleSendChatMessage('cancel')}
                              className="px-4 py-1.5 rounded-full border border-main-border bg-brand-light text-secondary-text text-[11px] font-bold hover:bg-brand/10 active:scale-95 transition-all cursor-pointer shadow-xs"
                            >
                              ✕ Cancel
                            </button>
                          </div>
                        ) : (
                          /* Suggestion Chips list mapping */
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              {
                                textKey: 'chipPlanWeek',
                                icon: CalendarIcon,
                                promptKey: 'chipPlanWeekPrompt'
                              },
                              {
                                textKey: 'chipOrganizeTasks',
                                icon: Award,
                                promptKey: 'chipOrganizeTasksPrompt'
                              },
                              {
                                textKey: 'chipExplainThis',
                                icon: BookOpen,
                                promptKey: 'chipExplainThisPrompt'
                              },
                              {
                                textKey: 'chipPrioritize',
                                icon: School,
                                promptKey: 'chipPrioritizePrompt'
                              },
                              {
                                textKey: 'chipBeatProcrastination',
                                icon: Sparkles,
                                promptKey: 'chipBeatProcrastinationPrompt'
                              }
                            ].map((chip) => {
                              const Icon = chip.icon;
                              return (
                                <button
                                  key={chip.textKey}
                                  onClick={() => handleSendChatMessage(t(chip.promptKey))}
                                  className="px-3.5 py-1.5 rounded-full border border-brand/30 hover:border-brand text-brand bg-brand-light text-[11px] font-bold hover:bg-brand/15 active:scale-95 transition-all flex items-center gap-1.5 shadow-5xs cursor-pointer"
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  <span>{t(chip.textKey)}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Input line */}
                        <div className="flex items-center gap-3 theme-card border-2 border-main-border rounded-2xl px-4 py-2 focus-within:border-brand transition-all">
                          <button
                            onClick={() => showBannerNotification(t('uploadNotes'), "info")}
                            className="p-1.5 text-muted-text hover:text-brand transition-colors cursor-pointer"
                          >
                            <Paperclip className="w-4 h-4" />
                          </button>
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSendChatMessage();
                            }}
                            placeholder={t('askMindstreamAI')}
                            className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm text-main-text placeholder:text-muted-text/70"
                          />
                          <button
                            onClick={() => handleSendChatMessage()}
                            className="bg-brand hover:bg-brand-hover text-white p-2 rounded-xl transition-all active:scale-95 shadow-sm cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>

                      </footer>

                    </section>
                  </motion.section>
                )}

                {/* SUB TAB: PROFILE AND SETTINGS */}
                {activeTab === 'profile' && (
                  <motion.section
                    key="tab-view-profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-xl mx-auto space-y-6"
                  >
                    {/* 1. Profile Information Card */}
                    <div className="theme-card rounded-2xl border border-main-border p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider">{t('profileInformation')}</h3>
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand shrink-0">
                          <img src={currentUser?.avatarUrl || IMAGES.avatarGabriel} alt="User profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-extrabold text-lg text-main-text truncate">{currentUser?.fullName || 'Gabriel J. Semesco'}</h3>
                          <p className="text-xs text-muted-text truncate">{currentUser?.email || 'gabsemesco1@gmail.com'}</p>
                          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-brand">
                            <Award className="w-3.5 h-3.5" />
                            <span>{productivityRatio}% {t('productivity')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 2. Preferences Card */}
                    <div className="theme-card rounded-2xl border border-main-border p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider">{t('preferences')}</h3>
                      <div className="space-y-4 text-xs">
                        {/* Language row */}
                        <div className="flex justify-between items-center relative py-1 border-b border-main-border">
                          <span className="font-semibold text-main-text flex items-center gap-2">
                            <span>🌐</span>
                            <span>{t('language')}</span>
                          </span>

                          <button
                            type="button"
                            onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                            className="flex items-center gap-2 text-brand font-bold hover:opacity-80 py-1 px-2 rounded-lg hover:bg-brand-light transition-colors"
                          >
                            {i18n.language === "fr"
                              ? "Français"
                              : i18n.language === "id"
                                ? "Bahasa Indonesia"
                                : i18n.language === "es"
                                  ? "Español"
                                  : i18n.language === "ar"
                                    ? "العربية"
                                    : "English"}
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {languageMenuOpen && (
                            <div className="absolute right-0 top-10 theme-card border border-main-border rounded-xl shadow-lg z-50 w-48 overflow-hidden">
                              {[
                                { code: 'en', label: '🇬🇧 English' },
                                { code: 'fr', label: '🇫🇷 Français' },
                                { code: 'id', label: '🇮🇩 Bahasa Indonesia' },
                                { code: 'es', label: '🇪🇸 Español' },
                                { code: 'ar', label: '🇸🇦 العربية' }
                              ].map((lang) => (
                                <button
                                  key={lang.code}
                                  className={`w-full text-left px-4 py-2.5 text-main-text hover:bg-brand-light transition-colors flex items-center justify-between ${i18n.language === lang.code ? 'font-bold text-brand bg-brand-light/50' : ''
                                    }`}
                                  onClick={() => {
                                    i18n.changeLanguage(lang.code);
                                    setLanguageMenuOpen(false);
                                  }}
                                >
                                  <span>{lang.label}</span>
                                  {i18n.language === lang.code && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Appearance / Theme row */}
                        <div className="flex justify-between items-center py-1">
                          <span className="font-semibold text-main-text flex items-center gap-2">
                            {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
                            {themeMode === 'dark' && <Moon className="w-4 h-4 text-brand shrink-0" />}
                            {themeMode === 'system' && <Monitor className="w-4 h-4 text-muted-text shrink-0" />}
                            <span>{t('appearance')}</span>
                          </span>

                          <div className="flex items-center gap-1 theme-surface p-1 rounded-xl border border-main-border">
                            {[
                              { mode: 'light' as const, icon: Sun, label: 'Light' },
                              { mode: 'dark' as const, icon: Moon, label: 'Dark' },
                              { mode: 'system' as const, icon: Monitor, label: 'System' }
                            ].map((item) => {
                              const Icon = item.icon;
                              const active = themeMode === item.mode;
                              return (
                                <button
                                  key={item.mode}
                                  type="button"
                                  onClick={() => setThemeMode(item.mode)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${active
                                    ? 'bg-brand text-white shadow-xs'
                                    : 'text-secondary-text hover:text-brand hover:bg-brand-light'
                                    }`}
                                >
                                  <Icon className="w-3.5 h-3.5" />
                                  <span className="capitalize">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 3. Account Actions Card */}
                    <div className="theme-card rounded-2xl border border-main-border p-6 shadow-sm space-y-4">
                      <h3 className="text-xs font-bold text-muted-text uppercase tracking-wider">{t('account')}</h3>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-main-text">{t('logout')}</p>
                          <p className="text-[11px] text-muted-text">{currentUser?.email || 'gabsemesco1@gmail.com'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          <span>{t('logout')}</span>
                        </button>
                      </div>
                    </div>
                  </motion.section>
                )}

              </AnimatePresence>
            </main>

          </div>

          {/* Floating Action Button (FAB) triggered modal opener */}
          <button
            onClick={() => setIsAddingTask(true)}
            className="fixed bottom-8 right-8 z-50 group flex items-center justify-center w-16 h-16 rounded-2xl bg-brand hover:scale-105 active:scale-95 transition-all duration-300"
            title={t('createTaskFab')}
          >
            <Plus className="w-7 h-7 stroke-[2.7px] text-white" />
          </button>

          {/* Botom navigation shell exclusively on mobile devices */}
          <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-sm z-50 rounded-2xl backdrop-blur-md bg-card-bg/95 shadow-xl border border-main-border flex justify-around items-center px-2 py-2">
            {[
              { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
              { id: 'calendar', label: t('calendar'), icon: CalendarIcon },
              { id: 'tasks', label: t('tasks'), icon: ListTodo },
              { id: 'timer', label: t('timer'), icon: ClockIcon },
              { id: 'aitutor', label: t('aiCompanion'), icon: Cpu }
            ].map((navItem) => {
              const Icon = navItem.icon;
              const isActive = activeTab === navItem.id;
              return (
                <button
                  key={navItem.id}
                  onClick={() => setActiveTab(navItem.id as any)}
                  className={`flex flex-col items-center justify-center px-4 py-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-brand/10 text-brand scale-105 font-bold' : 'text-muted-text/80 hover:bg-brand-light'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] mt-0.5 tracking-tight font-medium leading-none">{navItem.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 4. NEW TASK MODAL POPUP DIALOG */}
          <AnimatePresence>
            {isAddingTask && (
              <div className="fixed inset-0 bg-main-text/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6">

                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={closeAddTaskModal} />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-md theme-card rounded-2xl shadow-2xl border border-main-border overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
                >
                  <form onSubmit={handleCreateTask} className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh] overflow-hidden">

                    {/* Modal Header */}
                    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-main-border theme-card z-10">
                      <button
                        type="button"
                        onClick={closeAddTaskModal}
                        className="p-1.5 hover:bg-brand-light rounded-full text-muted-text hover:text-brand transition-colors"
                      >
                        <X className="w-5 h-5 animate-none" />
                      </button>
                      <h1 className="text-md font-extrabold text-main-text tracking-tight">{editingTask ? t('editTaskTitle') : t('newTaskTitle')}</h1>
                      <div className="w-8 shrink-0" /> {/* Centering balance */}
                    </header>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto no-scrollbar">

                      {/* Floating draft icon ribbon */}
                      <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-brand/10 to-brand-light/40 border border-main-border flex items-center justify-center">
                        <ListTodo className="w-10 h-10 text-brand/45 select-none" />
                      </div>

                      {/* Title */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('taskTitleLabel')}</label>
                        <input
                          type="text"
                          required
                          value={taskTitle}
                          onChange={(e) => setTaskTitle(e.target.value)}
                          placeholder={t('whatNeedsToBeDone')}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                        />
                      </div>

                      {/* Category */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">
                          {t('categoryLabel')}
                        </label>

                        <select
                          value={taskCategory}
                          onChange={(e) => setTaskCategory(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                        >
                          <option value="Personal">{t('categoryPersonal')}</option>
                          <option value="Study">{t('categoryStudy')}</option>
                          <option value="Work">{t('categoryWork')}</option>
                          <option value="Health">{t('categoryHealth')}</option>
                          <option value="Shopping">{t('categoryShopping')}</option>
                          <option value="Finance">{t('categoryFinance')}</option>
                          <option value="Fitness">{t('categoryFitness')}</option>
                          <option value="Travel">{t('categoryTravel')}</option>
                          <option value="Meeting">{t('categoryMeeting')}</option>
                          <option value="Family">{t('categoryFamily')}</option>
                          <option value="Other">{t('categoryOther')}</option>
                        </select>
                      </div>

                      {taskCategory === "Study" && (
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">
                            {t('subjectLabel')}
                          </label>

                          <input
                            type="text"
                            value={taskSubject}
                            onChange={(e) => setTaskSubject(e.target.value)}
                            placeholder={t('subjectPlaceholder')}
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                          />
                        </div>
                      )}

                      {/* Location */}

                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">
                          {t('locationLabel')}
                        </label>

                        <input
                          type="text"
                          value={taskLocation}
                          onChange={(e) => setTaskLocation(e.target.value)}
                          placeholder={t('locationPlaceholder')}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                        />
                      </div>

                      {/* Due Date */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('dueDateLabel')}</label>
                        <input
                          type="date"
                          required
                          value={taskDueDate}
                          onChange={(e) => setTaskDueDate(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                        />
                      </div>

                      {/* Repeat */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">
                          {t('repeatLabel')}
                        </label>

                        <select
                          value={taskRepeat}
                          onChange={(e) =>
                            setTaskRepeat(
                              e.target.value as
                              | 'none'
                              | 'daily'
                              | 'weekly'
                              | 'monthly'
                              | 'yearly'
                              | 'custom'
                            )
                          }
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none"
                        >
                          <option value="none">{t('repeatNone')}</option>
                          <option value="daily">{t('repeatDaily')}</option>
                          <option value="weekly">{t('repeatWeekly')}</option>
                          <option value="monthly">{t('repeatMonthly')}</option>
                          <option value="yearly">{t('repeatYearly')}</option>
                          <option value="custom">{t('repeatCustom')}</option>
                        </select>
                      </div>
                      {taskRepeat === 'weekly' && (
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">
                            {t('repeatOn')}
                          </label>

                          <div className="grid grid-cols-7 gap-2">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() =>
                                  setTaskRepeatDays((prev) =>
                                    prev.includes(day)
                                      ? prev.filter((d) => d !== day)
                                      : [...prev, day]
                                  )
                                }
                                className={`rounded-lg py-2 text-sm font-medium transition ${taskRepeatDays.includes(day)
                                  ? 'bg-brand text-white'
                                  : 'theme-surface border border-main-border text-main-text'
                                  }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {taskRepeat === 'custom' && (
                        <div className="space-y-3">

                          <label className="text-xs font-bold text-secondary-text ml-0.5">
                            {t('repeatEvery')}
                          </label>

                          <div className="flex gap-3">

                            <input
                              type="number"
                              min={1}
                              value={taskRepeatInterval}
                              onChange={(e) =>
                                setTaskRepeatInterval(Number(e.target.value))
                              }
                              className="w-24 px-3 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                            />

                            <select
                              value={taskRepeatUnit}
                              onChange={(e) =>
                                setTaskRepeatUnit(
                                  e.target.value as
                                  | 'day'
                                  | 'week'
                                  | 'month'
                                  | 'year'
                                )
                              }
                              className="flex-1 px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                            >
                              <option value="day">{t('repeatUnitDays')}</option>
                              <option value="week">{t('repeatUnitWeeks')}</option>
                              <option value="month">{t('repeatUnitMonths')}</option>
                              <option value="year">{t('repeatUnitYears')}</option>
                            </select>

                          </div>

                        </div>
                      )}
                      {taskRepeat !== 'none' && (
                        <div className="space-y-3">

                          <label className="text-xs font-bold text-secondary-text ml-0.5">
                            {t('repeatEnds')}
                          </label>

                          <select
                            value={taskRepeatEnds}
                            onChange={(e) =>
                              setTaskRepeatEnds(
                                e.target.value as 'never' | 'date' | 'count'
                              )
                            }
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                          >
                            <option value="never">{t('repeatNever')}</option>
                            <option value="date">{t('repeatOnDate')}</option>
                            <option value="count">{t('repeatAfterCount')}</option>
                          </select>

                        </div>
                      )}
                      {taskRepeatEnds === 'date' && (
                        <input
                          type="date"
                          value={taskRepeatEndDate}
                          onChange={(e) =>
                            setTaskRepeatEndDate(e.target.value)
                          }
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                        />
                      )}
                      {taskRepeatEnds === 'count' && (
                        <input
                          type="number"
                          min={1}
                          value={taskRepeatCount ?? ''}
                          onChange={(e) =>
                            setTaskRepeatCount(Number(e.target.value))
                          }
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                          placeholder={t('repeatCountPlaceholder')}
                        />
                      )}

                      {/* Due Time */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">
                          {t('setDueTime')}
                        </label>

                        <input
                          type="time"
                          value={taskDueTime}
                          onChange={(e) => setTaskDueTime(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface text-main-text focus:border-brand outline-none"
                        />
                      </div>

                      {/* Priority segmented tabs */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5 block">{t('priorityTitle')}</label>
                        <div className="flex bg-brand-light p-1 rounded-xl border border-main-border">
                          {(['low', 'medium', 'high'] as Priority[]).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setTaskPriority(p)}
                              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold uppercase transition-all ${taskPriority === p ? 'bg-brand text-white shadow-xs scale-105' : 'text-secondary-text hover:bg-white/40'
                                }`}
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Notes */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('notesLabel')}</label>
                        <textarea
                          value={taskNotes}
                          onChange={(e) => setTaskNotes(e.target.value)}
                          placeholder={t('notesPlaceholder')}
                          rows={3}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text resize-none"
                        />
                      </div>
                    </div>

                    {/* Actions Sticky Footer */}
                    <footer className="shrink-0 p-6 border-t border-main-border theme-card flex gap-3 text-sm">
                      <button
                        type="button"
                        onClick={closeAddTaskModal}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs text-secondary-text theme-surface hover:bg-brand-light transition-colors active:scale-95"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="flex-[2] py-3 px-4 rounded-xl font-semibold text-xs text-white bg-brand hover:bg-brand-hover shadow-xs transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{editingTask ? t('updateTask') : t('saveTask')}</span>
                      </button>
                    </footer>

                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* 4.5. NEW CALENDAR EVENT MODAL POPUP DIALOG */}
          <AnimatePresence>
            {isAddingEvent && (
              <div className="fixed inset-0 bg-main-text/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6">

                {/* Backdrop Click */}
                <div className="absolute inset-0" onClick={closeAddEventModal} />

                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 30 }}
                  transition={{ duration: 0.2 }}
                  className="relative w-full max-w-md theme-card rounded-2xl shadow-2xl border border-main-border overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
                >
                  <form onSubmit={handleCreateEvent} className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh] overflow-hidden">

                    {/* Modal Header */}
                    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-main-border theme-card z-10">
                      <button
                        type="button"
                        onClick={closeAddEventModal}
                        className="p-1.5 hover:bg-brand-light rounded-full text-muted-text hover:text-brand transition-colors"
                      >
                        <X className="w-5 h-5 animate-none" />
                      </button>
                      <h1 className="text-md font-extrabold text-main-text tracking-tight">{editingEvent ? t('editEventTitle') : t('newEventTitle')}</h1>
                      <div className="w-8 shrink-0" /> {/* Centering balance */}
                    </header>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto no-scrollbar">

                      {/* Floating draft icon ribbon */}
                      <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-brand/10 to-brand-light/40 border border-main-border flex items-center justify-center">
                        <CalendarIcon className="w-10 h-10 text-brand/45 select-none" />
                      </div>

                      {/* Title */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('eventTitleLabel')}</label>
                        <input
                          type="text"
                          required
                          value={eventTitle}
                          onChange={(e) => setEventTitle(e.target.value)}
                          placeholder={t('eventTitlePlaceholder')}
                          className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                        />
                      </div>

                      {/* Category */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">
                          {t('categoryLabel')}
                        </label>

                        <div className="relative">
                          <select
                            required
                            value={eventSubject}
                            onChange={(e) => setEventSubject(e.target.value)}
                            className="w-full appearance-none px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text pr-10"
                          >
                            <option value="">{t('selectCategory')}</option>
                            <option value="Personal">{t('categoryPersonal')}</option>
                            <option value="Work">{t('categoryWork')}</option>
                            <option value="Health">{t('categoryHealth')}</option>
                            <option value="Social">{t('categorySocial')}</option>
                            <option value="Other">{t('categoryOther')}</option>
                          </select>

                          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 p-0.5 w-5 h-5 text-muted-text pointer-events-none" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Event Date */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">{t('dateLabel')}</label>
                          <input
                            type="date"
                            required
                            value={eventDate}
                            onChange={(e) => setEventDate(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                          />
                        </div>

                        {/* Time */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">{t('timeLabel')}</label>
                          <input
                            type="text"
                            required
                            value={eventTime}
                            onChange={(e) => setEventTime(e.target.value)}
                            placeholder={t('timePlaceholder')}
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Duration */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">{t('durationLabel')}</label>
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            required
                            value={eventDuration}
                            onChange={(e) => setEventDuration(parseFloat(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                          />
                        </div>

                        {/* Location */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-secondary-text ml-0.5">{t('locationLabel')}</label>
                          <input
                            type="text"
                            required
                            value={eventLocation}
                            onChange={(e) => setEventLocation(e.target.value)}
                            placeholder={t('locationPlaceholder')}
                            className="w-full px-4 py-3 rounded-xl border border-main-border theme-surface focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text"
                          />
                        </div>
                      </div>

                      {/* Type segmented tabs */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5 block">{t('eventTypeLabel')}</label>
                        <div className="flex theme-surface p-1 rounded-xl">
                          {([
                            { id: 'study', label: t('eventTypeStudy') },
                            { id: 'class', label: t('eventTypeClass') },
                            { id: 'exam', label: t('eventTypeExam') },
                            { id: 'submission', label: t('eventTypeAssignment') }
                          ]).map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setEventType(t.id as any)}
                              className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${eventType === t.id
                                ? 'bg-brand text-white shadow-xs font-extrabold scale-105'
                                : 'text-secondary-text hover:bg-brand-light'
                                }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions Sticky Footer */}
                    <footer className="shrink-0 p-6 border-t border-main-border theme-card flex gap-3 text-sm">
                      <button
                        type="button"
                        onClick={closeAddEventModal}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs text-secondary-text theme-surface hover:bg-brand-light transition-colors active:scale-95"
                      >
                        {t('cancel')}
                      </button>
                      <button
                        type="submit"
                        className="flex-[2] py-3 px-4 rounded-xl font-semibold text-xs text-white bg-brand hover:bg-brand-hover shadow-xs transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{editingEvent ? t('updateEvent') : t('saveEvent')}</span>
                      </button>
                    </footer>

                  </form>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      )}

    </div>
  );
}
