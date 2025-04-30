import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-chat-layout',
  templateUrl: './chat-layout.component.html',
  styleUrls: ['./chat-layout.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    IonicModule
  ]
})
export class ChatLayoutComponent {
  constructor() { }
}
