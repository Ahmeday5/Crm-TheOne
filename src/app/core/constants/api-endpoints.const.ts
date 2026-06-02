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
    sales: 'Auth/sales',
    support: 'Auth/support',
    developers: 'Auth/developers',
  },
  users: {
    list: 'Auth/GetAllUsers',
    byId: (id: string) => `Auth/GetUserbyId?userid=${encodeURIComponent(id)}`,
    add: 'Auth/AddApplicationUser',
    update: (id: string) => `Auth/update-user/${encodeURIComponent(id)}`,
    delete: (id: string) => `Auth/delete-user/${encodeURIComponent(id)}`,
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
    stats: 'Appointments/GetStats',
  },
  support: {
    returnToSalesPerson: (customerId: number | string) =>
      `Support/${customerId}/ReturnToSalesPerson`,
    /** KPI strip + status breakdown + weekly-resolved trend for the dashboard. */
    dashboard: 'Support/Dashboard',
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
  /** Developer-team analytics page — summary, per-dev stats, and chart feeds. */
  developerAnalytics: {
    summary: 'DeveloperAnalytics/Summary',
    developerStats: 'DeveloperAnalytics/DeveloperStats',
    charts: 'DeveloperAnalytics/Charts',
    bugAnalytics: 'DeveloperAnalytics/BugAnalytics',
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
  /** Knowledge-base articles — CRUD + category option pickers. */
  articles: {
    list: 'Articles/GetArticles',
    byId: (id: number | string) => `Articles/GetArticleById/${id}`,
    create: 'Articles/CreateArticle',
    update: (id: number | string) => `Articles/UpdateArticle/${id}`,
    delete: (id: number | string) => `Articles/DeleteArticle/${id}`,
    projectOptions: 'Articles/ProjectOptions',
    customerOptions: 'Articles/CustomerOptions',
  },
} as const;
