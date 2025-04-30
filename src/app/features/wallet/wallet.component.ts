import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Observable, of, BehaviorSubject, combineLatest } from 'rxjs';
import { switchMap, tap, map, catchError } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';

import { WalletService } from '../../core/services/wallet.service';
import { Wallet, WalletTransaction } from '../../core/models/wallet.model';
import { addIcons } from 'ionicons';
import { add, pieChartOutline, homeOutline, logInOutline, logOutOutline, briefcaseOutline, calendarOutline, cardOutline, arrowDownCircleOutline, addCircleOutline, arrowUpCircleOutline, documentTextOutline } from 'ionicons/icons';

interface TransactionSummary {
  totalDeposits: number;
  totalWithdrawals: number;
  totalPayments: number;
  totalRefunds: number;
  netBalance: number;
}
addIcons({add, pieChartOutline , homeOutline,logInOutline,logOutOutline,briefcaseOutline,calendarOutline,cardOutline,arrowDownCircleOutline,addCircleOutline,arrowUpCircleOutline,documentTextOutline});
@Component({
  selector: 'app-wallet',
  templateUrl: './wallet.component.html',
  styleUrls: ['./wallet.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    FormsModule
  ]
})
export class WalletComponent implements OnInit {
  wallet$!: Observable<Wallet | null>;
  transactions$!: Observable<WalletTransaction[]>;
  filteredTransactions$!: Observable<WalletTransaction[]>;
  transactionSummary$!: Observable<TransactionSummary>;
  depositForm: FormGroup;
  withdrawForm: FormGroup;
  isLoading: boolean = true;
  activeSegment: 'balance' | 'deposit' | 'withdraw' | 'history' | 'stats' = 'balance';
  errorMessage: string | null = null;
  successMessage: string | null = null;
  isProcessing: boolean = false;
  
  // Filtres pour l'historique des transactions
  private transactionTypeFilter = new BehaviorSubject<string | null>(null);
  private dateRangeFilter = new BehaviorSubject<{start: number, end: number} | null>(null);
  
  // Pour les graphiques de statistiques
  transactionsByMonth: any[] = [];
  transactionsByType: any[] = [];

