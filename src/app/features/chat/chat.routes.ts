import { Routes } from '@angular/router';
import { ConversationListComponent } from './conversation-list/conversation-list.component';
import { ConversationComponent } from './conversation/conversation.component';
import { AuthGuard } from '../../core/guards/auth.guard';

export const CHAT_ROUTES: Routes = [
  {
    path: '',
    component: ConversationListComponent,
    canActivate: [AuthGuard]
  },
  {
    path: ':id',
    component: ConversationComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'new/:userId',
    component: ConversationComponent,
    canActivate: [AuthGuard]
  }
];
