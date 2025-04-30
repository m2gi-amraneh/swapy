import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule]
})
export class LoginComponent {
  loginForm: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';
  userType: 'client' | 'provider' = 'client';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private userService: UserService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async onSubmit() {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const { email, password } = this.loginForm.value;
        await this.authService.signInWithEmailAndPassword(email, password);
        
        // Use the observable to get the current user role
        this.authService.getCurrentUserRole()
          .pipe(
            finalize(() => this.isLoading = false)
          )
          .subscribe(role => {
            const route = role === 'provider' ? '/provider/dashboard' : '/home';
            this.router.navigate([route]);
          });
      } catch (error: any) {
        this.isLoading = false;
        this.errorMessage = this.getErrorMessage(error.code);
      }
    }
  }

  async loginWithGoogle() {
    try {
      this.isLoading = true;
      this.errorMessage = '';
      
      // Set the user role before authentication
      this.authService.setUserRole(this.userType);
      
      const credential = await this.authService.signInWithGoogle();
      
      // Use the observable to get the current user role
      this.authService.getCurrentUserRole()
        .pipe(
          finalize(() => this.isLoading = false)
        )
        .subscribe(role => {
          const route = role === 'provider' ? '/provider/dashboard' : '/home';
          this.router.navigate([route]);
        });
    } catch (error: any) {
      this.isLoading = false;
      this.errorMessage = this.getErrorMessage(error.code);
    }
  }

  async resetPassword() {
    const email = this.loginForm.get('email')?.value;
    if (email) {
      this.isLoading = true;
      try {
        await this.authService.resetPassword(email);
        this.errorMessage = 'Password reset email sent. Please check your inbox.';
      } catch (error: any) {
        this.errorMessage = this.getErrorMessage(error.code);
      } finally {
        this.isLoading = false;
      }
    } else {
      this.errorMessage = 'Please enter your email address to reset your password.';
    }
  }

  setUserType(type: 'client' | 'provider') {
    this.userType = type;
    this.authService.setUserRole(type);
  }

  private getErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'No user found with this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-email': 'Invalid email address.',
      'auth/user-disabled': 'This account has been disabled.',
      'auth/popup-closed-by-user': 'Login popup was closed before completing.',
      'auth/cancelled-popup-request': 'Login request was cancelled.',
      'auth/popup-blocked': 'Login popup was blocked by the browser.',
      'auth/too-many-requests': 'Too many attempts. Please try again later.',
      'auth/email-already-in-use': 'Email already in use.',
      'auth/weak-password': 'Password is too weak.',
      'auth/operation-not-allowed': 'This operation is not allowed.'
    };

    return errorMessages[errorCode] || 'An error occurred during login.';
  }
}