  constructor(
    private walletService: WalletService,
    private fb: FormBuilder
  ) {
    this.depositForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(100), Validators.max(100000)]]
    });

    this.withdrawForm = this.fb.group({
      amount: [null, [Validators.required, Validators.min(100), Validators.max(100000)]],
      bankAccount: ['', Validators.required]
    });
  }

  ngOnInit() {
    this.loadWalletData();
  }

  loadWalletData() {
    this.isLoading = true;
    this.wallet$ = this.walletService.getUserWallet().pipe(
      tap(wallet => {
        this.isLoading = false;
        if (wallet) {
          this.transactions$ = this.walletService.getWalletTransactions(wallet.id);
          
          // Filtrer les transactions
          this.filteredTransactions$ = combineLatest([
            this.transactions$,
            this.transactionTypeFilter,
            this.dateRangeFilter
          ]).pipe(
            map(([transactions, typeFilter, dateFilter]) => {
              return transactions.filter(transaction => {
                let matchesType = true;
                let matchesDate = true;
                
                if (typeFilter) {
                  matchesType = transaction.type === typeFilter;
                }
                
                if (dateFilter) {
                  matchesDate = transaction.createdAt >= dateFilter.start && transaction.createdAt <= dateFilter.end;
                }
                
                return matchesType && matchesDate;
              });
            })
          );
          
          // Calculer les statistiques des transactions
          this.transactionSummary$ = this.transactions$.pipe(
            map(transactions => {
              const summary: TransactionSummary = {
                totalDeposits: 0,
                totalWithdrawals: 0,
                totalPayments: 0,
                totalRefunds: 0,
                netBalance: 0
              };
              
              transactions.forEach(transaction => {
                if (transaction.status === 'completed') {
                  switch (transaction.type) {
                    case 'deposit':
                      summary.totalDeposits += transaction.amount;
                      break;
                    case 'withdrawal':
                      summary.totalWithdrawals += Math.abs(transaction.amount);
                      break;
                    case 'payment':
                      summary.totalPayments += Math.abs(transaction.amount);
                      break;
                    case 'refund':
                      summary.totalRefunds += transaction.amount;
                      break;
                  }
                }
              });
              
              summary.netBalance = summary.totalDeposits + summary.totalRefunds - summary.totalWithdrawals - summary.totalPayments;
              
              // Préparer les données pour les graphiques
              this.prepareChartData(transactions);
              
              return summary;
            })
          );
        }
      }),
      catchError(error => {
        this.isLoading = false;
        this.errorMessage = `Error loading wallet: ${error.message}`;
        return of(null);
      })
    );
  }

  prepareChartData(transactions: WalletTransaction[]) {
    // Regrouper les transactions par mois
    const byMonth = new Map<string, number>();
    const byType = new Map<string, number>();
    
    transactions.forEach(transaction => {
      if (transaction.status === 'completed') {
        // Par mois
        const date = new Date(transaction.createdAt);
        const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
        const currentMonthValue = byMonth.get(monthKey) || 0;
        byMonth.set(monthKey, currentMonthValue + (transaction.type === 'deposit' || transaction.type === 'refund' ? transaction.amount : -Math.abs(transaction.amount)));
        
        // Par type
        const typeValue = byType.get(transaction.type) || 0;
        byType.set(transaction.type, typeValue + Math.abs(transaction.amount));
      }
    });
    
    // Convertir en tableaux pour les graphiques
    this.transactionsByMonth = Array.from(byMonth.entries()).map(([month, amount]) => {
      const [year, monthNum] = month.split('-');
      return {
        month: new Date(parseInt(year), parseInt(monthNum) - 1, 1).toLocaleDateString('fr-DZ', { month: 'short', year: 'numeric' }),
        amount
      };
    }).sort((a, b) => {
      const dateA = new Date(a.month);
      const dateB = new Date(b.month);
      return dateA.getTime() - dateB.getTime();
    });
    
    this.transactionsByType = Array.from(byType.entries()).map(([type, amount]) => {
      return { type, amount };
    });
  }

  segmentChanged(event: any) {
    this.activeSegment = event.detail.value;
    this.clearMessages();
  }

  clearMessages() {
    this.errorMessage = null;
    this.successMessage = null;
  }

  filterTransactionsByType(type: string | null) {
    this.transactionTypeFilter.next(type);
  }
  
  onDateRangeChange(range: string | null) {
    if (!range) {
      this.dateRangeFilter.next(null);
      return;
    }
    
    const now = new Date();
    const end = now.getTime();
    let start: number;
    
    switch (range) {
      case '7days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
        break;
      case '30days':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30).getTime();
        break;
      case '3months':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).getTime();
        break;
      case '6months':
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).getTime();
        break;
      case '1year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getTime();
        break;
      default:
        start = 0;
    }
    
    this.dateRangeFilter.next({ start, end });
  }
  
  clearFilters() {
    this.transactionTypeFilter.next(null);
    this.dateRangeFilter.next(null);
  }

  onDepositSubmit() {
    if (this.depositForm.invalid) {
      return;
    }
    
    this.isProcessing = true;
    this.clearMessages();
    
    const amount = this.depositForm.value.amount;
    
    this.walletService.depositToWallet(amount).subscribe({
      next: () => {
        this.isProcessing = false;
        this.successMessage = `Dépôt de ${amount} DZD effectué avec succès.`;
        this.depositForm.reset();
        this.loadWalletData();
      },
      error: (error: any) => {
        this.isProcessing = false;
        this.errorMessage = `Erreur lors du dépôt: ${error.message}`;
      }
    });
  }

  onWithdrawSubmit() {
    if (this.withdrawForm.invalid) {
      return;
    }
    
    this.isProcessing = true;
    this.clearMessages();
    
    const { amount, bankAccount } = this.withdrawForm.value;
    
    this.walletService.withdrawFromWallet(amount, bankAccount).subscribe({
      next: () => {
        this.isProcessing = false;
        this.successMessage = `Retrait de ${amount} DZD effectué avec succès.`;
        this.withdrawForm.reset();
        this.loadWalletData();
      },
      error: (error: any) => {
        this.isProcessing = false;
        this.errorMessage = `Erreur lors du retrait: ${error.message}`;
      }
    });
  }

  createWallet() {
    this.isLoading = true;
    this.walletService.createUserWallet().subscribe({
      next: () => {
        this.loadWalletData();
        this.successMessage = "Votre portefeuille a été créé avec succès.";
      },
      error: (error:any ) => {
        this.isLoading = false;
        this.errorMessage = `Erreur lors de la création du portefeuille: ${error.message}`;
      }
    });
  }

  getTransactionIcon(type: string): string {
    switch (type) {
      case 'deposit':
        return 'arrow-up-circle-outline';
      case 'withdrawal':
        return 'arrow-down-circle-outline';
      case 'payment':
        return 'cart-outline';
      case 'refund':
        return 'return-up-back-outline';
      default:
        return 'ellipsis-horizontal-outline';
    }
  }

  getTransactionColor(transaction: WalletTransaction): string {
    if (transaction.status !== 'completed') {
      return 'medium';
    }
    
    switch (transaction.type) {
      case 'deposit':
      case 'refund':
        return 'success';
      case 'withdrawal':
      case 'payment':
        return 'danger';
      default:
        return 'medium';
    }
  }

  getTransactionLabel(type: string): string {
    switch (type) {
      case 'deposit':
        return 'Dépôt';
      case 'withdrawal':
        return 'Retrait';
      case 'payment':
        return 'Paiement';
      case 'refund':
        return 'Remboursement';
      default:
        return 'Transaction';
    }
  }
  
  // Fonctions pour les graphiques
  getBarHeight(amount: number): number {
    // Calculer une hauteur relative pour les barres du graphique
    const maxAmount = Math.max(...this.transactionsByMonth.map(item => Math.abs(item.amount)));
    if (maxAmount === 0) return 0;
    
    // Retourner une valeur entre 10 et 100%
    return 10 + (Math.abs(amount) / maxAmount * 90);
  }
  
  getPieSegmentColor(type: string): string {
    switch (type) {
      case 'deposit':
        return 'var(--ion-color-success)';
      case 'withdrawal':
        return 'var(--ion-color-danger)';
      case 'payment':
        return 'var(--ion-color-warning)';
      case 'refund':
        return 'var(--ion-color-tertiary)';
      default:
        return 'var(--ion-color-medium)';
    }
  }
  
  getPieSegmentSize(amount: number): number {
    // Calculer le pourcentage pour chaque segment du graphique en camembert
    const totalAmount = this.transactionsByType.reduce((sum, item) => sum + item.amount, 0);
    if (totalAmount === 0) return 0;
    
    return (amount / totalAmount) * 100;
  }
}
