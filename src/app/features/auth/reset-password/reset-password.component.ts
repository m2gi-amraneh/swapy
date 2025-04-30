import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { IonicModule, ToastController } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class ResetPasswordComponent implements OnInit {
  resetForm!: FormGroup;
  isLoading = false;
  emailSent = false;

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.resetForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async resetPassword() {
    if (this.resetForm.invalid) {
      return;
    }

    this.isLoading = true;
    const email = this.resetForm.get('email')?.value;

    try {
      await this.authService.resetPassword(email);
      this.emailSent = true;
      this.showToast('Un email de réinitialisation a été envoyé à votre adresse email.');
    } catch (error: any) {
      let errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Aucun compte n\'est associé à cette adresse email.';
      }
      this.showToast(errorMessage, 'danger');
    } finally {
      this.isLoading = false;
    }
  }

  async showToast(message: string, color: string = 'success') {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
