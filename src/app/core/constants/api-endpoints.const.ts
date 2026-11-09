/**
 * Single source of truth for backend endpoints.
 * Paths are relative to `environment.apiUrl` — `ApiService` strips/adds the
 * leading slash so both forms work.
 */
export const API_ENDPOINTS = {
  auth: {
    login: 'Auth/login',
    refresh: 'Auth/refresh-token',
    logout: 'Auth/logout',
    me: 'Auth/me',
    /** PUT (multipart `image`) uploads/replaces, DELETE removes — any signed-in user. */
    profileImage: 'Auth/profile-image',
    sales: 'Auth/sales',
    support: 'Auth/support',
    developers: 'Auth/developers',
    admins: 'Auth/admins',
  },
  users: {
    list: 'Auth/GetAllUsers',
    byId: (id: string) => `Auth/GetUserbyId?userid=${encodeURIComponent(id)}`,
    add: 'Auth/AddApplicationUser',
    update: (id: string) => `Auth/update-user/${encodeURIComponent(id)}`,
    delete: (id: string) => `Auth/delete-user/${encodeURIComponent(id)}`,
    /** Available role names for the role pickers (`["Marketing","Sales",…]`). */
    roles: 'Auth/roles',
  },
  campaigns: {
    list: 'Campaigns/GetAllCampaigns',
    dropdown: 'Campaigns/dropdown',
    dropdownCountries: 'Campaigns/dropdownCountries',
    statistics: 'Campaigns/StatisticsDashboard',
    performance: 'Campaigns/CampaignPerformance',
    byId: (id: number | string) => `Campaigns/${id}/getCampaignById`,
    add: 'Campaigns/CreateCampaign',
    update: (id: number | string) => `Campaigns/UpdateCampaign/${id}`,
    delete: (id: number | string) => `Campaigns/${id}/deleteCampaign`,
    toggleStatus: (id: number | string) => `Campaigns/${id}/toggleStatus`,
  },
  reports: {
    list: 'Reports',
    myReports: 'Reports/myreports',
    byId: (id: number | string) => `Reports/${id}`,
    create: 'Reports',
    update: (id: number | string) => `Reports/${id}`,
    delete: (id: number | string) => `Reports/${id}`,
  },
  channelSources: {
    list: 'ChannelSources',
    add: 'ChannelSources',
  },
  services: {
    list: 'Services',
    byId: (id: number | string) => `Services/${id}`,
    add: 'Services',
    update: (id: number | string) => `Services/${id}`,
    delete: (id: number | string) => `Services/${id}`,
  },
  customers: {
    list: 'Customers/getLeadCustomer',
    salesCustomers: 'Customers/getSalesCustomers',
    supportCustomers: 'Customers/getSupportCustomers',
    byId: (id: number | string) => `Customers/${id}/getCustomerById`,
    create: 'Customers/CreateCustomer',
    update: (id: number | string) => `Customers/updateCustomer/${id}`,
    delete: (id: number | string) => `Customers/${id}`,
    assign: (id: number | string) => `Customers/${id}/assign`,
    assignSupport: (id: number | string) => `Customers/${id}/AssignToSupportPerson`,
    changeStatus: (id: number | string) => `Customers/${id}/status`,
    followUp: (id: number | string) => `Customers/${id}/followUp`,
    statuses: 'Customers/statuses',
    /** Log a contact attempt (call result + optional notes) for this customer. */
    contact: (id: number | string) => `Customers/${id}/contact`,
    /** Customer picker for price quotations — each item carries its services. */
    dropdown: 'Customers/dropdownCustomers',
  },
  customerNotes: {
    /**
     * Upserts the note slot for the caller's role (Marketing / Sales / Support).
     * Backend rejects (400) when the caller isn't the current assignee.
     */
    myNote: (customerId: number | string) =>
      `CustomerNotes/customer/${customerId}/myNote`,
  },
  priceQuotations: {
    list: 'PriceQuotations',
    byId: (id: number | string) => `PriceQuotations/${id}`,
    add: 'PriceQuotations',
    update: (id: number | string) => `PriceQuotations/${id}`,
    delete: (id: number | string) => `PriceQuotations/${id}`,
  },
  contracts: {
    list: 'Contracts/GetContracts',
    byId: (id: number | string) => `Contracts/GetContractById/${id}`,
    create: 'Contracts/CreateContract',
    update: (id: number | string) => `Contracts/UpdateContract/${id}`,
    delete: (id: number | string) => `Contracts/DeleteContract/${id}`,
    statistics: 'Contracts/ContractStatistics',
  },
  appointments: {
    list: 'Appointments/GetAppointments',
    byId: (id: number | string) => `Appointments/GetAppointmentById/${id}`,
    create: 'Appointments/CreateAppointment',
    update: (id: number | string) => `Appointments/UpdateAppointment/${id}`,
    delete: (id: number | string) => `Appointments/DeleteAppointment/${id}`,
    changeStatus: (id: number | string) => `Appointments/${id}/status`,
    stats: 'Appointments/GetStats',
  },
  support: {
    returnToSalesPerson: (customerId: number | string) =>
      `Support/${customerId}/ReturnToSalesPerson`,
    /** KPI strip + status breakdown + weekly-resolved trend for the dashboard. */
    dashboard: 'Support/Dashboard',
    /** Live KPI counts for the designated-clients page. */
    customerStats: 'Support/CustomerStats',
  },
  supportTickets: {
    list: 'SupportTickets/GetTickets',
    byId: (id: number | string) => `SupportTickets/GetTicketById/${id}`,
    create: 'SupportTickets/CreateTicket',
    update: (id: number | string) => `SupportTickets/UpdateTicket/${id}`,
    delete: (id: number | string) => `SupportTickets/DeleteTicket/${id}`,
    statistics: 'SupportTickets/TicketStatistics',
    statuses: 'SupportTickets/TicketStatuses',
    priorities: 'SupportTickets/TicketPriorities',
    customerServices: (customerId: number | string) => `SupportTickets/CustomerServices/${customerId}`,
  },
  marketing: {
    statistics: 'Marketing/DashboardsStatistics',
    sourcePerformance: 'Marketing/SourcePerformance',
    last7Days: 'Marketing/potentialCustomersLastdays',
    salesStatistics: 'Marketing/statistics',
  },
  /** Admin-facing project management — full CRUD across every project. */
  managerProjects: {
    list: 'ManagerProjects/GetProjects',
    active: 'ManagerProjects/GetActiveProjects',
    byId: (id: number | string) => `ManagerProjects/GetProjectById/${id}`,
    create: 'ManagerProjects/CreateProject',
    update: (id: number | string) => `ManagerProjects/UpdateProject/${id}`,
    delete: (id: number | string) => `ManagerProjects/DeleteProject/${id}`,
  },
  /** Developer-facing, read-only view scoped to the signed-in developer. */
  developerProjects: {
    myProjects: 'DeveloperProjects/GetMyProjects',
    myActive: 'DeveloperProjects/GetMyActiveProjects',
    myById: (id: number | string) => `DeveloperProjects/GetMyProjectById/${id}`,
  },
  /** Admin-facing task management — full CRUD + board statistics + control panel. */
  managerTasks: {
    list: 'ManagerTasks/GetTasks',
    byId: (id: number | string) => `ManagerTasks/GetTaskById/${id}`,
    create: 'ManagerTasks/CreateTask',
    update: (id: number | string) => `ManagerTasks/UpdateTask/${id}`,
    delete: (id: number | string) => `ManagerTasks/DeleteTask/${id}`,
    statistics: 'ManagerTasks/GetStatistics',
    controlPanel: 'ManagerTasks/GetControlPanel',
  },
  /** Developer-team analytics page — single unified endpoint. */
  developerAnalytics: {
    all: 'DeveloperAnalytics',
    /** Project picker for the analytics filters — admin may pass `developerId` to scope it. */
    projectOptions: 'DeveloperAnalytics/ProjectOptions',
  },
  /** Developer-facing tasks — read-only scope + status/hours updates only. */
  developerTasks: {
    myTasks: 'DeveloperTasks/GetMyTasks',
    myById: (id: number | string) => `DeveloperTasks/GetMyTaskById/${id}`,
    updateMyStatus: (id: number | string) =>
      `DeveloperTasks/UpdateMyTaskStatus/${id}`,
    statistics: 'DeveloperTasks/GetMyStatistics',
    controlPanel: 'DeveloperTasks/GetMyControlPanel',
  },
  sales: {
    dashboardStatistics: 'Sales/SalesDashboardStatistics',
    customerStatusCount: 'Sales/SalesCustomerStatusCount',
    notBuyingReasons: 'Sales/NotBuyingReasons',
    /** Kanban board — stats + one column per customer status. */
    pipeline: 'Sales/Pipeline',
  },
  /** Resource-management board — team workload + per-developer distribution. */
  resourceManagement: {
    teamWorkload: 'ResourceManagement/TeamWorkload',
    workloadDistribution: 'ResourceManagement/WorkloadDistribution',
  },
  /** White-label company settings — branding, contact info, default currency. */
  companySettings: {
    get: 'CompanySettings',
    update: 'CompanySettings/Update',
  },
  /** Admin/manager landing dashboard — aggregate KPIs, revenue + buyers trends. */
  adminDashboard: {
    get: 'AdminDashboard',
  },
  /** Goals & motivation — Admin CRUD + employee progress tracking. */
  goals: {
    list: 'Goals',
    my: 'Goals/my',
    byId: (id: number | string) => `Goals/${id}`,
    create: 'Goals',
    update: (id: number | string) => `Goals/${id}`,
    delete: (id: number | string) => `Goals/${id}`,
    /** Aggregate stats — admin sees all, employee sees own. */
    stats: 'Goals/stats',
    /** PATCH (Sales, multipart): log an amount — `Value`, `Details`, optional `attachment`. */
    progress: (id: number | string) => `Goals/${id}/progress`,
    /** PUT (Admin, multipart) edits / DELETE (Admin) removes one logged amount — `entryId` is a `progressEntries[].id`. */
    progressEntry: (entryId: number | string) => `Goals/progress-entries/${entryId}`,
    /** GET: per-goal stats (full goal object — same shape as byId). */
    goalStats: (id: number | string) => `Goals/${id}/stats`,
    /** GET: ranked leaderboard by points/reward — filterable by type, date range, user. */
    leaderboard: 'Goals/Leaderboard',
    /** GET: the caller's own currently-active goal(s) — auto-removed server-side once the goal's end date passes. */
    active: 'Goals/active',
  },
  /** Per-user notification center + bell badge + FCM push registration. */
  /**
   * Announcements board + sticky banner (`docs/api/announcements.md`).
   * Live updates arrive on the shared `/hubs/app` SignalR hub.
   */
  announcements: {
    /** GET `?includeExpired=&search=` — scoped to the caller; Admin also gets read stats. */
    list: 'Announcements',
    /** GET: live today for the caller (banner), pinned first. */
    active: 'Announcements/Active',
    create: 'Announcements',
    update: (id: number) => `Announcements/${id}`,
    delete: (id: number) => `Announcements/${id}`,
    /** POST: mark read for the caller. */
    read: (id: number) => `Announcements/${id}/Read`,
    /** GET (Admin): `[{ userId, fullName, hasRead, readAt }]`. */
    readers: (id: number) => `Announcements/${id}/Readers`,
  },
  /**
   * Sales playbook (`/sales-playbook`). Reads are open to every role; content
   * writes are Admin-only; competitor mentions are Admin / Sales / Support.
   * Mention endpoints answer 401 "Unauthorized access." for a customer the
   * caller doesn't own — a permission error, not an expired session.
   */
  salesPlaybook: {
    /** GET `?serviceId=&search=` → `CallScriptDto[]` (not paged). POST (Admin). */
    scripts: 'SalesPlaybook/CallScripts',
    script: (id: number | string) => `SalesPlaybook/CallScripts/${id}`,
    /** GET `?pageIndex=&pageSize=(≤100)&search=&category=` → paged. POST (Admin). */
    objections: 'SalesPlaybook/Objections',
    objection: (id: number | string) => `SalesPlaybook/Objections/${id}`,
    /** GET → `[{ category, count }]`. */
    objectionCategories: 'SalesPlaybook/Objections/Categories',
    /** GET `?search=` → `CompetitorDto[]` with `mentions = null`. POST (Admin). */
    competitors: 'SalesPlaybook/Competitors',
    /** GET → the competitor with its `mentions`. PUT / DELETE (Admin). */
    competitor: (id: number | string) => `SalesPlaybook/Competitors/${id}`,
    /** POST `{ customerId, note }` — upserts the customer's mention. */
    competitorMentions: (id: number | string) => `SalesPlaybook/Competitors/${id}/Mentions`,
    mention: (mentionId: number | string) => `SalesPlaybook/Mentions/${mentionId}`,
    /** GET → `CompetitorMentionDto[]` for one customer. */
    customerCompetitors: (customerId: number) => `SalesPlaybook/Customers/${customerId}/Competitors`,
    /** GET `?search=&category=&serviceId=` → `QuickReplyDto[]` (not paged). POST (Admin). */
    quickReplies: 'SalesPlaybook/QuickReplies',
    quickReply: (id: number | string) => `SalesPlaybook/QuickReplies/${id}`,
    /** GET `?customerId=` → `{ id, text }` with placeholders filled server-side. */
    renderQuickReply: (id: number | string) => `SalesPlaybook/QuickReplies/${id}/Render`,
    /** POST (Admin), no body — idempotent. */
    loadDefaultContent: 'SalesPlaybook/LoadDefaultContent',
  },
  /** Attendance & leave (`docs/api/attendance.md`). Times are Cairo wall-clock. */
  attendance: {
    today: 'Attendance/Today',
    checkIn: 'Attendance/CheckIn',
    checkOut: 'Attendance/CheckOut',
    /** GET `?year=&month=` — the caller's month. */
    my: 'Attendance/My',
    /** GET (Admin): who checked in / out today. */
    todayAll: 'Attendance/TodayAll',
    /** GET (Admin) `?year=&month=&userId=` — one month summary per employee. */
    monthly: 'Attendance/Monthly',
    /** POST: request leave. GET (Admin) `?status=&userId=&year=`: every request. */
    leaves: 'Attendance/Leaves',
    /** GET `?year=` — the caller's requests. */
    myLeaves: 'Attendance/Leaves/My',
    /** DELETE: cancel the caller's pending request. */
    leave: (id: number) => `Attendance/Leaves/${id}`,
    /** PUT (Admin): `{ approve, note }`. */
    reviewLeave: (id: number) => `Attendance/Leaves/${id}/Review`,
  },
  /** SignalR hubs (mapped at the API origin, not under `/api`). */
  realtime: {
    appHub: 'hubs/app',
  },
  notifications: {
    list: 'Notifications',
    unreadCount: 'Notifications/unread-count',
    markRead: (id: number | string) => `Notifications/${id}/read`,
    markAllRead: 'Notifications/read-all',
    generateFollowupReminders: 'Notifications/generate-followup-reminders',
    send: 'Notifications/send',
    /** Register this device's Firebase Cloud Messaging token for push. */
    registerFcmToken: 'Notifications/register-fcm-token',
    /** Remove this device's FCM token (on logout). */
    removeFcmToken: 'Notifications/fcm-token',
  },
  /**
   * In-CRM WhatsApp (Wavex behind the backend — the browser never talks to
   * Wavex). Scoped server-side: Admin sees every number, employees only their
   * own; a 401 with "Unauthorized access." means "not allowed", not logout.
   * Live updates arrive on the `/hubs/whatsapp` SignalR hub.
   */
  whatsapp: {
    /** GET the caller's own number, live from the provider. */
    status: 'WhatsApp/status',
    /** GET channels — Admin: every number; employee: own only (0 or 1). */
    instances: 'WhatsApp/instances',
    /** GET one channel with its live status. */
    instance: (instanceId: string) => `WhatsApp/instances/${encodeURIComponent(instanceId)}`,
    /** POST `{ phone, instanceId? }` → a pairing code to type on the phone. */
    connect: 'WhatsApp/instances/connect',
    /** PUT (Admin) `{ instanceId }` assigns, `{ instanceId: null }` unassigns. */
    userNumber: (userId: string) => `WhatsApp/users/${encodeURIComponent(userId)}/number`,
    /** GET paged, newest first — `pageIndex`, `pageSize`, `search?`, `instanceId?`, `unreadOnly?`. */
    chats: 'WhatsApp/chats',
    /** GET oldest → newest — `take` (≤ 200), `beforeId?`. */
    chatMessages: (chatId: number | string) => `WhatsApp/chats/${chatId}/messages`,
    /** POST — resets the CRM unread counter (no blue ticks to the customer). */
    markChatRead: (chatId: number | string) => `WhatsApp/chats/${chatId}/read`,
    /** GET oldest → newest — `take`. */
    customerMessages: (customerId: number | string) =>
      `WhatsApp/customers/${customerId}/messages`,
    /** POST JSON `{ chatId | customerId | phone, instanceId?, clientMessageId, text }`. */
    send: 'WhatsApp/send',
    /** POST multipart — `file` + the same fields + `caption?` (≤ 3.5 MB). */
    sendMedia: 'WhatsApp/send-media',
    /** GET (Admin) configuration, provider account vs. local numbers, webhook queue health. */
    diagnostics: 'WhatsApp/diagnostics',
    /** SignalR hub — relative to the API origin (without `/api`). */
    hub: 'hubs/whatsapp',
  },
  /** Knowledge-base articles — CRUD + category option pickers. */
  articles: {
    list: 'Articles/GetArticles',
    byId: (id: number | string) => `Articles/GetArticleById/${id}`,
    create: 'Articles/CreateArticle',
    update: (id: number | string) => `Articles/UpdateArticle/${id}`,
    delete: (id: number | string) => `Articles/DeleteArticle/${id}`,
    deleteAttachment: (id: number | string) => `Articles/DeleteAttachment/${id}`,
    projectOptions: 'Articles/ProjectOptions',
    customerOptions: 'Articles/CustomerOptions',
  },
  /** Per-project team responsibility split, earned progress + daily reports. */
  projectProgress: {
    team: (projectId: number | string) => `ProjectProgress/${projectId}/team`,
    summary: (projectId: number | string) => `ProjectProgress/${projectId}/summary`,
    myProgress: (projectId: number | string) => `ProjectProgress/${projectId}/my-progress`,
    adjust: (projectId: number | string, developerId: string) =>
      `ProjectProgress/${projectId}/developers/${developerId}/adjust`,
    history: (projectId: number | string) => `ProjectProgress/${projectId}/history`,
    reports: {
      create: 'ProjectProgress/reports',
      byId: (reportId: number | string) => `ProjectProgress/reports/${reportId}`,
      update: (reportId: number | string) => `ProjectProgress/reports/${reportId}`,
      byProject: (projectId: number | string) => `ProjectProgress/${projectId}/reports`,
      my: 'ProjectProgress/my-reports',
    },
  },
} as const;
