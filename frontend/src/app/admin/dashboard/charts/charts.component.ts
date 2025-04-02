import { Component, OnInit, AfterViewInit } from '@angular/core';
import { Chart, registerables } from 'chart.js';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface MonthlyStats {
  month: string;
  count: number;
}

interface RoleStats {
  name: string;
  count: number;
}

interface StatusStats {
  status: string;
  count: number;
}

interface OperationStats {
  type: string;
  count: number;
}

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.css']
})
export class ChartsComponent implements OnInit, AfterViewInit {
  private usersChart: Chart | null = null;
  private rolesChart: Chart | null = null;
  private operationsChart: Chart | null = null;
  private statusChart: Chart | null = null;
  
  private monthlyData: MonthlyStats[] = [];
  private roleData: RoleStats[] = [];
  private operationData: OperationStats[] = [];
  private statusData: StatusStats[] = [];
  
  constructor(private http: HttpClient) {
    Chart.register(...registerables);
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  ngAfterViewInit(): void {
    // DOM yüklendikten sonra bekletme
    setTimeout(() => {
      this.createAllCharts();
    }, 300);
  }

  loadAllData(): void {
    this.loadMonthlyStats();
    this.loadRoleDistribution();
    this.loadOperationStats();
    this.loadStatusStats();
  }

  createAllCharts(): void {
    this.createUsersChart();
    this.createRolesChart();
    this.createOperationsChart();
    this.createStatusChart();
  }

  // Kullanıcı istatistikleri
  loadMonthlyStats(): void {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 5);
    
    this.http.post<any>('http://localhost:3000/api/stats/users/monthly', {
      begin_date: startDate.toISOString(),
      end_date: endDate.toISOString()
    }).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.monthlyData = this.processMonthlyData(response.data);
          this.createUsersChart();
        }
      },
      error: (error) => {
        console.error('Aylık istatistikler yüklenirken hata oluştu:', error);
        this.monthlyData = this.createDummyMonthlyData();
        this.createUsersChart();
      }
    });
  }

  // Rol dağılımı
  loadRoleDistribution(): void {
    this.http.get<any>('http://localhost:3000/api/roles').subscribe({
      next: (rolesResponse) => {
        if (rolesResponse && rolesResponse.data) {
          const roles = rolesResponse.data;
          
          this.http.get<any>('http://localhost:3000/api/users').subscribe({
            next: (usersResponse) => {
              if (usersResponse && usersResponse.data) {
                const users = usersResponse.data;
                this.roleData = this.processRoleData(roles, users);
                this.createRolesChart();
              }
            },
            error: (error) => {
              console.error('Kullanıcı verileri yüklenirken hata oluştu:', error);
              this.roleData = this.createDummyRoleData();
              this.createRolesChart();
            }
          });
        }
      },
      error: (error) => {
        console.error('Rol verileri yüklenirken hata oluştu:', error);
        this.roleData = this.createDummyRoleData();
        this.createRolesChart();
      }
    });
  }

  // İşlem türleri istatistikleri
  loadOperationStats(): void {
    this.http.post<any>('http://localhost:3000/api/auditlogs', {
      begin_date: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString(),
      end_date: new Date().toISOString()
    }).subscribe({
      next: (response) => {
        if (response && response.data) {
          this.operationData = this.processOperationData(response.data);
          this.createOperationsChart();
        }
      },
      error: (error) => {
        console.error('İşlem istatistikleri yüklenirken hata oluştu:', error);
        this.operationData = this.createDummyOperationData();
        this.createOperationsChart();
      }
    });
  }

  // Aktif/Pasif kullanıcı oranları
  loadStatusStats(): void {
    this.http.get<any>('http://localhost:3000/api/users').subscribe({
      next: (response) => {
        if (response && response.data) {
          this.statusData = this.processStatusData(response.data);
          this.createStatusChart();
        }
      },
      error: (error) => {
        console.error('Kullanıcı durum istatistikleri yüklenirken hata oluştu:', error);
        this.statusData = this.createDummyStatusData();
        this.createStatusChart();
      }
    });
  }

  // Veri işleme fonksiyonları
  processMonthlyData(data: any[]): MonthlyStats[] {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
                 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
                 
    if (!data || data.length === 0) {
      return this.createDummyMonthlyData();
    }
    
    return data.map(item => ({
      month: months[new Date(item.month).getMonth()],
      count: item.count
    }));
  }

  processRoleData(roles: any[], users: any[]): RoleStats[] {
    const roleCounts: {[key: string]: number} = {};
    
    // Tüm rolleri başlat
    roles.forEach(role => {
      roleCounts[role.role_name] = 0;
    });
    
    // Her kullanıcının rollerini say
    users.forEach(user => {
      if (user.roles && Array.isArray(user.roles)) {
        user.roles.forEach((userRole: { role_id: { role_name: string } }) => {
          const roleName: string = userRole.role_id.role_name;
          roleCounts[roleName] = (roleCounts[roleName] || 0) + 1;
        });
      }
    });
    
    // İşlenmiş veriyi oluştur
    return Object.entries(roleCounts).map(([name, count]) => ({
      name, count
    }));
  }

  processOperationData(logs: any[]): OperationStats[] {
    if (!logs || logs.length === 0) {
      return this.createDummyOperationData();
    }
    
    const operationCounts: {[key: string]: number} = {};
    
    logs.forEach(log => {
      const type = log.proc_type || 'Diğer';
      operationCounts[type] = (operationCounts[type] || 0) + 1;
    });
    
    return Object.entries(operationCounts).map(([type, count]) => ({
      type, count
    }));
  }

  processStatusData(users: any[]): StatusStats[] {
    if (!users || users.length === 0) {
      return this.createDummyStatusData();
    }
    
    const activeCount = users.filter(user => user.is_active).length;
    const inactiveCount = users.length - activeCount;
    
    return [
      { status: 'Aktif', count: activeCount },
      { status: 'Pasif', count: inactiveCount }
    ];
  }

  // Örnek veri oluşturucular
  createDummyMonthlyData(): MonthlyStats[] {
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran'];
    return months.map(month => ({
      month,
      count: Math.floor(Math.random() * 30) + 5
    }));
  }

  createDummyRoleData(): RoleStats[] {
    return [
      { name: 'Admin', count: 3 },
      { name: 'Editör', count: 8 },
      { name: 'Kullanıcı', count: 25 },
      { name: 'Ziyaretçi', count: 12 }
    ];
  }

  createDummyOperationData(): OperationStats[] {
    return [
      { type: 'Add', count: 35 },
      { type: 'Update', count: 22 },
      { type: 'Delete', count: 8 },
      { type: 'Login', count: 48 },
      { type: 'Logout', count: 15 }
    ];
  }

  createDummyStatusData(): StatusStats[] {
    return [
      { status: 'Aktif', count: 42 },
      { status: 'Pasif', count: 15 }
    ];
  }

  // Grafik oluşturucular
  createUsersChart(): void {
    const canvas = document.getElementById('usersChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (this.usersChart) {
      this.usersChart.destroy();
    }
    
    const labels = this.monthlyData.map(item => item.month);
    const data = this.monthlyData.map(item => item.count);
    
    this.usersChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Aylık Kayıt Olan Kullanıcı Sayısı',
          data: data,
          backgroundColor: 'rgba(54, 162, 235, 0.5)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  createRolesChart(): void {
    const canvas = document.getElementById('rolesChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (this.rolesChart) {
      this.rolesChart.destroy();
    }
    
    const labels = this.roleData.map(item => item.name);
    const data = this.roleData.map(item => item.count);
    
    const backgroundColors = [
      'rgba(255, 99, 132, 0.7)',
      'rgba(54, 162, 235, 0.7)',
      'rgba(255, 206, 86, 0.7)',
      'rgba(75, 192, 192, 0.7)',
      'rgba(153, 102, 255, 0.7)',
      'rgba(255, 159, 64, 0.7)'
    ];
    
    this.rolesChart = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true
      }
    });
  }

  createOperationsChart(): void {
    const canvas = document.getElementById('operationsChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (this.operationsChart) {
      this.operationsChart.destroy();
    }
    
    const labels = this.operationData.map(item => item.type);
    const data = this.operationData.map(item => item.count);
    
    this.operationsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'İşlem Sayısı',
          data: data,
          backgroundColor: 'rgba(255, 159, 64, 0.5)',
          borderColor: 'rgba(255, 159, 64, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0
            }
          }
        }
      }
    });
  }

  createStatusChart(): void {
    const canvas = document.getElementById('statusChart') as HTMLCanvasElement;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (this.statusChart) {
      this.statusChart.destroy();
    }
    
    const labels = this.statusData.map(item => item.status);
    const data = this.statusData.map(item => item.count);
    
    this.statusChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 99, 132, 0.7)'
          ],
          borderWidth: 1
        }]
      },
      options: {
        responsive: true
      }
    });
  }
}