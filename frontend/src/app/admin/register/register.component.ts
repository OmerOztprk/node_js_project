import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router'; // Import Router
import { FormsModule } from '@angular/forms'; // FormsModule'ü ekleyin

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule], // FormsModule'ü imports dizisine ekleyin
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  name: string = '';
  email: string = '';
  password: string = '';

  constructor(private authService: AuthService, private router: Router) {} // Inject Router

  onRegister() {
    this.authService.register({ name: this.name, email: this.email, password: this.password }).subscribe(
      (response) => {
        console.log('Registration successful:', response);
        alert('Registration successful! Please login.');
        this.router.navigate(['admin/login']); // Redirect to login page
      },
      (error) => {
        console.error('Registration failed:', error);
        alert('Registration failed. Please try again.');
      }
    );
  }
}