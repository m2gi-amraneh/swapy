import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { 
  homeOutline, 
  searchOutline, 
  chatbubblesOutline, 
  personOutline, 
  notificationsOutline, 
  walletOutline,
  arrowBack
} from 'ionicons/icons';

@Component({
  selector: 'app-service-layout',
  templateUrl: './service-layout.component.html',
  styleUrls: ['./service-layout.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonicModule
  ]
})
export class ServiceLayoutComponent implements OnInit {
  constructor() { 
    // Add icons needed for this component
    addIcons({
      homeOutline, 
      searchOutline, 
      chatbubblesOutline, 
      personOutline, 
      notificationsOutline, 
      walletOutline,
      arrowBack
    });
  }

  ngOnInit() {
    console.log('ServiceLayoutComponent initialized');
  }
}
