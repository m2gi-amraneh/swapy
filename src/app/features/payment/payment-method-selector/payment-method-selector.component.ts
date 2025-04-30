import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

import { WalletService } from '../../../core/services/wallet.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Wallet } from '../../../core/models/wallet.model';
import { PaymentMethod } from '../../../core/models/payment.model';

@Component({
  selector: 'app-payment-method-selector',
  templateUrl: './payment-method-selector.component.html',
  styleUrls: ['./payment-method-selector.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    FormsModule
  ]
})
export class PaymentMethodSelectorComponent implements OnInit {
  @Input() amount: number = 0;
  @Input() showWalletOption: boolean = true;
  @Output() methodSelected = new EventEmitter<PaymentMethod>();
  
  selectedMethod: PaymentMethod = 'cash';
  wallet$!: Observable<Wallet | null>;
  canUseWallet: boolean = false;
  isLoading: boolean = true;
  
  paymentMethods = [
    { id: 'cash', name: 'Paiement en espèces', icon: 'cash-outline', description: 'Payer en espèces lors de la prestation' },
    { id: 'baridiMob', name: 'BaridiMob', icon: 'phone-portrait-outline', description: 'Payer avec l\'application BaridiMob' },
    { id: 'edahabia', name: 'EDAHABIA', icon: 'card-outline', description: 'Payer avec votre carte EDAHABIA' },
    { id: 'wallet', name: 'Portefeuille électronique', icon: 'wallet-outline', description: 'Payer avec votre solde de portefeuille' }
  ];

  constructor(
    private walletService: WalletService,
    private paymentService: PaymentService
  ) { }

  ngOnInit() {
    this.isLoading = true;
    
    if (this.showWalletOption) {
      this.wallet$ = this.walletService.getUserWallet().pipe(
        tap(wallet => {
          this.isLoading = false;
          if (wallet) {
            this.canUseWallet = wallet.balance >= this.amount;
          }
        })
      );
    } else {
      this.isLoading = false;
      this.wallet$ = of(null);
    }
  }

  selectMethod(method: PaymentMethod) {
    // Vérifier si le portefeuille a un solde suffisant
    if (method === 'wallet') {
      this.paymentService.canPayWithWallet(this.amount).subscribe(canPay => {
        if (canPay) {
          this.selectedMethod = method;
          this.methodSelected.emit(method);
        } else {
          // Afficher un message d'erreur ou rediriger vers la page de dépôt
          console.error('Solde insuffisant pour utiliser le portefeuille');
          // On pourrait ajouter ici un toast ou une alerte
        }
      });
    } else {
      this.selectedMethod = method;
      this.methodSelected.emit(method);
    }
  }
}
