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
  Search,
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
  Flame,
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
import { INITIAL_TASKS, INITIAL_EVENTS, INITIAL_CHAT, IMAGES } from './data';
import { Task, CalendarEvent, ChatMessage, Priority, TaskStatus, ChatConversation } from './types';
import { useAuth } from './context/AuthContext';
import { supabase } from './lib/supabase';
import {
  createConversation,
  saveMessage,
  getConversationMessages
} from "./lib/ai";

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
      if (user && authProfile) {
        setCurrentUser(authProfile);
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
  }, [user, authProfile, authLoading]);

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
      messages: INITIAL_CHAT,
      createdAt: new Date().toLocaleDateString()
    };
    return [defaultConv];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const savedActive = localStorage.getItem('mindstream_active_conv_id');
    return savedActive || 'conv-default';
  });

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    const savedActive = localStorage.getItem('mindstream_active_conv_id') || 'conv-default';
    const savedConvs = localStorage.getItem('mindstream_conversations');
    if (savedConvs) {
      try {
        const parsed = JSON.parse(savedConvs);
        if (Array.isArray(parsed)) {
          const found = parsed.find((c: any) => c.id === savedActive);
          if (found) return found.messages;
          if (parsed.length > 0) return parsed[0].messages;
        }
      } catch (e) {
        console.error("Failed to load initial messages from active conversation:", e);
      }
    }
    return INITIAL_CHAT;
  });

  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [renameTitleInput, setRenameTitleInput] = useState<string>('');
  const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);
  const [streakDays, setStreakDays] = useState(12);

  // Effect to update the conversations and sync to localStorage whenever chatMessages changes
  useEffect(() => {
    if (activeConversationId) {
      setConversations(prev => {
        const updated = prev.map(c => {
          if (c.id === activeConversationId) {
            let title = c.title;
            // Auto rename if it's currently a placeholder
            if (title === t("newChat") || title === t("untitledConversation")) {
              const firstUserMsg = chatMessages.find(m => m.role === 'user');
              if (firstUserMsg) {
                title = firstUserMsg.text.length > 25 ? firstUserMsg.text.substring(0, 22) + '...' : firstUserMsg.text;
              }
            }
            return { ...c, title, messages: chatMessages };
          }
          return c;
        });
        localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
        return updated;
      });
    }
  }, [chatMessages, activeConversationId]);

  // Effect to load correct chatMessages when activeConversationId changes
  useEffect(() => {
    const selectedConv = conversations.find(c => c.id === activeConversationId);
    if (selectedConv) {
      setChatMessages(selectedConv.messages);
      localStorage.setItem('mindstream_active_conv_id', activeConversationId);
    }
  }, [activeConversationId]);

  // Form state for creating a new task
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [taskDueDate, setTaskDueDate] = useState(getLocalDateString());
  const [taskPriority, setTaskPriority] = useState<Priority>('medium');
  const [taskNotes, setTaskNotes] = useState('');

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
  const [timerCategory, setTimerCategory] = useState(t("deepFocus"));
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
    subject: row.subject || '',
    dueDate: row.due_date || row.dueDate || '',
    priority: (row.priority || 'medium') as Priority,
    status: (row.status || 'pending') as TaskStatus,
    notes: row.notes || '',
    completedPercent: row.completed_percent ?? row.completedPercent ?? 0,
    nextMilestone: row.next_milestone ?? row.nextMilestone ?? ''
  });

  const taskToDb = (task: Task, userId: string) => ({
    id: task.id,
    user_id: userId,
    title: task.title,
    subject: task.subject,
    due_date: task.dueDate,
    priority: task.priority,
    status: task.status,
    notes: task.notes,
    completed_percent: task.completedPercent ?? 0,
    next_milestone: task.nextMilestone ?? ''
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
      // 1. Fetch & Sync Tasks
      const { data: dbTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      if (tasksError) {
        console.error('Error fetching tasks from Supabase:', tasksError);
      } else if (dbTasks) {
        setTasks(dbTasks.map(dbToTask));
      }

      // 2. Fetch & Sync Events
      const { data: dbEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('user_id', user.id);

      if (eventsError) {
        console.error('Error fetching events from Supabase:', eventsError);
      } else if (dbEvents && dbEvents.length > 0) {
        const mappedEvents = dbEvents.map(dbToEvent);

        console.log("Mapped events:", mappedEvents);

        mappedEvents.forEach(event => {
          console.log(
            event.title,
            "date =", event.date,
            "selectedDate =", selectedDate
          );
        });

        setEvents(mappedEvents);

      } else {
        // No events found, seed with default events and save to Supabase
        const seededEvents = INITIAL_EVENTS.map(e => ({
          ...e,
          id: generateUuid()
        }));
        setEvents(seededEvents);

        const dbSeededEvents = seededEvents.map(e => eventToDb(e, user.id));
        const { error: seedError } = await resilientInsert('events', dbSeededEvents);
        if (seedError) {
          console.error('Failed to seed events in Supabase:', seedError);
        }
      }

      // 3. Fetch & Sync Study Hours / Sessions
      const { data: dbSessions, error: sessionsError } = await supabase
        .from('study_sessions')
        .select('*')
        .eq('user_id', user.id);

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

    } catch (err) {
      console.error('Unexpected error during Supabase sync:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, [user]);

  // Initial sync on mount/login
  useEffect(() => {
    if (user) {
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

  // Search overlay state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Notification message overlay
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiTyping]);

  // Prevent background body scrolling when any modal or search overlay is open
  useEffect(() => {
    if (isAddingTask || isAddingEvent || showSearch) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isAddingTask, isAddingEvent, showSearch]);

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
            setStreakDays((prev) => prev + 1);
            showBannerNotification(t('Great job! Focus session completed.'), "success");
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
  }, [isTimerRunning, timerMinutes, timerSeconds, timerCategory, user, timerTargetMinutes]);

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
      sessionStorage.removeItem('mindstream_currentUser');
      sessionStorage.removeItem('mindstream_auth_token');

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
    if (onboardingSlide < 2) {
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

  // Preloader progress bar self-acting transition
  useEffect(() => {
    if (currentScreen === 'preloader') {
      const timer = setTimeout(() => {
        setCurrentScreen('main');
        showBannerNotification(t('goodMorningSynced', { name: currentUser?.fullName?.split(' ')[0] || 'Gabriel' }), "info");
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [currentScreen, currentUser]);

  // Protected Routes Enforcer: redirect to login if currentScreen is main but no user is logged in
  useEffect(() => {
    if (currentScreen === 'main' && !currentUser) {
      setCurrentScreen('login');
    }
  }, [currentScreen, currentUser]);

  // Helper methods to manage chat conversations and sessions
  const handleNewChat = () => {
    const newId = `conv-${Date.now()}`;
    const newConv: ChatConversation = {
      id: newId,
      title: t('newChat'),
      messages: [
        {
          id: `msg-welcome-${Date.now()}`,
          role: 'assistant',
          text: t('aiAssistantWelcome'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ],
      createdAt: new Date().toLocaleDateString()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setChatMessages(newConv.messages);
    showBannerNotification(t('startedNewStudySession'), "success");
  };

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversations.length <= 1) {
      showBannerNotification(t('mustKeepOneChat'), "info");
      return;
    }
    const updated = conversations.filter(c => c.id !== id);
    setConversations(updated);
    localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
    if (activeConversationId === id) {
      const nextActive = updated[0].id;
      setActiveConversationId(nextActive);
      setChatMessages(updated[0].messages);
    }
    showBannerNotification(t('chatSessionDeleted'), "info");
  };

  const handleStartRename = (id: string, currentTitle: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingConvId(id);
    setRenameTitleInput(currentTitle);
  };

  const handleSaveRename = (id: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTitleInput.trim()) return;
    setConversations(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, title: renameTitleInput.trim() } : c);
      localStorage.setItem('mindstream_conversations', JSON.stringify(updated));
      return updated;
    });
    setEditingConvId(null);
    showBannerNotification(t('conversationRenamed'), "success");
  };

  // Render markdown bolds, links, and lists into custom styled React elements
  const renderMessageText = (text: string) => {
    const lines = text.split('\n');
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
          <strong key={match.index} className="font-extrabold text-brand dark:text-brand">
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
          <li key={idx} className="ml-4 list-disc pl-1 text-xs md:text-sm leading-relaxed mt-1 first:mt-0 text-main-text dark:text-[#e2e8f0]">
            {lineElement}
          </li>
        );
      } else {
        return (
          <p key={idx} className="text-xs md:text-sm leading-relaxed min-h-[1.25rem] text-main-text dark:text-[#e2e8f0]">
            {lineElement}
          </p>
        );
      }
    });
  };

  // Post User chat prompts server-side to Gemini
  const handleSendChatMessage = async (presetText?: string) => {
    const textToSend = presetText || chatInput;
    if (!textToSend.trim()) return;

    // Append user message immediately
    const userMsgId = `msg-user-${Date.now()}`;
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newUserMessage: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: timeStr
    };

    setChatMessages((prev) => [...prev, newUserMessage]);
    setChatInput('');
    setIsAiTyping(true);

    // Save conversation and user message to Supabase
    let conversationId = activeConversationId;

    if (
      user &&
      (conversationId === "conv-default" || conversationId.startsWith("conv-"))
    ) {
      const conversation = await createConversation(user.id);
      conversationId = conversation.id;
      setActiveConversationId(conversation.id);
    }

    if (user) {
      await saveMessage(conversationId, "user", textToSend);
    }

    try {
      // Package conversation history up to previous 10 messages for context
      const chatHistory = chatMessages.map((m) => ({
        role: m.role === 'assistant'
          ? 'model'
          : 'user',
        text: m.text
      }));

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          history: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error('Server issues processing prompt.');
      }

      const data = await response.json();
      const aiResponseText = data.text || "I was able to analyze that. Let's practice active recall or organize a checklist based on your lectures!";

      const aiMsgId = `msg-ai-${Date.now()}`;
      const newAiMessage: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setChatMessages((prev) => [...prev, newAiMessage]);
      if (user) {
        await saveMessage(conversationId, "assistant", aiResponseText);
      }
    } catch (err: any) {
      console.error(err);
      const errMessage: ChatMessage = {
        id: `msg-err-${Date.now()}`,
        role: 'assistant',
        text: t('networkIssueGemini'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setChatMessages((prev) => [...prev, errMessage]);
    } finally {
      setIsAiTyping(false);
    }
  };

  // Form submission: save a new or update an existing Academic Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !taskSubject.trim()) {
      showBannerNotification(t('supplyTaskTitleSubject'), "info");
      return;
    }

    if (editingTask) {
      // Edit mode
      const updatedTask: Task = {
        ...editingTask,
        title: taskTitle.trim(),
        subject: taskSubject,
        dueDate: taskDueDate,
        priority: taskPriority,
        notes: taskNotes.trim() || 'No explicit study guide notes supplied.'
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

      showBannerNotification(t('updatedTaskSuccess', { title: updatedTask.title }), "success");

      if (user && isValidUuid(updatedTask.id)) {
        try {
          const { error } = await resilientUpdate('tasks', updatedTask.id, user.id, taskToDb(updatedTask, user.id));
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
        subject: taskSubject,
        dueDate: taskDueDate,
        priority: taskPriority,
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

      showBannerNotification(t('savedTaskSuccess', { title: newTask.title }), "success");

      if (user) {
        try {
          const { error } = await resilientInsert('tasks', taskToDb(newTask, user.id));
          if (error) {
            console.error('Failed to save task to Supabase:', error);
            showBannerNotification(t('savedLocallyFailedCloud'), "info");
          }
        } catch (err) {
          console.error('Task insert error:', err);
        }
      }
    }
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskSubject(task.subject);
    setTaskDueDate(task.dueDate);
    setTaskPriority(task.priority);
    setTaskNotes(task.notes);
    setIsAddingTask(true);
  };

  const closeAddTaskModal = () => {
    setIsAddingTask(false);
    setEditingTask(null);
    setTaskTitle('');
    setTaskSubject('');
    setTaskDueDate(getLocalDateString());
    setTaskPriority('medium');
    setTaskNotes('');
  };

  // Cycle a task status (Pending -> In Progress -> Completed)
  const toggleTaskStatus = async (taskId: string) => {
    let updatedTask: Task | null = null;

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          let nextStatus: TaskStatus = 'pending';
          let cPercent = 0;
          if (t.status === 'pending') {
            nextStatus = 'progress';
            cPercent = 35;
          } else if (t.status === 'progress') {
            nextStatus = 'completed';
            cPercent = 100;
          } else {
            nextStatus = 'pending';
            cPercent = 0;
          }
          updatedTask = { ...t, status: nextStatus, completedPercent: cPercent };
          return updatedTask;
        }
        return t;
      })
    );
    showBannerNotification(t('taskProgressionSynced'), "success");

    if (user && updatedTask && isValidUuid(taskId)) {
      try {
        const { error } = await resilientUpdate('tasks', taskId, user.id, {
          status: (updatedTask as Task).status,
          completed_percent: (updatedTask as Task).completedPercent
        });
        if (error) console.error('Failed to update task status in Supabase:', error);
      } catch (err) {
        console.error('Task status update error:', err);
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
  const inProgressCount = tasks.filter((t) => t.status === 'progress').length;
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

  // Upcoming exams count: exams in the calendar scheduled on or after today's date
  const upcomingExamsCount = useMemo(() => {
    const targetDate = getLocalDateString();
    return events.filter((e) => e.type === 'exam' && e.date >= targetDate).length;
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
        <div id="screen-onboarding" className="h-screen w-full flex flex-col justify-between overflow-hidden relative py-12 px-6">
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute top-0 right-0 w-80 h-80 bg-brand/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#10B981]/5 rounded-full blur-3xl" />
          </div>

          <div className="flex justify-between items-center max-w-md w-full mx-auto relative z-10">
            <div className="flex items-center gap-2">
              <BookOpen className="text-brand w-6 h-6" />
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
                      alt="Organize Your Studies"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">{t('organizeYourStudies')}</h2>
                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('organizeYourStudiesDesc')}
                    </p>
                  </div>
                </motion.div>
              )}

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
                      alt="Stay on Track"
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
                      alt="Achieve Your Goals"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-brand tracking-tight">{t('achieveYourGoals')}</h2>
                    <p className="text-sm text-secondary-text max-w-sm mx-auto mt-2 leading-relaxed">
                      {t('achieveYourGoalsDesc')}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="max-w-md w-full mx-auto relative z-10 flex flex-col items-center space-y-6">
            {/* Dots */}
            <div className="flex gap-2 justify-center">
              {[0, 1, 2].map((idx) => (
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
              <span>{onboardingSlide === 2 ? t('getStarted') : t('next')}</span>
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
            className="w-full max-w-md bg-white/95 dark:bg-card-bg/95 dark:bg-card-bg/95 backdrop-blur-md rounded-3xl border border-main-border dark:border-main-border p-8 shadow-xl relative z-10 space-y-6"
          >
            {/* Header / Logo */}
            <div className="text-center space-y-2">
              <div className="inline-flex w-12 h-12 items-center justify-center bg-brand-light dark:bg-brand-light rounded-2xl border border-main-border dark:border-main-border text-brand dark:text-brand shadow-sm mb-2">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-extrabold text-main-text dark:text-main-text tracking-tight">{t('welcomeToMindstream')}</h2>
              <p className="text-sm text-muted-text dark:text-muted-text">{t('pleaseSignIn')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="login-email">
                  {t('emailAddress')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="login-email"
                    type="email"
                    required
                    placeholder={t('nameUniversityPlaceholder')}
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="login-password">
                    {t('password')}
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-semibold text-brand dark:text-brand hover:underline"
                  >
                    {t('forgotPassword')}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder={t('securityPasswordPlaceholder')}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
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
                    className="w-4.5 h-4.5 rounded border-main-border dark:border-main-border dark:bg-brand-light text-brand dark:text-brand focus:ring-brand/20"
                  />
                  <span className="text-sm text-secondary-text dark:text-[#d1d5db] font-medium">{t('rememberMe')}</span>
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
                <div className="w-full border-t border-main-border dark:border-main-border" />
              </div>
              <span className="relative px-3 bg-white dark:bg-card-bg text-xs font-bold uppercase tracking-widest text-[#9ca3af]">
                {t('or')}
              </span>
            </div>

            {/* Google Login */}
            <button
              id="btn-login-google"
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3.5 border border-main-border dark:border-main-border hover:bg-main-bg dark:hover:bg-brand-light text-main-text dark:text-main-text rounded-2xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 text-sm"
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
            <p className="text-center text-sm text-secondary-text dark:text-muted-text">
              {t('dontHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => setCurrentScreen('register')}
                className="font-bold text-brand dark:text-brand hover:underline"
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
            className="w-full max-w-md bg-white/95 dark:bg-card-bg/95 dark:bg-card-bg/95 backdrop-blur-md rounded-3xl border border-main-border dark:border-main-border p-8 shadow-xl relative z-10 space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex w-12 h-12 items-center justify-center bg-brand-light dark:bg-brand-light rounded-2xl border border-main-border dark:border-main-border text-brand dark:text-brand shadow-sm mb-2">
                <BookOpen className="w-6 h-6" />
              </div>
              <h2 className="text-3xl font-extrabold text-main-text dark:text-main-text tracking-tight">{t('createAccount')}</h2>
              <p className="text-sm text-muted-text dark:text-muted-text">{t('joinMindstream')}</p>
            </div>

            {/* Form */}
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="register-name">
                  {t('fullName')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    id="register-name"
                    type="text"
                    required
                    placeholder={t('gabrielSemescoPlaceholder')}
                    value={registerName}
                    onChange={(e) => setRegisterName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="register-email">
                  {t('emailAddress')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <Mail className="w-4 h-4" />
                  </span>
                  <input
                    id="register-email"
                    type="email"
                    required
                    placeholder={t('gabsemescoEmailPlaceholder')}
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Student Level Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="register-level">
                  {t('studentLevelSelection')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <School className="w-4 h-4" />
                  </span>
                  <select
                    id="register-level"
                    value={registerStudentLevel}
                    onChange={(e) => setRegisterStudentLevel(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all appearance-none cursor-pointer"
                  >
                    <option value="High School">{t('levelHighSchool')}</option>
                    <option value="Undergraduate (First Year)">{t('levelUndergradFirst')}</option>
                    <option value="Undergraduate (Sophomore)">{t('levelUndergradSophomore')}</option>
                    <option value="Undergraduate (Junior)">{t('levelUndergradJunior')}</option>
                    <option value="Undergraduate (Senior)">{t('levelUndergradSenior')}</option>
                    <option value="Postgraduate / PhD">{t('levelPostgrad')}</option>
                    <option value="Lifelong Learner">{t('levelLifelong')}</option>
                  </select>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-text dark:text-muted-text">
                    <ChevronDown className="w-4 h-4" />
                  </span>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="register-password">
                  {t('password')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="register-password"
                    type="password"
                    required
                    placeholder={t('strongPasswordPlaceholder')}
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
                  />
                </div>
              </div>

              {/* Confirm Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-text dark:text-muted-text" htmlFor="register-confirm">
                  {t('confirmPassword')}
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-muted-text dark:text-muted-text">
                    <Lock className="w-4 h-4" />
                  </span>
                  <input
                    id="register-confirm"
                    type="password"
                    required
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={registerConfirmPassword}
                    onChange={(e) => setRegisterConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-main-bg dark:bg-main-bg border border-main-border dark:border-main-border text-main-text dark:text-main-text rounded-2xl text-sm focus:outline-none focus:border-brand dark:focus:border-brand focus:ring-1 focus:ring-brand transition-all"
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
                <div className="w-full border-t border-main-border dark:border-main-border" />
              </div>
              <span className="relative px-3 bg-white dark:bg-card-bg text-xs font-bold uppercase tracking-widest text-[#9ca3af]">
                {t('or')}
              </span>
            </div>

            {/* Google Registration */}
            <button
              id="btn-register-google"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthSubmitting}
              className="w-full py-3.5 border border-main-border dark:border-main-border hover:bg-main-bg dark:hover:bg-brand-light text-main-text dark:text-main-text rounded-2xl font-semibold transition-all duration-200 active:scale-95 flex items-center justify-center gap-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
            <p className="text-center text-sm text-secondary-text dark:text-muted-text pt-2">
              {t('alreadyHaveAccount')}{' '}
              <button
                type="button"
                onClick={() => setCurrentScreen('login')}
                className="font-bold text-brand dark:text-brand hover:underline flex items-center justify-center gap-1.5 mx-auto"
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
              <div className="relative w-24 h-24 flex items-center justify-center bg-white dark:bg-card-bg rounded-3xl shadow-xl border border-main-border dark:border-main-border">
                <BookOpen className="text-brand dark:text-brand w-12 h-12" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold text-brand dark:text-brand tracking-tight">{t('appName')}</h1>
              <p className="text-md text-secondary-text dark:text-muted-text font-medium leading-relaxed">{t('studySmarter')}</p>
            </div>

            {/* Loading Bar Experience */}
            <div className="space-y-4">
              <div className="h-2 w-full bg-[#dce2f3] dark:bg-brand-light rounded-full overflow-hidden relative">
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                  className="h-full bg-brand dark:bg-brand rounded-full"
                />
              </div>
              <p className="text-xs uppercase tracking-wider font-bold text-muted-text dark:text-muted-text animate-pulse">
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
          <header className="sticky top-0 w-full z-40 backdrop-blur-md bg-main-bg/80 dark:bg-main-bg/80 shadow-sm border-b border-main-border dark:border-main-border h-16 flex items-center justify-between px-4 md:px-8 max-w-7xl mx-auto transition-colors duration-300">
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
                <ChevronDown className="w-4 h-4 text-muted-text dark:text-muted-text group-hover:text-brand dark:group-hover:text-brand transition-colors" />
              </button>

              <h1 onClick={() => setActiveTab('dashboard')} className="text-lg md:text-xl font-extrabold text-brand dark:text-brand tracking-tight cursor-pointer">
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
                      className="absolute top-14 left-0 w-80 bg-white dark:bg-card-bg border border-main-border dark:border-main-border rounded-2xl shadow-2xl z-50 p-4 hidden md:flex flex-col gap-4 text-left"
                      id="profile-desktop-dropdown"
                    >
                      {/* Top Profile Banner */}
                      <div className="flex items-center gap-3.5 pb-3.5 border-b border-main-border dark:border-main-border">
                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-brand/10 shrink-0">
                          <img
                            src={currentUser?.avatarUrl || IMAGES.avatarGabriel}
                            alt="User profile"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-main-text dark:text-main-text text-sm truncate">
                            {currentUser?.fullName || 'Gabriel Semesco'}
                          </h4>
                          <p className="text-xs text-muted-text dark:text-muted-text truncate">
                            {currentUser?.email || 'gabsemesco1@gmail.com'}
                          </p>
                        </div>
                      </div>

                      {/* Streak & Score Banner */}
                      <div className="grid grid-cols-2 gap-2 bg-brand-light dark:bg-brand-light p-3 rounded-xl border border-main-border dark:border-main-border text-xs transition-colors duration-300">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-text dark:text-muted-text font-semibold uppercase tracking-wider">{t('streak')}</span>
                          <span className="font-bold text-brand dark:text-brand flex items-center gap-1 mt-0.5">
                            <Flame className="w-3.5 h-3.5 fill-current text-[#ffb695]" />
                            {streakDays} {t('days')}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-muted-text dark:text-muted-text font-semibold uppercase tracking-wider">{t('productivity')}</span>
                          <span className="font-bold text-[#006f64] dark:text-[#2dd4bf] flex items-center gap-1 mt-0.5">
                            <Award className="w-3.5 h-3.5 text-[#006f64] dark:text-[#2dd4bf]" />
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
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left"
                        >
                          <User className="w-4 h-4 shrink-0 text-muted-text dark:text-muted-text" />
                          <span>{t('myProfile')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('accountSettingsLoaded'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left"
                        >
                          <Settings className="w-4 h-4 shrink-0 text-muted-text dark:text-muted-text" />
                          <span>{t('accountSettings')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('notificationSettingsActive'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left"
                        >
                          <Bell className="w-4 h-4 shrink-0 text-muted-text dark:text-muted-text" />
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
                          className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left"
                        >
                          <div className="flex items-center gap-3">
                            {themeMode === 'light' && <Sun className="w-4 h-4 text-amber-500 shrink-0" />}
                            {themeMode === 'dark' && <Moon className="w-4 h-4 text-muted-text dark:text-muted-text shrink-0" />}
                            {themeMode === 'system' && <Monitor className="w-4 h-4 text-muted-text dark:text-muted-text shrink-0" />}
                            <span>{t('darkMode')}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold text-[#9ca3af] bg-brand-light dark:bg-brand-light px-2 py-0.5 rounded-full">
                            {themeMode}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('supportCenterChat'), "info");
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left"
                        >
                          <HelpCircle className="w-4 h-4 shrink-0 text-muted-text dark:text-muted-text" />
                          <span>{t('helpAndSupport')}</span>
                        </button>
                      </div>

                      {/* Divider */}
                      <div className="border-t border-main-border dark:border-main-border my-0.5" />

                      {/* Log Out option */}
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold text-[#ef4444] hover:bg-red-50 dark:hover:bg-red-950/25 transition-all text-left w-full"
                      >
                        <LogOut className="w-4 h-4 shrink-0 text-[#ef4444]" />
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
                      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-card-bg border-t border-main-border dark:border-main-border rounded-t-[2.5rem] shadow-2xl z-50 p-6 flex flex-col md:hidden max-h-[85vh] text-left"
                      id="profile-mobile-bottom-sheet"
                    >
                      {/* Pull Indicator handle */}
                      <div className="w-12 h-1.5 bg-brand-light dark:bg-brand-light rounded-full mx-auto mb-5 shrink-0" />

                      {/* Profile details */}
                      <div className="flex items-center gap-4 pb-5 border-b border-main-border dark:border-main-border">
                        <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-brand/15 shrink-0">
                          <img
                            src={currentUser?.avatarUrl || IMAGES.avatarGabriel}
                            alt="User profile"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-extrabold text-main-text dark:text-main-text text-base truncate">
                            {currentUser?.fullName || 'Gabriel Semesco'}
                          </h4>
                          <p className="text-xs text-muted-text dark:text-muted-text truncate">
                            {currentUser?.email || 'gabsemesco1@gmail.com'}
                          </p>
                        </div>
                      </div>

                      {/* Stats inside bottom sheet */}
                      <div className="grid grid-cols-2 gap-3 my-4 bg-brand-light dark:bg-brand-light p-4 rounded-2xl border border-main-border dark:border-main-border text-xs transition-colors duration-300">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                            <Flame className="w-4 h-4 text-orange-500 fill-current" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-text dark:text-muted-text font-semibold uppercase">{t('streak')}</span>
                            <span className="font-bold text-brand dark:text-brand">{streakDays} {t('days')}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#006f64]/10 flex items-center justify-center shrink-0">
                            <Award className="w-4 h-4 text-[#006f64]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] text-muted-text dark:text-muted-text font-semibold uppercase">{t('score')}</span>
                            <span className="font-bold text-[#006f64] dark:text-[#2dd4bf]">{productivityRatio}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Options list */}
                      <div className="flex-1 overflow-y-auto space-y-1 pr-1 no-scrollbar mb-4">
                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left w-full"
                        >
                          <User className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />
                          <span>{t('myProfile')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('profile');
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('settingsViewAvailable'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left w-full"
                        >
                          <Settings className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />
                          <span>{t('settings')}</span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('notificationPrefsSynced'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left w-full"
                        >
                          <Bell className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />
                          <span>{t('notifications')}</span>
                        </button>

                        {/* Theme Mode toggle item on mobile */}
                        <button
                          onClick={() => {
                            if (themeMode === 'light') setThemeMode('dark');
                            else if (themeMode === 'dark') setThemeMode('system');
                            else setThemeMode('light');
                          }}
                          className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left w-full"
                        >
                          <div className="flex items-center gap-3.5">
                            {themeMode === 'light' && <Sun className="w-5 h-5 text-amber-500 shrink-0" />}
                            {themeMode === 'dark' && <Moon className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />}
                            {themeMode === 'system' && <Monitor className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />}
                            <span>{t('darkMode')}</span>
                          </div>
                          <span className="text-xs uppercase font-bold text-[#9ca3af] bg-brand-light dark:bg-brand-light px-2.5 py-0.5 rounded-full">
                            {themeMode}
                          </span>
                        </button>

                        <button
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            showBannerNotification(t('supportCenterLoading'), "info");
                          }}
                          className="flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-semibold text-secondary-text dark:text-[#d1d5db] hover:bg-brand-light dark:hover:bg-brand-light hover:text-brand dark:hover:text-brand transition-all text-left w-full"
                        >
                          <HelpCircle className="w-5 h-5 text-muted-text dark:text-muted-text shrink-0" />
                          <span>{t('helpAndSupport')}</span>
                        </button>
                      </div>

                      {/* Log Out option sticky at the bottom of sheet */}
                      <div className="shrink-0 pt-4 pb-2 border-t border-main-border dark:border-main-border bg-white dark:bg-card-bg z-10">
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
                onClick={() => setShowSearch(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-light text-muted-text hover:text-brand transition-all"
                title={t('searchTaskDatabase')}
              >
                <Search className="w-5 h-5" />
              </button>
              <button
                onClick={() => showBannerNotification(t('mindstreamSyncedUpToDate'), "info")}
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-brand-light text-brand relative transition-all animate-none"
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
              <div className="bg-white p-6 rounded-2xl border border-main-border text-center space-y-3 shadow-sm">
                <div className="w-20 h-20 rounded-full mx-auto overflow-hidden border-4 border-brand/10">
                  <img src={currentUser?.avatarUrl || IMAGES.avatarGabriel} alt="User profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div>
                  <h3 className="font-bold text-main-text text-md">{currentUser?.fullName || 'Gabriel Semesco'}</h3>
                  <p className="text-xs text-muted-text break-all">{currentUser?.email || 'gabsemesco1@gmail.com'}</p>
                </div>
                <div className="flex justify-center items-center gap-1.5 px-3 py-1 bg-[#ffdbcc] text-[#7e3000] rounded-full text-xs font-bold w-fit mx-auto shadow-sm">
                  <Flame className="w-4 h-4 fill-current" />
                  <span>{streakDays} Day Streak</span>
                </div>
              </div>

              {/* Sidebar Tabs Navigation */}
              <div className="bg-white rounded-2xl border border-main-border p-4 shadow-sm space-y-1">
                {[
                  { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
                  { id: 'calendar', label: t('calendar'), icon: CalendarIcon },
                  { id: 'tasks', label: t('tasks'), icon: ListTodo },
                  { id: 'timer', label: t('timer'), icon: ClockIcon },
                  { id: 'aitutor', label: t('aiTutor'), icon: Cpu },
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

              {/* Promo Banner inside rail */}
              <div className="bg-brand text-white p-6 rounded-2xl space-y-3 relative overflow-hidden shadow-md">
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
                <p className="text-xs uppercase tracking-wider font-bold opacity-75">{t('levelUp')}</p>
                <h4 className="font-bold text-sm leading-snug">{t('deepStudyModulesActive')}</h4>
                <div className="w-full bg-white/25 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-white h-full w-[85%]" />
                </div>
                <p className="text-[11px] opacity-90 text-right">{t('yearCompletion')}</p>
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
                        title="Synchronize database with Supabase"
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all active:scale-95 ${isRefreshing
                          ? 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                          : 'bg-white hover:bg-gray-50 border-main-border text-secondary-text hover:text-brand shadow-2xs'
                          }`}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? t('refreshing') : t('refresh')}</span>
                      </button>
                    </div>

                    {/* Stat Cards Bento Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

                      {/* Stat Card 1 */}
                      <div className="bg-white p-5 rounded-2xl border border-main-border flex flex-col justify-between shadow-sm relative overflow-hidden">
                        <div className="w-10 h-10 rounded-xl bg-[#e2dfff] flex items-center justify-center text-brand">
                          <ListTodo className="w-5 h-5" />
                        </div>
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-secondary-text">{t('tasksDueToday')}</p>
                          <p className="text-2xl font-bold text-main-text mt-1">{tasksDueTodayCount}</p>
                        </div>
                      </div>

                      {/* Stat Card 2 */}
                      <div id="stat-hours" className="bg-white p-5 rounded-2xl border border-main-border flex flex-col justify-between shadow-sm">
                        <div className="flex justify-between items-start">
                          <div className="w-10 h-10 rounded-xl bg-[#6df5e1]/10 flex items-center justify-center text-[#006b5f]">
                            <ClockIcon className="w-5 h-5" />
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-secondary-text">{t('totalStudyHours')}</p>
                            <p className="text-2xl font-bold text-main-text mt-0.5">{studyHours}h</p>
                          </div>
                          <div className="flex justify-between border-t border-main-border pt-2 text-[10px] text-muted-text font-semibold">
                            <span>{t('today')} <strong className="text-[#006f64]">{todayStudyHours}h</strong></span>
                            <span>{t('thisWeek')} <strong className="text-brand">{weeklyStudyHours}h</strong></span>
                          </div>
                        </div>
                      </div>

                      {/* Stat Card 3 */}
                      <div className="bg-white p-5 rounded-2xl border border-main-border flex flex-col justify-between shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#e2dfff] flex items-center justify-center text-[#ffb695]">
                          <TrendingUp className="w-5 h-5" />
                        </div>
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-secondary-text">{t('productivityScore')}</p>
                          <p className="text-2xl font-bold text-main-text mt-1">{productivityRatio}%</p>
                        </div>
                      </div>

                      {/* Stat Card 4 */}
                      <div className="bg-white p-5 rounded-2xl border border-main-border flex flex-col justify-between shadow-sm">
                        <div className="w-10 h-10 rounded-xl bg-[#ffdbcc] flex items-center justify-center text-[#7e3000]">
                          <School className="w-5 h-5" />
                        </div>
                        <div className="mt-4">
                          <p className="text-xs font-semibold text-secondary-text">{t('upcomingExams')}</p>
                          <p className="text-2xl font-bold text-main-text mt-1">{upcomingExamsCount}</p>
                        </div>
                      </div>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                      {/* Timeline: Today's Schedule Card */}
                      <div className="lg:col-span-7 bg-white rounded-2xl border border-main-border p-6 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-md text-main-text tracking-tight">{t('todaysSchedule')}</h3>
                          <button onClick={() => setActiveTab('calendar')} className="text-xs font-bold text-brand hover:underline">
                            {t('viewFullCalendar')}
                          </button>
                        </div>

                        <div className="space-y-4 pt-2">
                          {todaysEvents.length === 0 && todaysTasks.length === 0 ? (
                            <div className="text-center py-10 text-muted-text space-y-2">
                              <BookOpen className="w-8 h-8 opacity-40 mx-auto text-brand" />
                              <p className="text-xs font-semibold text-main-text">{t('noTasksEventsToday')}</p>
                              <p className="text-[11px] text-muted-text">{t('enjoyFreeTime')}</p>
                            </div>
                          ) : (
                            <>
                              {/* Render events first */}
                              {todaysEvents.map((e, idx) => {
                                let typeColor = 'bg-brand/5 border-brand text-[#3323cc]';
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
                                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white/70">
                                          {task.status === 'completed' ? '✓ Completed' : task.status === 'progress' ? 'In Progress' : 'Pending'}
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

                        <div className="bg-white rounded-2xl border border-main-border p-6 shadow-sm space-y-4">
                          <h3 className="font-extrabold text-md text-main-text tracking-tight">{t('upcomingDeadlines')}</h3>

                          <div className="space-y-4">
                            {upcomingDeadlines.length > 0 ? (
                              upcomingDeadlines.map((task) => (
                                <div
                                  key={task.id}
                                  className="p-4 bg-brand-light rounded-xl space-y-2 border border-main-border"
                                >
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="px-2 py-0.5 bg-brand/10 text-brand rounded-full font-bold">
                                      {task.subject}
                                    </span>

                                    <span
                                      className={`font-bold ${task.priority === "high"
                                        ? "text-[#ba1a1a]"
                                        : task.priority === "medium"
                                          ? "text-[#d97706]"
                                          : "text-muted-text"
                                        }`}
                                    >
                                      {task.dueDate}
                                    </span>
                                  </div>

                                  <h4 className="font-bold text-sm text-main-text">
                                    {task.title}
                                  </h4>

                                  <div className="h-2 w-full bg-[#dce2f3] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-brand rounded-full"
                                      style={{
                                        width: `${task.completedPercent ?? 0}%`
                                      }}
                                    />
                                  </div>

                                  <p className="text-[11px] text-secondary-text text-right font-medium">
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
                            className="p-1.5 hover:bg-white text-brand rounded-lg transition-all"
                            title={t('previousMonth')}
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleNextMonth}
                            className="p-1.5 hover:bg-white text-brand rounded-lg transition-all"
                            title={t('nextMonth')}
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Switch view toggle */}
                      <div className="bg-brand-light/80 p-1 rounded-xl flex items-center justify-start w-fit shadow-xs">
                        <button
                          onClick={() => setCalendarView('month')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${calendarView === 'month' ? 'bg-white text-brand shadow-xs' : 'text-secondary-text'}`}
                        >
                          {t('month')}
                        </button>
                        <button
                          onClick={() => setCalendarView('week')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-semibold ${calendarView === 'week' ? 'bg-white text-brand shadow-xs' : 'text-secondary-text'}`}
                        >
                          {t('week')}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                      {/* Interactive Calendar grid */}
                      <div className="lg:col-span-8 bg-white p-5 rounded-2xl border border-main-border shadow-sm">
                        <div className="grid grid-cols-7 text-center font-bold text-xs text-muted-text pb-3 border-b border-main-border">
                          <span>{t('mon')}</span><span>{t('tue')}</span><span>{t('wed')}</span><span>{t('thu')}</span><span>{t('fri')}</span><span>{t('sat')}</span><span>{t('sun')}</span>
                        </div>

                        <div className="grid grid-cols-7 gap-1 md:gap-3 pt-4">
                          {/* Filler dates prior to current month */}
                          {calendarDaysInfo.fillerDays.map((dayNum, idx) => (
                            <div key={`filler-${idx}`} className="aspect-square flex items-center justify-center text-xs text-main-border">
                              {dayNum}
                            </div>
                          ))}

                          {/* Dynamic current month active days */}
                          {Array.from({ length: calendarDaysInfo.daysInMonth }, (_, i) => {
                            const dayNum = i + 1;
                            const formattedDay = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${dayNum.toString().padStart(2, '0')}`;
                            const isToday = formattedDay === getLocalDateString();
                            const isSelected = selectedDate === formattedDay;

                            // Check for events mock badge dots
                            const hasEvents = events.some((e) => e.date === formattedDay);

                            return (
                              <button
                                key={dayNum}
                                onClick={() => setSelectedDate(formattedDay)}
                                className={`aspect-square relative flex flex-col items-center justify-center rounded-xl transition-all ${isSelected
                                  ? 'bg-brand text-white font-bold shadow-lg scale-105'
                                  : isToday
                                    ? 'bg-[#e2dfff] text-brand font-bold border border-brand/20'
                                    : 'hover:bg-brand-light text-main-text'
                                  }`}
                              >
                                <span className="text-sm">{dayNum}</span>
                                {hasEvents && (
                                  <span className={`w-1 h-1 rounded-full absolute bottom-1.5 ${isSelected ? 'bg-white' : 'bg-[#14b8a6]'}`} />
                                )}
                              </button>
                            );
                          })}

                          {/* Filler dates after current month to balance the grid */}
                          {calendarDaysInfo.nextMonthFiller.map((dayNum, idx) => (
                            <div key={`next-filler-${idx}`} className="aspect-square flex items-center justify-center text-xs text-main-border/60">
                              {dayNum}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Selected Day Agenda checklist */}
                      <div className="lg:col-span-4 space-y-6">
                        <div className="bg-white p-6 rounded-2xl border border-main-border shadow-sm space-y-4">
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

                          {/* Display daily matches filtered by selection */}
                          <div className="space-y-4">
                            {/* Render calculations */}
                            {events.some(e => e.date === selectedDate) ? (
                              events
                                .filter(e => e.date === selectedDate)
                                .map((e) => {
                                  let typeColor = 'bg-blue-50 border-[#3B82F6] text-[#1E40AF]';
                                  if (e.type === 'exam') typeColor = 'bg-red-50 border-[#ba1a1a] text-[#ba1a1a]';
                                  if (e.type === 'class') typeColor = 'bg-brand/5 border-brand text-[#3323cc]';
                                  if (e.type === 'study') typeColor = 'bg-emerald-50 border-[#006b5f] text-[#006f64]';
                                  if (e.type === 'submission') typeColor = 'bg-purple-50 border-[#7c3aed] text-[#5b21b6]';

                                  return (
                                    <div key={e.id} className="flex gap-3 text-left group">
                                      <div className="text-xs text-muted-text pt-1 whitespace-nowrap w-16">{e.time}</div>
                                      <div className={`flex-1 p-3 border-l-4 rounded-r-xl relative ${typeColor}`}>
                                        <h4 className="text-xs font-semibold leading-snug pr-12">{e.title}</h4>
                                        <p className="text-[10px] opacity-85 mt-0.5">{e.location} • {e.duration} Hours • {e.subject}</p>

                                        {/* Edit & Delete hover controls */}
                                        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white/90 backdrop-blur-xs p-0.5 rounded-lg transition-opacity border border-gray-100 shadow-sm">
                                          <button
                                            onClick={() => startEditEvent(e)}
                                            className="p-1 text-muted-text hover:text-brand rounded-md hover:bg-gray-100 transition-colors"
                                            title={t('editEvent')}
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button
                                            onClick={() => deleteEvent(e.id)}
                                            className="p-1 text-muted-text hover:text-red-500 rounded-md hover:bg-gray-100 transition-colors"
                                            title={t('deleteEvent')}
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                            ) : (
                              <div className="text-center py-8 text-muted-text space-y-2">
                                <BookOpen className="w-8 h-8 opacity-40 mx-auto" />
                                <p className="text-xs font-medium">{t('noScheduleBlocks')}</p>
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

                        {/* Summary panel highlights */}
                        <div className="bg-brand-light p-5 rounded-2xl border border-main-border space-y-4">
                          <h3 className="text-xs uppercase tracking-wider font-bold text-muted-text">{t('upcomingHighlights')}</h3>

                          <div className="space-y-3">
                            {upcomingHighlights.length > 0 ? (
                              upcomingHighlights.map((event) => (
                                <div
                                  key={event.id}
                                  className="flex gap-3 items-center bg-white p-3 rounded-xl border border-main-border"
                                >
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${event.type === "exam"
                                      ? "bg-red-100 text-red-600"
                                      : "bg-[#e2dfff] text-brand"
                                      }`}
                                  >
                                    {event.type === "exam" ? (
                                      <School className="w-4 h-4" />
                                    ) : (
                                      <BookOpen className="w-4 h-4" />
                                    )}
                                  </div>

                                  <div>
                                    <h4 className="text-xs font-bold">
                                      {event.title}
                                    </h4>

                                    <p className="text-[10px] text-muted-text">
                                      {event.date}
                                      {event.time ? `, ${event.time}` : ""}
                                    </p>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-center py-6 text-muted-text text-xs">
                                {t("noUpcomingHighlights")}
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
                        <h2 className="text-2xl md:text-3xl font-extrabold text-main-text">{t('academicTasks')}</h2>
                        <p className="text-sm text-secondary-text">{t('manageChecklists')}</p>
                      </div>

                      {/* Segment Tab controller filter */}
                      <div className="bg-brand-light/80 p-1 rounded-xl flex items-center w-fit shadow-xs">
                        {(['pending', 'progress', 'completed'] as TaskStatus[]).map((st) => (
                          <button
                            key={st}
                            onClick={() => setTaskFilter(st)}
                            className={`px-5 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${taskFilter === st ? 'bg-white text-brand shadow-xs' : 'text-secondary-text hover:text-brand'
                              }`}
                          >
                            {st === 'progress' ? 'In Progress' : st}
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
                                className="bg-white p-6 rounded-2xl border border-main-border shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between"
                              >
                                {/* Left priority color strip */}
                                <div className={`absolute top-0 left-0 w-1 h-full ${isHigh ? 'bg-[#ba1a1a]' : isMed ? 'bg-brand' : 'bg-[#777587]'}`} />

                                <div>
                                  <div className="flex justify-between items-start mb-3">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isHigh ? 'bg-red-100 text-red-600' : isMed ? 'bg-indigo-100 text-brand' : 'bg-gray-100 text-muted-text'
                                      }`}>
                                      {t('priorityLabel', { priority: task.priority })}
                                    </span>
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => toggleTaskStatus(task.id)}
                                        className="text-muted-text hover:text-brand p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        title={t('cycleStatus')}
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={() => startEditTask(task)}
                                        className="text-muted-text hover:text-brand p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        title={t('editTaskDetails')}
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => deleteTask(task.id)}
                                        className="text-muted-text hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        title={t('removeTask')}
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <h3 className="font-extrabold text-md text-main-text mb-1">{task.title}</h3>
                                  <p className="text-xs text-[#006f64] font-medium flex items-center gap-1.5 mb-3">
                                    <School className="w-3.5 h-3.5" />
                                    <span>{task.subject}</span>
                                  </p>

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
                        <div className="col-span-full bg-white rounded-2xl border border-main-border py-16 px-4 text-center space-y-3">
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

                      {/* Productivity card highlights */}
                      <div className="col-span-full md:col-span-1 bg-white p-6 rounded-2xl border border-main-border shadow-sm flex flex-col justify-center items-center text-center space-y-3">
                        <div className="w-12 h-12 rounded-full bg-brand-light text-brand flex items-center justify-center shadow-xs">
                          <Flame className="w-6 h-6 fill-current" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-main-text">{t('academicStreakTracker')}</p>
                          <p className="text-2xl font-black text-brand mt-0.5">{streakDays} {t('days')}</p>
                          <p className="text-[11px] text-muted-text mt-1">{t('keepStudyingDaily', { name: currentUser?.fullName?.split(' ')[0] || 'Gabriel' })}</p>
                        </div>
                      </div>

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
                    className="max-w-md mx-auto bg-white p-8 rounded-2xl border border-main-border shadow-lg text-center space-y-6"
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
                      <div className="flex bg-brand-light p-1 rounded-xl border border-main-border">
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
                            className={`flex-1 text-center py-2 rounded-lg text-xs font-bold transition-all ${timerTargetMinutes === mins ? 'bg-white text-brand shadow-xs font-extrabold scale-105' : 'text-secondary-text hover:bg-white/40'
                              }`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Category selectors */}
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary-text block text-left">{t('currentStudyCategory')}</label>
                      <div className="flex flex-wrap gap-1.5 justify-start">
                        {['Deep Focus', 'Essay writing', 'Exam drills', 'Coding session'].map((cat) => (
                          <button
                            key={cat}
                            onClick={() => setTimerCategory(cat)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold ${timerCategory === cat ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-secondary-text hover:bg-brand-light'
                              }`}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Operational controls */}
                    <div className="flex items-center justify-center gap-4 pt-1">
                      <button
                        onClick={() => {
                          setTimerMinutes(timerTargetMinutes);
                          setTimerSeconds(0);
                          setIsTimerRunning(false);
                        }}
                        className="w-12 h-12 bg-gray-100 text-secondary-text hover:bg-brand-light rounded-full flex items-center justify-center transition-all duration-200 active:scale-95"
                        title="Reset countdown"
                      >
                        <RotateCcw className="w-5 h-5" />
                      </button>

                      <button
                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                        className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md transition-all duration-200 active:scale-95 ${isTimerRunning ? 'bg-[#ba1a1a] hover:bg-[#ba1a1a]/90' : 'bg-brand hover:bg-brand/90'
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
                        title="Skip ahead to log workout hours"
                      >
                        {t('skip')}
                      </button>
                    </div>

                    {/* Active Study Metrics Summary Stats */}
                    <div className="grid grid-cols-3 gap-2 bg-brand-light p-3.5 rounded-xl border border-main-border text-center">
                      <div>
                        <p className="text-[10px] font-bold text-muted-text uppercase">{t('today')}</p>
                        <p className="text-md font-extrabold text-[#006f64]">{todayStudyHours}h</p>
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
                            <div key={session.id || sidx} className="flex justify-between items-center text-xs p-2.5 bg-gray-50/80 rounded-xl border border-gray-100 transition-colors hover:bg-gray-50">
                              <div className="space-y-0.5">
                                <p className="font-extrabold text-main-text">{session.category}</p>
                                <p className="text-[10px] text-muted-text font-medium">
                                  {new Date(session.completed_at || session.completedAt || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric' })} at {new Date(session.completed_at || session.completedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              <span className="text-[11px] font-black text-brand bg-white px-2 py-1 rounded-lg border border-main-border/80 shadow-2xs">
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
                        className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-extrabold text-xs transition-all duration-200 shadow-sm active:scale-95 cursor-pointer dark:bg-brand dark:hover:bg-brand-hover"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t('newStudySession')}</span>
                      </button>

                      {/* Saved Conversations list */}
                      <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-main-border dark:border-main-border shadow-xs flex-1 flex flex-col min-h-0">
                        <h3 className="text-[11px] font-bold text-muted-text dark:text-muted-text uppercase tracking-wider mb-3">
                          {t('recentSessions')}
                        </h3>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-2 no-scrollbar">
                          {conversations.map((c) => {
                            const isActive = c.id === activeConversationId;
                            const isEditing = c.id === editingConvId;

                            return (
                              <div
                                key={c.id}
                                onClick={() => !isEditing && setActiveConversationId(c.id)}
                                className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200 ${isActive
                                  ? 'bg-brand-light dark:bg-brand-light text-brand dark:text-brand border-brand/20 dark:border-brand/20'
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
                                      className="w-full bg-white dark:bg-main-bg px-2 py-1 rounded text-xs text-main-text dark:text-main-text border border-brand/30 dark:border-brand/30 outline-none"
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') setEditingConvId(null);
                                      }}
                                    />
                                    <button
                                      type="submit"
                                      className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 cursor-pointer"
                                      title="Save Title"
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
                                        title="Rename"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={(e) => handleDeleteConversation(c.id, e)}
                                        className="p-1 hover:bg-red-50 dark:hover:bg-red-950 rounded text-red-500 hover:text-red-600 dark:text-red-400 cursor-pointer"
                                        title="Delete"
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

                      {/* Help Topics / Quick Methods */}
                      <div className="bg-white dark:bg-card-bg p-5 rounded-2xl border border-main-border dark:border-main-border shadow-xs space-y-3 shrink-0">
                        <h3 className="text-[11px] font-bold text-muted-text dark:text-muted-text uppercase tracking-wider">
                          {t('tutorTopics')}
                        </h3>
                        <div className="space-y-1.5">
                          {[
                            {
                              label: 'Create Study Schedule',
                              prompt: 'I need a highly realistic, personalized 4-week study schedule for my course. Can you help me map this out with Pomodoro slots?',
                              icon: CalendarIcon,
                              color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40'
                            },
                            {
                              label: 'Prepare for Exams',
                              prompt: 'I have an upcoming exam next week. Please outline a rigorous exam preparation checklist, dynamic review plan, and study guides for this topic.',
                              icon: Award,
                              color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40'
                            },
                            {
                              label: 'Explain Concepts',
                              prompt: 'Can you explain the key concepts of our lectures? Please select a core topic or let me ask questions to break down complex variables logically.',
                              icon: BookOpen,
                              color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40'
                            },
                            {
                              label: 'Generate Quiz Questions',
                              prompt: 'Could you generate 5 high-yield multiple-choice and active recall practice questions for me to check my understanding?',
                              icon: School,
                              color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40'
                            },
                            {
                              label: 'Productivity Advice',
                              prompt: 'Provide scientific productivity advice. What are effective methods (e.g. active recall, spaced repetition, Pomodoro) to avoid procrastination?',
                              icon: Sparkles,
                              color: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40'
                            }
                          ].map((topic) => {
                            const Icon = topic.icon;
                            return (
                              <button
                                key={topic.label}
                                onClick={() => handleSendChatMessage(topic.prompt)}
                                className="w-full text-left p-2 rounded-xl text-[11px] font-bold hover:bg-gray-50 dark:hover:bg-brand-light/40 text-secondary-text dark:text-muted-text flex items-center gap-2.5 transition-all cursor-pointer"
                              >
                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${topic.color}`}>
                                  <Icon className="w-3.5 h-3.5" />
                                </div>
                                <span className="truncate">{topic.label}</span>
                              </button>
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
                            className="lg:hidden absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-card-bg border-r border-main-border dark:border-main-border z-50 rounded-l-2xl p-5 flex flex-col"
                          >
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="font-bold text-sm text-main-text dark:text-main-text">{t('studySessions')}</h3>
                              <button
                                onClick={() => setIsMobileHistoryOpen(false)}
                                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
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
                              {conversations.map((c) => {
                                const isActive = c.id === activeConversationId;
                                const isEditing = c.id === editingConvId;
                                return (
                                  <div
                                    key={c.id}
                                    onClick={() => {
                                      if (!isEditing) {
                                        setActiveConversationId(c.id);
                                        setIsMobileHistoryOpen(false);
                                      }
                                    }}
                                    className={`group flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all duration-200 ${isActive
                                      ? 'bg-brand-light dark:bg-brand-light text-brand dark:text-brand border-brand/20 dark:border-brand/20'
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
                                          className="w-full bg-white dark:bg-main-bg px-2 py-1 rounded text-xs text-main-text dark:text-main-text border border-brand/30 dark:border-brand/30 outline-none"
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

                            <div className="border-t border-main-border dark:border-main-border pt-4 space-y-3 shrink-0">
                              <h4 className="text-[10px] font-bold text-muted-text dark:text-muted-text uppercase tracking-wider">{t('tutorTools')}</h4>
                              <div className="grid grid-cols-1 gap-1.5">
                                {[
                                  { label: '📅 Study Planner', prompt: 'I need a highly realistic, personalized 4-week study schedule for my course. Can you help me map this out with Pomodoro slots?' },
                                  { label: '📝 Exam Prep', prompt: 'I have an upcoming exam next week. Please outline a rigorous exam preparation checklist, dynamic review plan, and study guides for this topic.' },
                                  { label: '💡 Concept Explainer', prompt: 'Can you explain the key concepts of our lectures? Please select a core topic or let me ask questions to break down complex variables logically.' },
                                  { label: '🧠 Practice Quizzes', prompt: 'Could you generate 5 high-yield multiple-choice and active recall practice questions for me to check my understanding?' },
                                  { label: '⚡ Focus Advice', prompt: 'Provide scientific productivity advice. What are effective methods (e.g. active recall, spaced repetition, Pomodoro) to avoid procrastination?' }
                                ].map((t) => (
                                  <button
                                    key={t.label}
                                    onClick={() => {
                                      handleSendChatMessage(t.prompt);
                                      setIsMobileHistoryOpen(false);
                                    }}
                                    className="w-full text-left p-2 rounded-lg text-[11px] font-semibold hover:bg-gray-50 dark:hover:bg-brand-light/40 text-secondary-text dark:text-muted-text truncate cursor-pointer"
                                  >
                                    {t.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>

                    {/* Chat Messenger Box container */}
                    <section className="flex-1 bg-white dark:bg-card-bg rounded-2xl border border-main-border dark:border-main-border flex flex-col justify-between overflow-hidden shadow-sm">

                      {/* Chat Header */}
                      <header className="px-5 py-3.5 border-b border-main-border dark:border-main-border flex items-center justify-between bg-white dark:bg-card-bg">
                        <div className="flex items-center gap-3">
                          {/* Mobile history trigger button */}
                          <button
                            onClick={() => setIsMobileHistoryOpen(true)}
                            className="lg:hidden flex items-center justify-center p-1.5 rounded-lg bg-brand/10 text-brand dark:text-brand hover:bg-brand/15 active:scale-95 transition-all mr-1 cursor-pointer"
                            title="Open history sidebar"
                          >
                            <ClockIcon className="w-4 h-4" />
                          </button>

                          <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] animate-pulse" />
                          <span className="text-xs font-bold text-secondary-text dark:text-muted-text">{t('aiCompanion')}</span>
                        </div>
                        <button
                          onClick={() => showBannerNotification(t('mindstreamAIRunning'), "info")}
                          className="text-xs font-bold text-brand dark:text-brand hover:underline cursor-pointer"
                        >
                          v3.5 Flash
                        </button>
                      </header>

                      {/* Messages Area scroll frame */}
                      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
                        {chatMessages.map((m) => {
                          const isAI = m.role === 'assistant';
                          return (
                            <div key={m.id} className={`flex gap-3 max-w-[85%] ${isAI ? '' : 'ml-auto flex-row-reverse'}`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ${isAI
                                ? 'bg-brand/10 dark:bg-brand/10 border-[#3223cc]/10 dark:border-brand/15 text-brand dark:text-brand'
                                : 'bg-[#e2dfff] dark:bg-[#252347] border-indigo-200 dark:border-indigo-950 text-brand dark:text-brand'
                                }`}>
                                {isAI ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
                              </div>
                              <div className={`p-4 rounded-2xl ${isAI
                                ? 'bg-brand-light dark:bg-brand-light rounded-tl-none text-main-text dark:text-[#e2e8f0] border border-main-border dark:border-main-border'
                                : 'bg-brand dark:bg-brand text-white rounded-tr-none shadow-sm'
                                }`}>
                                <div className="space-y-2">
                                  {renderMessageText(m.text)}
                                </div>
                                <span className={`block text-[9px] mt-2 font-bold uppercase tracking-wider ${isAI ? 'text-muted-text dark:text-muted-text' : 'text-white/70 text-right'}`}>
                                  {m.timestamp}
                                </span>
                              </div>
                            </div>
                          );
                        })}

                        {isAiTyping && (
                          <div className="flex gap-3 max-w-[85%] animate-pulse">
                            <div className="w-10 h-10 rounded-full bg-brand/10 dark:bg-brand/10 flex items-center justify-center shrink-0 text-brand dark:text-brand">
                              <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-brand-light dark:bg-brand-light p-4 rounded-2xl rounded-tl-none border border-main-border dark:border-main-border">
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
                      <footer className="p-4 border-t border-main-border dark:border-main-border bg-main-bg dark:bg-main-bg space-y-3 shrink-0">

                        {/* Chips list mapping */}
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { text: 'Create study plan', icon: CalendarIcon, prompt: 'I want you to help me create a detailed weekly study plan for my courses.' },
                            { text: 'Prepare for biology exam', icon: Award, prompt: 'Can you help me prepare for my upcoming Molecular Biology exam with a breakdown of essential concepts?' },
                            { text: 'Explain deep learning', icon: BookOpen, prompt: 'Can you explain the conceptual difference between Deep Learning, Machine Learning, and standard AI algorithms?' },
                            { text: 'Quiz me on chemistry', icon: School, prompt: 'Please generate a high-yield quiz with 5 questions testing basic organic chemistry mechanisms.' },
                            { text: 'Tips for procrastination', icon: Sparkles, prompt: 'What are science-backed productivity methods and advice on avoiding procrastination when studying?' }
                          ].map((chip) => {
                            const Icon = chip.icon;
                            return (
                              <button
                                key={chip.text}
                                onClick={() => handleSendChatMessage(chip.prompt)}
                                className="px-3.5 py-1.5 rounded-full border border-brand/30 dark:border-brand/30 hover:border-brand dark:hover:border-[#7f75f0] text-brand dark:text-brand bg-white dark:bg-card-bg text-[11px] font-bold hover:bg-brand-light dark:hover:bg-brand-light active:scale-95 transition-all flex items-center gap-1.5 shadow-5xs cursor-pointer"
                              >
                                <Icon className="w-3.5 h-3.5" />
                                <span>{chip.text}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Input line */}
                        <div className="flex items-center gap-3 bg-white dark:bg-card-bg border-2 border-main-border dark:border-main-border rounded-2xl px-4 py-2 focus-within:border-brand dark:focus-within:border-[#7f75f0] transition-all">
                          <button
                            onClick={() => showBannerNotification(t('uploadNotes'), "info")}
                            className="p-1.5 text-muted-text hover:text-brand dark:hover:text-brand transition-colors cursor-pointer"
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
                            className="flex-1 bg-transparent border-none outline-none text-xs md:text-sm text-main-text dark:text-main-text placeholder:text-muted-text/70"
                          />
                          <button
                            onClick={() => handleSendChatMessage()}
                            className="bg-brand dark:bg-brand hover:bg-brand-hover dark:hover:bg-brand-hover text-white p-2 rounded-xl transition-all active:scale-95 shadow-sm cursor-pointer"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>

                      </footer>

                    </section>
                  </motion.section>
                )}

                {/* SUB TAB: PROFILE AND METRICS */}
                {activeTab === 'profile' && (
                  <motion.section
                    key="tab-view-profile"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="max-w-xl mx-auto bg-white rounded-2xl border border-main-border p-6 shadow-sm space-y-6"
                  >
                    <div className="flex items-center gap-4 pb-4 border-b border-main-border">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand">
                        <img src={currentUser?.avatarUrl || IMAGES.avatarGabriel} alt="User profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <div>
                        <h3 className="font-extrabold text-lg text-main-text">{currentUser?.fullName || 'Gabriel J. Semesco'}</h3>
                        <p className="text-xs text-muted-text">{currentUser?.studentLevel || 'Undergraduate'} • {currentUser?.email || 'gabsemesco1@gmail.com'}</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-wider font-bold text-muted-text">{t('academicMilestonesCompleted')}</h4>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-brand-light p-4 rounded-xl border border-main-border">
                          <span className="text-xs text-muted-text">{t('studyStreak')}</span>
                          <p className="text-xl font-bold text-brand mt-0.5">{t('streakCheckpoints', { count: streakDays })}</p>
                        </div>
                        <div className="bg-brand-light p-4 rounded-xl border border-main-border">
                          <span className="text-xs text-muted-text">{t('assignmentsLogs')}</span>
                          <p className="text-xl font-bold text-[#006f64] mt-0.5">{t('assignmentsCompleted', { count: completedCount })}</p>
                        </div>
                      </div>

                      <div className="bg-main-bg p-4 rounded-xl border border-main-border space-y-2 text-xs">
                        <p className="font-bold text-main-text">{t('academicSettings')}</p>
                        <ul className="space-y-2 mt-2 text-secondary-text">
                          <li className="flex justify-between">
                            <span>{t('autoSummaryAlerts')}</span>
                            <span className="text-brand font-bold">{t('enabled')}</span>
                          </li>
                          <li className="flex justify-between">
                            <span>{t('notificationsSyncChannels')}</span>
                            <span className="text-brand font-bold">gabsemesco1@gmail.com</span>
                          </li>
                          <li className="flex justify-between">
                            <span>{t('classWorkspaceInstanceId')}</span>
                            <span className="font-mono text-[10px] text-muted-text">611c2af5-f1ef</span>
                          </li>
                          <li className="flex justify-between items-center relative">
                            <span>🌐 {t('language')}</span>

                            <button
                              type="button"
                              onClick={() => setLanguageMenuOpen(!languageMenuOpen)}
                              className="flex items-center gap-2 text-brand font-bold hover:opacity-80"
                            >
                              {i18n.language === "fr"
                                ? "Français"
                                : i18n.language === "id"
                                  ? "Bahasa Indonesia"
                                  : "English"}

                              <ChevronDown className="w-4 h-4" />
                            </button>

                            {languageMenuOpen && (
                              <div className="absolute right-0 top-8 bg-white border border-main-border rounded-lg shadow-lg z-50 w-44 overflow-hidden">

                                <button
                                  className="w-full text-left px-4 py-2 hover:bg-brand-light"
                                  onClick={() => {
                                    i18n.changeLanguage("en");
                                    setLanguageMenuOpen(false);
                                  }}
                                >
                                  🇬🇧 English
                                </button>

                                <button
                                  className="w-full text-left px-4 py-2 hover:bg-brand-light"
                                  onClick={() => {
                                    i18n.changeLanguage("fr");
                                    setLanguageMenuOpen(false);
                                  }}
                                >
                                  🇫🇷 Français
                                </button>

                                <button
                                  className="w-full text-left px-4 py-2 hover:bg-brand-light"
                                  onClick={() => {
                                    i18n.changeLanguage("id");
                                    setLanguageMenuOpen(false);
                                  }}
                                >
                                  🇮🇩 Bahasa Indonesia
                                </button>

                              </div>
                            )}
                          </li>
                        </ul>
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
            className="fixed bottom-20 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-brand hover:bg-brand-hover text-white rounded-full shadow-lg flex items-center justify-center transition-all duration-200 active:scale-95 hover:scale-105 z-50 group"
            title="Create a new task..."
          >
            <Plus className="w-6 h-6 stroke-[3px]" />
            <span className="absolute right-16 bg-main-text text-white text-[11px] font-bold tracking-tight px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {t('addNewTask')}
            </span>
          </button>

          {/* Botom navigation shell exclusively on mobile devices */}
          <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-11/12 max-w-sm z-50 rounded-2xl backdrop-blur-md bg-white/95 dark:bg-card-bg/95 shadow-xl border border-main-border flex justify-around items-center px-2 py-2">
            {[
              { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
              { id: 'calendar', label: t('calendar'), icon: CalendarIcon },
              { id: 'tasks', label: t('tasks'), icon: ListTodo },
              { id: 'timer', label: t('timer'), icon: ClockIcon },
              { id: 'aitutor', label: t('aiTutor'), icon: Cpu }
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
                  className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-main-border overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
                >
                  <form onSubmit={handleCreateTask} className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh] overflow-hidden">

                    {/* Modal Header */}
                    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-main-border bg-white z-10">
                      <button
                        type="button"
                        onClick={closeAddTaskModal}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-muted-text hover:text-brand transition-colors"
                      >
                        <X className="w-5 h-5 animate-none" />
                      </button>
                      <h1 className="text-md font-extrabold text-main-text tracking-tight">{editingTask ? t('editTaskTitle') : t('newTaskTitle')}</h1>
                      <div className="w-8 shrink-0" /> {/* Centering balance */}
                    </header>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto no-scrollbar">

                      {/* Floating draft icon ribbon */}
                      <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-[#3525cd]/5 to-[#6df5e1]/10 border border-main-border flex items-center justify-center">
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
                          className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
                        />
                      </div>

                      {/* Course / Subject */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('subjectLabel')}</label>
                        <input
                          type="text"
                          required
                          value={taskSubject}
                          onChange={(e) => setTaskSubject(e.target.value)}
                          placeholder={t('subjectPlaceholder')}
                          className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
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
                          className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
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
                              className={`flex-1 text-center py-2 rounded-lg text-xs font-bold uppercase transition-all ${taskPriority === p ? 'bg-white text-brand shadow-xs' : 'text-secondary-text hover:bg-white/40'
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
                          className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white resize-none"
                        />
                      </div>
                    </div>

                    {/* Actions Sticky Footer */}
                    <footer className="shrink-0 p-6 border-t border-main-border bg-white flex gap-3 text-sm">
                      <button
                        type="button"
                        onClick={closeAddTaskModal}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs text-secondary-text bg-gray-100 hover:bg-brand-light transition-colors active:scale-95"
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
                  className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-main-border overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]"
                >
                  <form onSubmit={handleCreateEvent} className="flex flex-col h-full max-h-[90vh] md:max-h-[85vh] overflow-hidden">

                    {/* Modal Header */}
                    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-main-border bg-white z-10">
                      <button
                        type="button"
                        onClick={closeAddEventModal}
                        className="p-1.5 hover:bg-gray-100 rounded-full text-muted-text hover:text-brand transition-colors"
                      >
                        <X className="w-5 h-5 animate-none" />
                      </button>
                      <h1 className="text-md font-extrabold text-main-text tracking-tight">{editingEvent ? t('editEventTitle') : t('newEventTitle')}</h1>
                      <div className="w-8 shrink-0" /> {/* Centering balance */}
                    </header>

                    {/* Scrollable Form Body */}
                    <div className="flex-1 p-6 space-y-5 overflow-y-auto no-scrollbar">

                      {/* Floating draft icon ribbon */}
                      <div className="relative w-full h-24 rounded-xl bg-gradient-to-br from-[#3525cd]/5 to-[#6df5e1]/10 border border-main-border flex items-center justify-center">
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
                          className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
                        />
                      </div>

                      {/* Subject */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5">{t('subjectLabel')}</label>
                        <div className="relative">
                          <select
                            required
                            value={eventSubject}
                            onChange={(e) => setEventSubject(e.target.value)}
                            className="w-full appearance-none px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white pr-10"
                          >
                            <option value="">{t('selectSubject')}</option>
                            <option value="Computer Science">{t('subjectComputerScience')}</option>
                            <option value="Mathematics">{t('subjectMathematics')}</option>
                            <option value="Modern History">{t('subjectModernHistory')}</option>
                            <option value="Applied Physics">{t('subjectAppliedPhysics')}</option>
                            <option value="Biology">{t('subjectBiology')}</option>
                            <option value="General Study">{t('subjectGeneralStudy')}</option>
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
                            className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
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
                            className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
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
                            className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
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
                            className="w-full px-4 py-3 rounded-xl border border-main-border focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all outline-none text-xs md:text-sm text-main-text bg-white"
                          />
                        </div>
                      </div>

                      {/* Type segmented tabs */}
                      <div className="space-y-1.5 text-left">
                        <label className="text-xs font-bold text-secondary-text ml-0.5 block">{t('eventTypeLabel')}</label>
                        <div className="flex bg-brand-light p-1 rounded-xl border border-main-border">
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
                              className={`flex-1 text-center py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${eventType === t.id ? 'bg-white text-brand shadow-xs font-extrabold scale-105' : 'text-secondary-text hover:bg-white/40'
                                }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions Sticky Footer */}
                    <footer className="shrink-0 p-6 border-t border-main-border bg-white flex gap-3 text-sm">
                      <button
                        type="button"
                        onClick={closeAddEventModal}
                        className="flex-1 py-3 px-4 rounded-xl font-semibold text-xs text-secondary-text bg-gray-100 hover:bg-brand-light transition-colors active:scale-95"
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

          {/* 5. SEARCH OVERLAY POPUP DIALOG */}
          <AnimatePresence>
            {showSearch && (
              <div className="fixed inset-0 bg-main-text/50 backdrop-blur-xs z-[110] flex items-start justify-center pt-20 px-4">
                <div className="absolute inset-0" onClick={() => setShowSearch(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="relative w-full max-w-lg bg-white rounded-2xl border border-main-border shadow-2xl overflow-hidden p-6 space-y-4"
                >
                  <div className="flex items-center gap-3 border-b border-main-border pb-3">
                    <Search className="w-5 h-5 text-brand" />
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder={t('searchPlaceholder')}
                      className="flex-1 bg-transparent border-none outline-none text-sm text-main-text"
                    />
                    <button onClick={() => setShowSearch(false)} className="text-muted-text hover:text-main-text">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Filtered outputs */}
                  <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                    {searchQuery.trim() !== '' ? (
                      tasks.filter((t) =>
                        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        t.subject.toLowerCase().includes(searchQuery.toLowerCase())
                      ).length > 0 ? (
                        tasks
                          .filter((task) =>
                            task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            task.subject.toLowerCase().includes(searchQuery.toLowerCase())
                          )
                          .map((task) => (
                            <div
                              key={task.id}
                              onClick={() => {
                                setShowSearch(false);
                                setActiveTab('tasks');
                                setTaskFilter(task.status);
                              }}
                              className="p-3 bg-brand-light hover:bg-[#e2dfff]/60 rounded-xl border border-main-border flex justify-between items-center cursor-pointer transition-colors"
                            >
                              <div>
                                <h4 className="text-xs font-bold text-main-text">{task.title}</h4>
                                <p className="text-[10px] text-muted-text">{task.subject} • {t('statusLabel')}: {task.status}</p>
                              </div>
                              <ArrowRight className="w-4 h-4 text-brand" />
                            </div>
                          ))
                      ) : (
                        <p className="text-xs text-center text-muted-text py-4">{t('noSearchMatches')}</p>
                      )
                    ) : (
                      <p className="text-xs text-muted-text text-center py-4">{t('searchRunning')}</p>
                    )}
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

        </div>
      )}

    </div>
  );
}
