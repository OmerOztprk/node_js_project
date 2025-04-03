import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { ChartsComponent } from './charts/charts.component';

interface AuditLog {
  _id: string;
  email: string;
  level: string;
  location: string;
  proc_type: string;
  created_at: string;
}

interface User {
  _id?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone_number?: string;
  password?: string;
  is_active: boolean;
  roles?: any[];
}

interface Role {
  _id: string;
  role_name: string;
  is_active: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ChartsComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  // Mevcut değişkenler
  userData: any;
  currentSection: string = 'dashboard';
  stats = {
    users: 0,
    categories: 0,
    roles: 0,
    logs: 0
  };
  recentLogs: AuditLog[] = [];
  currentPage: number = 1;
  pageSize: number = 10;
  totalUsers: number = 0;
  totalPages: number = 0;

  // Kullanıcı yönetimi için yeni değişkenler
  users: User[] = [];
  filteredUsers: User[] = [];
  userSearchTerm: string = '';
  availableRoles: Role[] = [];

  // Modal durumları için değişkenler
  showUserModal: boolean = false;
  showDeleteModal: boolean = false;
  isEditMode: boolean = false;
  currentUser: User = this.getEmptyUser();
  selectedRoles: string[] = [];
  userToDelete: User | null = null;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {
    this.userData = this.authService.getUserData();
  }

  ngOnInit(): void {
    this.loadStats();
    this.loadRecentLogs();
    this.loadAllRoles();
  }

  navigateTo(section: string): void {
    this.currentSection = section;

    // Eğer users bölümüne geçildiyse kullanıcıları yükle
    if (section === 'users') {
      this.loadUsers();
    }

    // İstatistikler bölümüne geçildiğinde grafikleri güncelle
    if (section === 'statistics') {
      // İstatistikleri yüklemek için ek işlemler gerekirse burada yapabiliriz
      // Örneğin: this.loadStatisticsData();
    }
  }

