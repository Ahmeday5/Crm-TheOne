import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private baseUrl = 'http://.runasp.net';  // الـ URL بتاع الباك

  constructor(private http: HttpClient) {}

  // مثال لـ POST (زي login أو add lead)
  post(endpoint: string, body: any): Observable<any> {
    const headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    return this.http.post(`${this.baseUrl}/${endpoint}`, body, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  // مثال لـ GET (زي get leads)
  get(endpoint: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/${endpoint}`).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('API Error:', error);
    return throwError(() => 'حدث خطأ في السيرفر؛ حاول مرة أخرى.');
  }
}
