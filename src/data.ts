import { Task, CalendarEvent, ChatMessage } from './types';

export const INITIAL_TASKS: Task[] = [
  {
    id: 'task-1',
    title: 'Data Structures Lab',
    subject: 'Computer Science',
    dueDate: '2023-10-24',
    priority: 'high',
    status: 'pending',
    notes: 'Implement Red-Black tree deletion and balancing functions.',
    completedPercent: 65,
  },
  {
    id: 'task-2',
    title: 'Microeconomics Essay',
    subject: 'Economics 101',
    dueDate: '2023-10-26',
    priority: 'medium',
    status: 'pending',
    notes: 'Write 1000-word essay on market supply / demand equilibria and price caps.',
  },
  {
    id: 'task-3',
    title: 'Reading Assignment',
    subject: 'Modern History',
    dueDate: '2023-10-30',
    priority: 'low',
    status: 'pending',
    notes: 'Read chapters 4 to 6 on Industrial Revolution impacts on urbanization.',
  },
  {
    id: 'task-4',
    title: 'Senior Thesis: AI Ethics',
    subject: 'Philosophy & Tech',
    dueDate: '2023-11-15',
    priority: 'high',
    status: 'progress',
    notes: 'Draft discussion on utilitarian perspectives of algorithmic alignment.',
    completedPercent: 65,
    nextMilestone: 'Draft Review',
  },
  {
    id: 'task-5',
    title: 'Thermodynamics Report',
    subject: 'Applied Physics',
    dueDate: '2023-10-25',
    priority: 'high',
    status: 'progress',
    notes: 'Analyze entropy change curves from lab session 4.',
    completedPercent: 20,
  }
];

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 'event-1',
    title: 'Advanced Mathematics',
    time: '09:00 AM',
    duration: 1.5,
    location: 'Lecture Hall B',
    date: '2023-10-04',
    type: 'class',
    subject: 'Mathematics',
  },
  {
    id: 'event-2',
    title: 'Deep Focus Session',
    time: '11:30 AM',
    duration: 2.0,
    location: 'Library Third Floor',
    date: '2023-10-04',
    type: 'study',
    subject: 'General Study',
  },
  {
    id: 'event-3',
    title: 'Group Project: AI Ethics',
    time: '02:00 PM',
    duration: 1.0,
    location: 'Virtual Meeting',
    date: '2023-10-04',
    type: 'study',
    subject: 'Philosophy & Tech',
  },
  {
    id: 'event-4',
    title: 'Advanced Calculus Exam',
    time: '09:00 AM',
    duration: 2.0,
    location: 'Room 402',
    date: '2023-10-04',
    type: 'exam',
    subject: 'Mathematics',
  },
  {
    id: 'event-5',
    title: 'Physics Group Study',
    time: '02:00 PM',
    duration: 1.5,
    location: 'Library Floor 2',
    date: '2023-10-04',
    type: 'study',
    subject: 'Physics',
  },
  {
    id: 'event-6',
    title: 'History Essay Submission',
    time: '04:30 PM',
    duration: 0.5,
    location: 'Portal Deadline',
    date: '2023-10-04',
    type: 'submission',
    subject: 'Modern History',
  }
];

export const INITIAL_CHAT: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'assistant',
    text: "Hello! I'm your MindStream AI Companion. How can I help you plan, organize, brainstorm, or solve your goals today?",
    timestamp: '10:00 AM',
  },
  {
    id: 'msg-2',
    role: 'user',
    text: 'Can you help me break down a complex project into manageable milestones and set up a prioritized checklist?',
    timestamp: '10:02 AM',
  },
  {
    id: 'msg-3',
    role: 'assistant',
    text: "I'd be glad to help. Let's outline the core deliverables, identify key dependencies, and structure a practical step-by-step action plan.",
    timestamp: '10:03 AM',
  }
];

