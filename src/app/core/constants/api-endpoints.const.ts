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
  marketing: {
    statistics: 'Marketing/DashboardsStatistics',
    sourcePerformance: 'Marketing/SourcePerformance',
    last7Days: 'Marketing/potentialCustomersLastdays',
    salesStatistics: 'Marketing/statistics',
  },
  sales: {
    /** KPI strip for the sales dashboard. */
    dashboardStatistics: 'Sales/SalesDashboardStatistics',
    /** Per-status customer counts for the pipeline chart. */
    customerStatusCount: 'Sales/SalesCustomerStatusCount',
    /** Free-text reasons given when a sales rep marks a customer as NotBuyer. */
    notBuyingReasons: 'Sales/NotBuyingReasons',
  },
} as const;
