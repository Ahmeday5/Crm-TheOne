/** Row returned by `GET /Services` and `GET /Services/{id}`. */
export interface AppService {
  id: number;
  nameAr: string;
  nameEn: string;
}

/** Body for `POST /Services` (also reused for `PUT /Services/{id}`). */
export interface UpsertServiceRequest {
  nameAr: string;
  nameEn: string;
}
