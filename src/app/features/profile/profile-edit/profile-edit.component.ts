import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';

import { UserService } from '../../../core/services/user.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { UserProfile } from '../../../core/models/user.model';

@Component({
  selector: 'app-profile-edit',
  templateUrl: './profile-edit.component.html',
  styleUrls: ['./profile-edit.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    ReactiveFormsModule
  ]
})
export class ProfileEditComponent implements OnInit {
  profileForm!: FormGroup;
  user$!: Observable<UserProfile | null>;
  isLoading: boolean = true;
  isSaving: boolean = false;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private toastService: ToastService,
    private router: Router
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadUserData();
  }

  initForm() {
    this.profileForm = this.fb.group({
      displayName: ['', [Validators.required]],
      phoneNumber: ['', [Validators.pattern(/^[0-9+\s]+$/)]],
      address: [''],
      bio: ['']
    });
  }

  loadUserData() {
    this.isLoading = true;
    
    this.authService.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) return new Observable<null>(subscriber => subscriber.next(null));
        return this.userService.getUser(user.uid);
      })
    ).subscribe(user => {
      this.isLoading = false;
      if (user) {
        this.profileForm.patchValue({
          displayName: user.displayName || '',
          phoneNumber: user.phone || '',
          address: user.address?.street || '',
          bio: (user as any).bio || ''
        });
        
        if (user.photoURL) {
          this.previewUrl = user.photoURL;
        }
      }
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length) {
      this.selectedFile = input.files[0];
      
      // Créer une prévisualisation de l'image
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  async onSubmit() {
    if (this.profileForm.invalid) return;
    
    this.isSaving = true;
    
    try {
      const user = await this.authService.user$.pipe(take(1)).toPromise();
      if (!user) {
        this.toastService.showError('Vous devez être connecté pour modifier votre profil');
        this.router.navigate(['/auth/login']);
        return;
      }
      
      const userId = user.uid;
      const profileData = this.profileForm.value;
      
      // Si une nouvelle image a été sélectionnée, la télécharger
      if (this.selectedFile) {
        const photoURL = await this.userService.uploadProfileImage(userId, this.selectedFile);
        profileData.photoURL = photoURL;
      }
      
      await this.userService.updateUser(userId, profileData);
      
      this.toastService.showSuccess('Profil mis à jour avec succès');
      this.router.navigate(['/profile']);
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil', error);
      this.toastService.showError('Erreur lors de la mise à jour du profil');
    } finally {
      this.isSaving = false;
    }
  }

  cancel() {
    this.router.navigate(['/profile']);
  }
}
