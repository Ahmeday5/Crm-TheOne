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
    statistics: 'Campaigns/Statistics-Dashboard',
    byId: (id: number | string) => `Campaigns/${id}/getCampaignById`,
    add: 'Campaigns',
    delete: (id: number | string) => `Campaigns/${id}/deleteCampaign`,
    toggleStatus: (id: number | string) => `Campaigns/${id}/toggle-status`,
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
    byId: (id: number | string) => `Customers/${id}/getCustomerById`,
    create: 'Customers',
    update: (id: number | string) => `Customers/updateCustomer/${id}`,
    delete: (id: number | string) => `Customers/${id}`,
    assign: (id: number | string) => `Customers/${id}/assign`,
    statuses: 'Customers/statuses',
  },
} as const;