  // Dashboard istatistiklerini yükle
  loadStats(): void {
    // Kullanıcı sayısı - API'yi alternatif yolla çağırma
    this.http.get<any>('http://localhost:3000/api/users')
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            // Yeni API formatı: data içinde data ve pagination var
            if (response.data.pagination && typeof response.data.pagination.total === 'number') {
              // Pagination meta bilgisinden toplam kullanıcı sayısını al
              this.stats.users = response.data.pagination.total;
            }
            // Alternatif olarak array uzunluğuna bak
            else if (response.data.data && Array.isArray(response.data.data)) {
              this.stats.users = response.data.data.length;
            }
            // Eski API formatı: data direkt array 
            else if (Array.isArray(response.data)) {
              this.stats.users = response.data.length;
            } else {
              this.stats.users = 0;
            }
          } else {
            this.stats.users = 0;
          }
          console.log('Kullanıcı istatistikleri:', this.stats.users);
        },
        error: (error) => {
          console.error('Kullanıcı istatistikleri yüklenirken hata oluştu:', error);
          this.stats.users = 0;
        }
      });

    // Kategori sayısı - API'yi alternatif yolla çağırma
    this.http.get<any>('http://localhost:3000/api/categories')
      .subscribe({
        next: (response) => {
          if (response && Array.isArray(response.data)) {
            this.stats.categories = response.data.length;
          } else {
            this.stats.categories = 0;
          }
          console.log('Kategori istatistikleri:', this.stats.categories);
        },
        error: (error) => {
          console.error('Kategori istatistikleri yüklenirken hata oluştu:', error);
          this.stats.categories = 0;
        }
      });

    // Rol sayısı - API'yi alternatif yolla çağırma
    this.http.get<any>('http://localhost:3000/api/roles')
      .subscribe({
        next: (response) => {
          if (response && Array.isArray(response.data)) {
            this.stats.roles = response.data.length;
          } else {
            this.stats.roles = 0;
          }
          console.log('Rol istatistikleri:', this.stats.roles);
        },
        error: (error) => {
          console.error('Rol istatistikleri yüklenirken hata oluştu:', error);
          this.stats.roles = 0;
        }
      });

    // Log sayısı - Tüm logları çekerek sayısını al
    this.http.post<any>('http://localhost:3000/api/auditlogs', {
      begin_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
      end_date: new Date().toISOString(),
      limit: 1000
    })
      .subscribe({
        next: (response) => {
          if (response && response.total) {
            this.stats.logs = response.total;
          } else if (response && Array.isArray(response.data)) {
            this.stats.logs = response.data.length;
          } else {
            this.stats.logs = 0;
          }
          console.log('Log istatistikleri:', this.stats.logs);
        },
        error: (error) => {
          console.error('Log istatistikleri yüklenirken hata oluştu:', error);
          this.stats.logs = 0;
        }
      });
  }

  // Son audit logları yükle
  loadRecentLogs(): void {
    const today = new Date();
    const lastWeek = new Date();
    lastWeek.setDate(today.getDate() - 7);

    this.http.post<any>('http://localhost:3000/api/auditlogs', {
      begin_date: lastWeek.toISOString(),
      end_date: today.toISOString(),
      limit: 10,
      skip: 0
    }).subscribe({
      next: (response) => {
        if (response && Array.isArray(response.data)) {
          this.recentLogs = response.data;
        }
      },
      error: (error) => console.error('Log kayıtları yüklenirken hata oluştu:', error)
    });
  }

  // Log seviyesine göre simge getir
  getActivityIcon(level: string): string {
    switch (level?.toLowerCase()) {
      case 'info': return '📝';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      case 'debug': return '🔍';
      default: return '📋';
    }
  }

  // Kullanıcı adının baş harflerini al
  getUserInitials(): string {
    if (!this.userData) return '';

    let initials = '';
    if (this.userData.first_name) {
      initials += this.userData.first_name.charAt(0);
    }
    if (this.userData.last_name) {
      initials += this.userData.last_name.charAt(0);
    }

    return initials.toUpperCase() || (this.userData.email ? this.userData.email.charAt(0).toUpperCase() : '');
  }

  // Bölüm başlığını getir
  getSectionTitle(): string {
    switch (this.currentSection) {
      case 'dashboard': return 'Kontrol Paneli';
      case 'users': return 'Kullanıcı Yönetimi';
      case 'roles': return 'Rol Yönetimi';
      case 'categories': return 'Kategori Yönetimi';
      case 'logs': return 'Log Kayıtları';
      case 'statistics': return 'İstatistikler';
      default: return 'Kontrol Paneli';
    }
  }

  // Çıkış yap
  logout(): void {
    this.authService.logout();
    window.location.href = '/login';
  }

  // Kullanıcı yönetimi metodları
  loadUsers(): void {
    this.http.get<any>(`http://localhost:3000/api/users?page=${this.currentPage}&limit=${this.pageSize}`)
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            if (response.data.data) {
              // Yeni API formatına uygun olarak verileri al
              this.users = response.data.data;
              this.filteredUsers = [...this.users];

              // Sayfalama meta bilgilerini set et
              if (response.data.pagination) {
                this.totalUsers = response.data.pagination.total;
                this.totalPages = response.data.pagination.pages;
              }
            } else {
              // Eski API formatı için geriye dönük uyumluluk
              this.users = response.data;
              this.filteredUsers = [...this.users];
            }
          }
        },
        error: (error) => console.error('Kullanıcılar yüklenirken hata oluştu:', error)
      });
  }
  // Sayfalama işlemleri için yeni metodlar
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages && page !== this.currentPage) {
      this.currentPage = page;
      this.loadUsers();
    }
  }

  previousPage(): void {
    this.goToPage(this.currentPage - 1);
  }

  nextPage(): void {
    this.goToPage(this.currentPage + 1);
  }
  getPageNumberToShow(index: number): number {
    // Başlangıç sayfa numarasını belirle
    let startPage = Math.max(1, this.currentPage - 2);

    // Son sayfaya yaklaşırken düzeltme yap
    if (this.totalPages > 5 && this.currentPage > this.totalPages - 2) {
      startPage = this.totalPages - 4;
    }

    return startPage + index;
  }
  // Component sınıfına ekleyin
  Math = Math; // HTML'de Math fonksiyonlarını kullanabilmek için

  // Pagination için sayfa numaralarını oluşturan metod
  getPaginationArray(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;

    // Gösterilecek sayfa numaralarının başlangıç ve bitiş değerlerini hesapla
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = startPage + maxVisiblePages - 1;

    // Bitiş sayfası toplam sayfa sayısını aşıyorsa düzelt
    if (endPage > this.totalPages) {
      endPage = this.totalPages;
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Sayfa numaralarını oluştur
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return pages;
  }

  loadAllRoles(): void {
    this.http.get<any>('http://localhost:3000/api/roles')
      .subscribe({
        next: (response) => {
          if (response && response.data) {
            this.availableRoles = response.data;
          }
        },
        error: (error) => console.error('Roller yüklenirken hata oluştu:', error)
      });
  }

  // Arama fonksiyonunu da güncellememiz gerekiyor
  filterUsers(): void {
    if (!this.userSearchTerm) {
      this.filteredUsers = [...this.users];
      return;
    }

    const term = this.userSearchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user =>
      user.email.toLowerCase().includes(term) ||
      (user.first_name && user.first_name.toLowerCase().includes(term)) ||
      (user.last_name && user.last_name.toLowerCase().includes(term))
    );
  }

  openUserModal(): void {
    this.isEditMode = false;
    this.currentUser = this.getEmptyUser();
    this.selectedRoles = [];
    this.showUserModal = true;
  }

  editUser(user: User): void {
    this.isEditMode = true;
    // Kullanıcı verisinin derin bir kopyasını oluştur
    this.currentUser = {
      _id: user._id,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone_number: user.phone_number || '',
      is_active: user.is_active
    };

    // Kullanıcının rollerini seç
    this.selectedRoles = user.roles ? user.roles.map(r => r.role_id._id.toString()) : [];
    this.showUserModal = true;

    console.log('Düzenlenecek kullanıcı:', this.currentUser);
    console.log('Seçilen roller:', this.selectedRoles);
  }

  deleteUser(user: User): void {
    this.userToDelete = user;
    this.showDeleteModal = true;
  }

  closeUserModal(): void {
    this.showUserModal = false;
    this.currentUser = this.getEmptyUser();
    this.selectedRoles = [];
  }

  closeDeleteModal(): void {
    this.showDeleteModal = false;
    this.userToDelete = null;
  }

  getEmptyUser(): User {
    return {
      email: '',
      first_name: '',
      last_name: '',
      phone_number: '',
      is_active: true
    };
  }

  isRoleSelected(roleId: string): boolean {
    return this.selectedRoles.includes(roleId);
  }

  toggleRole(roleId: string): void {
    const index = this.selectedRoles.indexOf(roleId);
    if (index > -1) {
      this.selectedRoles.splice(index, 1);
    } else {
      this.selectedRoles.push(roleId);
    }
  }

  saveUser(): void {
    // Veri doğrulama ve temizleme
    if (!this.currentUser.email) {
      alert('E-posta adresi zorunludur');
      return;
    }

    if (!this.isEditMode && (!this.currentUser.password || this.currentUser.password.length < 8)) {
      alert('Şifre en az 8 karakter olmalıdır');
      return;
    }

    if (!this.selectedRoles || this.selectedRoles.length === 0) {
      alert('Lütfen en az bir rol seçin');
      return;
    }

    // Rol listesini kontrol et - güvenli bir diziye kopyala
    const validRoles = this.selectedRoles.filter(role => role && typeof role === 'string' && role.length > 0);

    if (validRoles.length === 0) {
      alert('Geçerli roller seçilmelidir');
      return;
    }

    // Kullanıcı verilerini hazırla
    const userData = {
      ...this.currentUser,
      roles: validRoles // Temizlenmiş rol dizisi
    };

    console.log('Gönderilecek kullanıcı verisi:', userData);

    // API çağrısı yap
    if (this.isEditMode) {
      // Güncelleme işlemi
      this.http.post<any>('http://localhost:3000/api/users/update', userData)
        .subscribe({
          next: (response) => {
            console.log('Kullanıcı güncellendi:', response);
            this.closeUserModal();
            this.loadUsers();
          },
          error: (error) => {
            console.error('Kullanıcı güncellenirken hata oluştu:', error);

            // Hata mesajını anlamlı hale getir
            let errorMessage = 'Bilinmeyen hata';

            if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              // HTML formatındaki hatayı temizle
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = error.error;
              errorMessage = tempDiv.textContent || tempDiv.innerText || error.error;
            }

            alert('Kullanıcı güncellenirken bir hata oluştu: ' + errorMessage);
          }
        });
    } else {
      // Ekleme işlemi
      this.http.post<any>('http://localhost:3000/api/users/add', userData)
        .subscribe({
          next: (response) => {
            console.log('Kullanıcı eklendi:', response);
            this.closeUserModal();
            this.loadUsers();
            this.loadStats();
          },
          error: (error) => {
            console.error('Kullanıcı eklenirken hata oluştu:', error);

            // Hata mesajını anlamlı hale getir
            let errorMessage = 'Bilinmeyen hata';

            if (error.error?.message) {
              errorMessage = error.error.message;
            } else if (typeof error.error === 'string') {
              // HTML formatındaki hatayı temizle
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = error.error;
              errorMessage = tempDiv.textContent || tempDiv.innerText || error.error;
            }

            alert('Kullanıcı eklenirken bir hata oluştu: ' + errorMessage);
          }
        });
    }
  }

  confirmDeleteUser(): void {
    if (!this.userToDelete) return;

    this.http.post<any>('http://localhost:3000/api/users/delete', { _id: this.userToDelete._id })
      .subscribe({
        next: (response) => {
          console.log('Kullanıcı silindi:', response);
          this.closeDeleteModal();
          this.loadUsers();
          this.loadStats(); // İstatistikleri yenile
        },
        error: (error) => {
          console.error('Kullanıcı silinirken hata oluştu:', error);
          alert('Kullanıcı silinirken bir hata oluştu: ' + (error.error?.message || 'Bilinmeyen hata'));
        }
      });
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';

    const date = new Date(dateString);
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}