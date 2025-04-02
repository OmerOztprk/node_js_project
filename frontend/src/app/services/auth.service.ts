import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

// API yanıt tipi için interface tanımı
interface ApiResponse<T> {
  code: number;
  data: T;
  message?: string;
}

// Kullanıcı bilgileri için interface
interface User {
  _id: string;
  name?: string;
  email: string;
  role?: string;
  [key: string]: any;
}

// Kimlik doğrulama yanıtı için interface
interface AuthResponse {
  token: string;
  user: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api'; // Backend API URL
  private tokenKey = 'auth_token';
  private userKey = 'user_data';
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Kullanıcı girişi yapar
   * @param credentials Kullanıcı kimlik bilgileri
   */
  login(credentials: { email: string; password: string }): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${this.apiUrl}/users/auth`, credentials)
      .pipe(
        tap(response => {
          console.log('API Response:', response);
          
          // Response yapısı doğru mu kontrol et
          if (response && response.code === 200 && response.data) {
            const { token, user } = response.data;
            
            if (token && user) {
              this.setToken(token);
              this.setUserData(user);
              this.isAuthenticatedSubject.next(true);
            } else {
              console.error('Token veya user verisi API yanıtında bulunamadı:', response);
            }
          }
        }),
        catchError(error => {
          console.error('Login hatası:', error);
          return throwError(() => new Error(error.error?.message || 'Giriş yapılırken bir hata oluştu'));
        })
      );
  }

  /**
   * Yeni kullanıcı kaydı yapar
   * @param user Yeni kullanıcı bilgileri
   */
  register(user: { name: string; email: string; password: string }): Observable<ApiResponse<User>> {
    return this.http.post<ApiResponse<User>>(`${this.apiUrl}/users/register`, user)
      .pipe(
        catchError(error => {
          console.error('Kayıt hatası:', error);
          return throwError(() => new Error(error.error?.message || 'Kayıt sırasında bir hata oluştu'));
        })
      );
  }

  /**
   * Kullanıcı çıkışı yapar
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    this.isAuthenticatedSubject.next(false);
    this.router.navigate(['/admin/login']);
  }

  /**
   * Kullanıcının kimlik doğrulama durumunu sorgular
   */
  isAuthenticated(): Observable<boolean> {
    return this.isAuthenticatedSubject.asObservable();
  }

  /**
   * Token bilgisini döndürür
   */
  getToken(): string {
    return localStorage.getItem(this.tokenKey) || '';
  }

  /**
   * Token bilgisini localStorage'a kaydeder
   */
  private setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Kullanıcı bilgilerini localStorage'a kaydeder
   */
  private setUserData(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  /**
   * Kullanıcı bilgilerini localStorage'dan alır
   */
  getUserData(): User | null {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Token var mı kontrolü yapar
   */
  private hasToken(): boolean {
    return !!this.getToken();
  }
  
  /**
   * Belirli bir role sahip olup olmadığını kontrol eder
   * @param role Kontrol edilecek rol
   */
  hasRole(role: string): boolean {
    const user = this.getUserData();
    return user ? user.role === role : false;
  }

  /**
   * Kullanıcı profilini günceller
   * @param userData Güncellenecek kullanıcı bilgileri
   */
  updateProfile(userData: Partial<User>): Observable<ApiResponse<User>> {
    return this.http.put<ApiResponse<User>>(`${this.apiUrl}/users/profile`, userData)
      .pipe(
        tap(response => {
          if (response && response.code === 200 && response.data) {
            // LocalStorage'daki kullanıcı bilgilerini güncelle
            const currentUser = this.getUserData();
            const updatedUser = { ...currentUser, ...response.data };
            this.setUserData(updatedUser);
          }
        }),
        catchError(error => {
          console.error('Profil güncelleme hatası:', error);
          return throwError(() => new Error(error.error?.message || 'Profil güncellenirken bir hata oluştu'));
        })
      );
  }
  
  /**
   * Şifre değiştirme
   * @param passwordData Şifre değiştirme verileri
   */
  changePassword(passwordData: { currentPassword: string; newPassword: string }): Observable<ApiResponse<any>> {
    return this.http.post<ApiResponse<any>>(`${this.apiUrl}/users/change-password`, passwordData)
      .pipe(
        catchError(error => {
          console.error('Şifre değiştirme hatası:', error);
          return throwError(() => new Error(error.error?.message || 'Şifre değiştirilirken bir hata oluştu'));
        })
      );
  }
}