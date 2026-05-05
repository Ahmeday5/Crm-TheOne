import { UserRole } from './auth.model';

/** Row returned by `GET /Auth/GetAllUsers` and `GET /Auth/GetUserbyId`. */
export interface AppUser {
  userId: string;
  email: string;
  phone: string | null;
  fullName: string | null;
}

/** Body for `POST /Auth/AddApplicationUser`. */
export interface AddUserRequest {
  fullName: string;
  address: string;
  password: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
}

/** Body for `PUT /Auth/update-user/{id}`. */
export interface UpdateUserRequest {
  email: string;
  phone: string;
  fullName: string;
}