export const IMAGES = {
  illustrationSlide1: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDQ1DNbbrSZNgy0G6s6fncfVWNxb91EGTYmffB7qnV0SgGYMwocTRJmoFnmYVRMNayR_VfMqN5OhW4ZreBB7PBk3njMbeOFh9JekL_n5qdt3dmyW1hQTlr1QjXuu-tFzHqZI4t99DJJtEPv-ixeju6snbom7-04yNh0TymlBeoxJpljn34MA6BUMBzjWuFDbwRoryI33O77GRsf1YZTKpqXJDpw8ry-FfluBy-9mL4pUCyJkPe4aBxjN2ojWkwKMtTSZ1LVlS6Ir2E',
  illustrationSlide2: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCjEiOtHTpJ_PpS7Pc1_Wkj-WaErzXcXNh42FOrNwwJM_0ospxtOnLIrQYBNlYTNwRYO983lXWvV__BJFJA8pCim-_5HvNKyI112HQUge3Zf6En5Ryhkhv12EadZuHzDKUxACUXU2eays4N7YXo45oZdpgCUCj1DG1UhLVE2KjmZ5JUMYni43hONgeXKQVcgdS32hPsrhqsJHAKSvyJ3zwKjmhKmNBi3VF9Lbp-3eEd-6i2hxfPKN8cl9WRNrw_ST9owhivaebSlU8',
  illustrationSlide3: '/images/slide3.png',
  illustrationSlide4: '/images/slide4.png',
  avatarGabriel: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCoPslQk9V16K6B0sQ7scwkIb2k8rj_bSAjSv1Q71RhMu3vlCV89cpyLSiCOoWF7W7I5oOQcqw3hUSX3UNbmnIibVdtO6Y12uxotsz0AzDb8hBtJ3kSMVFk2x0tk2cGMp98dvjN_GiKGcaLr9OKIlNhdTy59Nqs_QPdgtv3RjwYpDR6OrRpRBivJfJiD2xTL5kbOpducvxUAXi9zOW-JWdMwugexY_SuF0dV1rcv4_8WrZ30lvKhIh4UwCd82DWKjIpGlLaQnv1Zgs',
  avatarFemale: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDghsNZCuQAc1iKI1HqGdmf2eyA-dXdVETzO7DUVj3tIOeMQAMe5ZUSVilTMj7vZ4LBMPuw1jYdSZkr3ZfO676axjo2AFsipaLbQCcbvtt2OcHCKUF5La3tJJoY4TwXKmzMb4K1YwDe3hJG-9pJ5qVAmOOkAyE4w8Knfvu3V7oKjpX2d3l74-Pst5cKrCOa3IhaSDNGZvLX9QpdvhSdOjUNNzM-gyx3qxnK_00ID0AQcBMpLeC0Benlb0LW74aH_ml780eqZ-nnUlQ',
  companionCardBg: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAQMf076gSvn0W1AEA8RH48QGPC-yxvTYibBKayOp9whm8shYk6bKGy5sFUf1r69SMJll6NAXmC--1e4U0JAnwdITJymOKlkYvShaJ7BSh3Zjrm-gNa50D5eFAdhH6IElOzX3PgezuQ0p3cvYj4y4GYcrCmyNy_ENINs6wcns8VO3o5WuqJ60hvnQs_2-Ob9n9o-QNb_qYN1tEPx3EuUTHImh3jDyfUOUnMQ61cTA-lX7_1KUJ9HyX4ZW5qAAurEop8bl0EG6tXVtI',
  nodesBgDetail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC81HR5FpmvZdir7kRwAX21d5aPv_wEPVrOJhe-Mt0hCuBRAOGcy_9B25UZvNl2rpjs4i2laXOLUDsi0S2quB47Vtbqs07BgVSoeQPq3yktSardSylW5TSVBUFk-CYwy6cpu0ODpaDRAD_y9emMWAoil7nKosDk1PVf8wvmZ5_xb6b6P_Ds9nrulY4Ro1cLHaSSVp2LuzN9pDnUqhjOYdiqhiC0vdeXgfOEfVfRZUNdt54M7sljBEhrgQRo4IpGirIZJFQBIvvEBlg',
  glassBookIllustration: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAX_-d9rrsmD7cFecMMlvd6Cjr0eJ9DO6WZlZZ7vSKp9AdBvSgYaVVP8jJ6-qpaWIWs5c4lubVd0Z1cQwvoJZri9TwwmpuCSXKYCmeYINzNxieELihWdsm86J_AeZPmcaiXKTmnFMxfRVfFoPuVBp9xZZklZPWN0EZUtDNtY1efPOqUmPMUoMn7Myk-JPZMXSb8AfhNT7KMRuysicU9hs1kvYAAuYp_N4_Hn_vs9CxtEOI6E34N-JxsL9TKSpMqtEWy42gqT34A5Zg',
  aiTutorAvatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAni6yNy09b6lrvIR6gR7cZ5wIhKkrsSMltmPEuM2Egi2fofeHQw-ls46dtQxTvmNNDGd5t6J3mNjyLyAPGSrM9cDwse0-Eho46rv_lwH1xrH67fjIJ32yDIGR7JQbSkHoCg9qFBmN0yA3Z35Ey82XS3qpcqwiz2DLHp26CRop6JH8KVIPKPzw6fw4kwnyAHP4JCa_WyIi-VF7jaPmjc-b8wayXwwJsXFd8KsAZvwjJ04nsml-UmoWAnpmGAEYB5bxM8DuYW5EBkOg',
  avatarGabrielVariant: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCz2DZ8K5E_iXClCjUzfbexF8HD7W0Hv0NLb3mUNVAz4-ug0qib5yYX6LNGel7JAN411GmxADgl9AL_Zh1BN4d7BeUmN15q71O3LuZCZVGa7foOXfxSTCazOZjVWSuZfyNGIT-iSWh99tRykpwvgO9_67TUaj2BtA03vvfRq8mda-vgbc0lGeJo1So09H7vXRDSBeRs-euOzjiOkp56jWXTy_EM5pM5eKKnlKwSY_MoNgT-esCnEqNvkvPzLa7B-sKPlovDfujg_C0'
};
