/**
 * Models for the `Appointments/*` endpoints.
 *
 * The numeric enums mirror the backend `AppointmentType` / `AppointmentStatus`
 * / `AppointmentPriority` C# enums verbatim. The list/detail responses also
 * carry pre-localized Arabic labels (`typeNameAr` …) which the UI prefers for
 * display; the option tables below are only used to populate the form selects.
 */

export enum AppointmentType {
  Meeting = 1,
  Demo = 2,
  Call = 3,
  FollowUp = 4,
  Presentation = 5,
  Negotiation = 6,
  ContractSigning = 7,
  Support = 8,
  Other = 9,
}

export enum AppointmentStatus {
  Scheduled = 1,
  Completed = 2,
  Cancelled = 3,
  Postponed = 4,
  NoShow = 5,
}

export enum AppointmentPriority {
  Low = 1,
  Medium = 2,
  High = 3,
  Urgent = 4,
}

/** A selectable enum option with both language labels. */
export interface AppointmentOption<T extends number> {
  code: T;
  ar: string;
  en: string;
}

export const APPOINTMENT_TYPES: ReadonlyArray<
  AppointmentOption<AppointmentType>
> = [
  { code: AppointmentType.Meeting, ar: 'اجتماع', en: 'Meeting' },
  { code: AppointmentType.Demo, ar: 'عرض تجريبي', en: 'Demo' },
  { code: AppointmentType.Call, ar: 'مكالمة', en: 'Call' },
  { code: AppointmentType.FollowUp, ar: 'متابعة', en: 'Follow-up' },
  { code: AppointmentType.Presentation, ar: 'عرض تقديمي', en: 'Presentation' },
  { code: AppointmentType.Negotiation, ar: 'تفاوض', en: 'Negotiation' },
  {
    code: AppointmentType.ContractSigning,
    ar: 'توقيع عقد',
    en: 'Contract signing',
  },
  { code: AppointmentType.Support, ar: 'دعم فني', en: 'Support' },
  { code: AppointmentType.Other, ar: 'أخرى', en: 'Other' },
];

export const APPOINTMENT_STATUSES: ReadonlyArray<
  AppointmentOption<AppointmentStatus>
> = [
  { code: AppointmentStatus.Scheduled, ar: 'مجدول', en: 'Scheduled' },
  { code: AppointmentStatus.Completed, ar: 'مكتمل', en: 'Completed' },
  { code: AppointmentStatus.Cancelled, ar: 'ملغي', en: 'Cancelled' },
  { code: AppointmentStatus.Postponed, ar: 'مؤجل', en: 'Postponed' },
  { code: AppointmentStatus.NoShow, ar: 'لم يحضر', en: 'No-show' },
];

export const APPOINTMENT_PRIORITIES: ReadonlyArray<
  AppointmentOption<AppointmentPriority>
> = [
  { code: AppointmentPriority.Low, ar: 'منخفضة', en: 'Low' },
  { code: AppointmentPriority.Medium, ar: 'متوسطة', en: 'Medium' },
  { code: AppointmentPriority.High, ar: 'عالية', en: 'High' },
  { code: AppointmentPriority.Urgent, ar: 'عاجلة', en: 'Urgent' },
];

/** Body for `POST /Appointments/CreateAppointment` and the update endpoint. */
export interface AppointmentRequest {
  title: string;
  description: string;
  /** ISO date-time. */
  startDate: string;
  /** ISO date-time. */
  endDate: string;
  type: AppointmentType;
  priority: AppointmentPriority;
  assignedToUserId: string;
  location: string;
  meetingLink: string;
  notes: string;
  customerId: number;
}

/**
 * Row returned by `GET /Appointments/GetAppointments` and the full object
 * from `GetAppointmentById` / create / update (same projection).
 */
export interface Appointment {
  id: number;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  /** API returns the enum member name as a string (e.g. "FollowUp"), not a number. */
  type: AppointmentType | string;
  typeNameAr: string;
  /** API returns the enum member name as a string (e.g. "High"), not a number. */
  priority: AppointmentPriority | string;
  priorityNameAr: string;
  /** API returns the enum member name as a string (e.g. "Completed"), not a number. */
  status: AppointmentStatus | string;
  statusNameAr: string;
  location: string | null;
  meetingLink: string | null;
  notes: string | null;
  assignedToId: string;
  assignedToUserName: string;
  customerId: number;
  customerFullName: string;
  createdById: string;
  createdAt: string;
  updatedAt: string | null;
}

/** Query params for `GET /Appointments/GetAppointments`. */
export interface AppointmentListQuery {
  FromDate?: string;
  ToDate?: string;
  AssignedToUserId?: string;
  CustomerId?: number;
  Search?: string;
  PageIndex?: number;
  PageSize?: number;
}

/**
 * Paged envelope of `GET /Appointments/GetAppointments`.
 *
 * This endpoint returns the pagination metadata as *siblings* of `data`
 * (a flat envelope), so the service requests it with `skipUnwrap` and
 * normalizes both the flat and the nested shape into this type.
 */
export interface AppointmentPage {
  totalCount: number;
  pageIndex: number;
  pageSize: number;
  totalPages: number;
  data: Appointment[];
}

/** Payload of `GET /Appointments/GetStats`. */
export interface AppointmentStats {
  total: number;
  upcoming: number;
  confirmed: number;
  today: number;
}

/** Customer option from `GET /Customers/dropdownCustomers`. */
export interface AppointmentCustomerOption {
  id: number;
  fullName: string;
  campanyName: string | null;
}

/** Assignable user (Support / Admin) for the "assigned to" picker. */
export interface AppointmentAssignee {
  userId: string;
  fullName: string;
  email: string;
  role: string | null;
}
