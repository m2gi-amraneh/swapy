import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable } from 'rxjs';
import { CategoryService } from '../../core/services/category.service';
import { ServiceService } from '../../core/services/service.service';
import { AuthService } from '../../core/services/auth.service';
import { Category } from '../../core/models/category.model';
import { Service } from '../../core/models/service.model';
import { addIcons } from 'ionicons';
import { addOutline, alertCircleOutline, briefcase, calendar, checkmarkCircle, eye, imageOutline, closeCircle, arrowBack } from 'ionicons/icons';
addIcons({imageOutline, addOutline, calendar, checkmarkCircle, briefcase, eye, alertCircleOutline, closeCircle, arrowBack});

@Component({
  selector: 'app-service-create',
  templateUrl: './service-create.component.html',
  styleUrls: ['./service-create.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ]
})
export class ServiceCreateComponent implements OnInit {
  serviceForm!: FormGroup;
  categories$!: Observable<Category[]>;
  isSubmitting = false;
  errorMessage = '';
  currentUserId = '';
  selectedImages: string[] = [];

  constructor(
    private formBuilder: FormBuilder,
    private categoryService: CategoryService,
    private serviceService: ServiceService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit() {
    this.initForm();
    this.loadCategories();
    this.getCurrentUser();
    this.restoreSavedFormData();
    console.log('ServiceCreateComponent initialized');
    console.log(this.currentUserId);
  }

  initForm() {
    this.serviceForm = this.formBuilder.group({
      title: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(20)]],
      price: [null, [Validators.required, Validators.min(0)]],
      category: ['', Validators.required],
      location: ['', Validators.required],
      duration: [null]
    });
  }

  loadCategories() {
    this.categories$ = this.categoryService.getCategories();
  }

  getCurrentUser() {
    this.authService.user$.subscribe(user => {
      if (user) {
        this.currentUserId = user.uid;
        console.log('User authenticated:', this.currentUserId);
      } else {
        console.log('No user authenticated, but continuing without redirect');
        // Don't redirect, just keep track that we don't have a user
        this.currentUserId = '';
      }
    });
  }

  onImageSelected(event: any) {
    const files = event.target.files;
    if (files) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.match('image.*')) {
          const reader = new FileReader();
          reader.onload = (e: any) => {
            this.selectedImages.push(e.target.result);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  }

  removeImage(index: number) {
    this.selectedImages.splice(index, 1);
  }

  async onSubmit() {
    if (this.serviceForm.invalid) {
      // Mark all fields as touched to trigger validation messages
      Object.keys(this.serviceForm.controls).forEach(key => {
        const control = this.serviceForm.get(key);
        control?.markAsTouched();
      });
      return;
    }

    // Check if user is authenticated
    if (!this.currentUserId) {
      // Save form data to localStorage before redirecting
      localStorage.setItem('pendingServiceData', JSON.stringify(this.serviceForm.value));
      localStorage.setItem('pendingServiceImages', JSON.stringify(this.selectedImages));
      
      this.errorMessage = 'You must be logged in to create a service';
      
      // Ask user if they want to login
      if (confirm('You need to be logged in to create a service. Do you want to go to the login page?')) {
        this.router.navigate(['/auth/login'], { 
          queryParams: { returnUrl: '/services/create' } 
        });
      }
      return;
    }

    this.isSubmitting = true;
    this.errorMessage = '';

    try {
      const serviceData: Partial<Service> = {
        ...this.serviceForm.value,
        providerId: this.currentUserId,
        images: this.selectedImages,
      };

      const serviceId = await this.serviceService.createService(serviceData);
      this.router.navigate(['/services', serviceId]);
    } catch (error) {
      console.error('Error creating service:', error);
      this.errorMessage = 'Failed to create service. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  /**
   * Restore any previously saved form data from localStorage
   */
  restoreSavedFormData() {
    try {
      const savedFormData = localStorage.getItem('pendingServiceData');
      const savedImages = localStorage.getItem('pendingServiceImages');
      
      if (savedFormData) {
        const formData = JSON.parse(savedFormData);
        this.serviceForm.patchValue(formData);
        console.log('Restored saved form data:', formData);
      }
      
      if (savedImages) {
        this.selectedImages = JSON.parse(savedImages);
        console.log('Restored saved images:', this.selectedImages.length);
      }
      
      // Clear the saved data after restoring
      localStorage.removeItem('pendingServiceData');
      localStorage.removeItem('pendingServiceImages');
    } catch (error) {
      console.error('Error restoring saved form data:', error);
    }
  }
}
