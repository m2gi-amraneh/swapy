import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { BaseUserProfile } from '../../../core/models/user.model';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule, FormsModule]
})
export class RegisterComponent {
  registerForm: FormGroup;
  isLoading: boolean = false;
  errorMessage: string = '';
  userType: 'client' | 'provider' = 'client';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^(0|\+213)[567][0-9]{8}$/)]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      acceptTerms: [false, [Validators.requiredTrue]]
    }, {
      validators: this.passwordMatchValidator
    });
  }

  passwordMatchValidator(g: FormGroup) {
    return g.get('password')?.value === g.get('confirmPassword')?.value
      ? null : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = '';

      try {
        const { email, password, firstName, lastName, phoneNumber } = this.registerForm.value;
        
        // Mettre à jour le rôle dans le service avant la création
        this.authService.setUserRole(this.userType);
        
        // Préparer les données du profil
        const userProfile: Partial<BaseUserProfile> = {
          email,
          displayName: `${firstName} ${lastName}`,
          role: this.userType,
          phone: phoneNumber
        };
        
        // Si c'est un prestataire, ajouter le nom d'entreprise
        if (this.userType === 'provider') {
          userProfile.businessName = `${firstName} ${lastName}`;
        }
        
        // Créer l'utilisateur avec le profil complet
        const userCredential = await this.authService.createUserWithEmailAndPassword(email, password, userProfile);

        // Rediriger vers la page appropriée selon le rôle
        const route = this.userType === 'provider' ? '/provider/dashboard' : '/home';
        await this.router.navigate([route]);
      } catch (error: any) {
        this.errorMessage = this.getErrorMessage(error.code);
      } finally {
        this.isLoading = false;
      }
    }
  }

  setUserType(type: 'client' | 'provider') {
    this.userType = type;
    this.authService.setUserRole(type);
  }

  private getErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'auth/email-already-in-use':
        return 'Cette adresse email est déjà utilisée.';
      case 'auth/invalid-email':
        return 'Adresse email invalide.';
      case 'auth/operation-not-allowed':
        return 'Cette opération n\'est pas autorisée.';
      case 'auth/weak-password':
        return 'Le mot de passe est trop faible.';
      default:
        return 'Une erreur est survenue lors de l\'inscription.';
    }
  }
}