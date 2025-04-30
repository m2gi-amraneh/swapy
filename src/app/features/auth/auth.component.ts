import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule, LoginComponent, RegisterComponent]
})
export class AuthComponent {
  segment: 'login' | 'register' = 'login';

  segmentChanged(event: any) {
    this.segment = event.detail.value;
  }
}
