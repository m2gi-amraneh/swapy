import { Injectable } from '@angular/core';
import {
  Firestore,
  collection,
  collectionData,
  doc,
  docData,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  setDoc,
  updateDoc,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from, of, throwError } from 'rxjs';
import {
  map,
  switchMap,
  take,
  catchError,
  timeout
} from 'rxjs/operators';
import { Wallet, WalletTransaction } from '../models/wallet.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class WalletService {
  constructor(
    private firestore: Firestore,
    private authService: AuthService
  ) { }

  /**
   * Gets the current user's wallet
   */
  getUserWallet(): Observable<Wallet | null> {
    return this.authService.user$.pipe(
      take(1), // Only take the current user value
      switchMap(user => {
        if (!user) {
          console.log('No user found');
          return of(null);
        }

        const walletsRef = collection(this.firestore, 'wallets');
        const q = query(
          walletsRef,
          where('userId', '==', user.uid),
          limit(1)
        );

        return collectionData(q, { idField: 'id' }).pipe(
          take(1), // Ensure we complete after the first emission
          map(wallets => {
            console.log('Wallets found:', wallets);
            return wallets.length > 0 ? wallets[0] as Wallet : null;
          }),
          switchMap(wallet => {
            if (wallet) {
              console.log('Existing wallet found:', wallet);
              return of(wallet);
            }

            console.log('No wallet found, creating new wallet');
            // Create new wallet if user doesn't have one
            return from(this.createWallet(user.uid)).pipe(
              switchMap(walletId => {
                console.log('New wallet created with ID:', walletId);
                return docData(doc(this.firestore, `wallets/${walletId}`), { idField: 'id' }).pipe(
                  take(1),
                  map(wallet => {
                    console.log('New wallet data:', wallet);
                    return wallet as Wallet;
                  })
                );
              }),
              catchError(error => {
                console.error('Error creating wallet:', error);
                return of(null);
              })
            );
          }),
          catchError(error => {
            console.error('Error fetching wallet:', error);
            return of(null);
          })
        );
      }),
      // This ensures the observable completes even if something goes wrong
      timeout(10000), // Add a timeout to prevent infinite loading
      catchError(error => {
        console.error('Wallet service error:', error);
        return of(null);
      })
    );
  }
  /**
   * Gets wallet transactions
   */
  getWalletTransactions(walletId: string, limitCount: number = 50): Observable<WalletTransaction[]> {
    const transactionsRef = collection(this.firestore, 'wallet_transactions');
    const q = query(
      transactionsRef,
      where('walletId', '==', walletId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    return collectionData(q, { idField: 'id' }) as Observable<WalletTransaction[]>;
  }

  /**
   * Creates a new wallet for a user
   */
  async createWallet(userId: string): Promise<string> {
    const walletsRef = collection(this.firestore, 'wallets');
    const id = doc(walletsRef).id;
    const timestamp = serverTimestamp();

    const wallet: Wallet = {
      id,
      userId,
      balance: 0,
      updatedAt: new Date().getTime(),
      createdAt: new Date().getTime()
    };

    await setDoc(doc(walletsRef, id), wallet);
    return id;
  }

  /**
   * Creates a wallet for the current user
   */
  createUserWallet(): Observable<string> {
    return this.authService.user$.pipe(
      take(1),
      switchMap(user => {
        if (!user) {
          return throwError(() => new Error('User not authenticated'));
        }
        return from(this.createWallet(user.uid));
      }),
      catchError(error => {
        console.error('Error creating wallet:', error);
        return throwError(() => new Error('Failed to create wallet'));
      })
    );
  }

  /**
   * Adds funds to wallet (deposit)
   */
  depositToWallet(amount: number, description: string = 'Funds deposit'): Observable<string> {
    return this.getUserWallet().pipe(
      take(1),
      switchMap(wallet => {
        if (!wallet) {
          return throwError(() => new Error('Wallet not found'));
        }
        return from(this.addFunds(wallet.id, amount, description));
      }),
      catchError(error => {
        console.error('Deposit error:', error);
        return throwError(() => new Error('Failed to process deposit'));
      })
    );
  }

  /**
   * Withdraws funds from wallet
   */
  withdrawFromWallet(amount: number, bankAccount: string): Observable<string> {
    return this.getUserWallet().pipe(
      take(1),
      switchMap(wallet => {
        if (!wallet) {
          return throwError(() => new Error('Wallet not found'));
        }

        if (wallet.balance < amount) {
          return throwError(() => new Error('Insufficient balance'));
        }

        return from(this.withdrawFunds(wallet.id, amount, `Withdrawal to bank account ${bankAccount}`));
      }),
      catchError(error => {
        console.error('Withdrawal error:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Adds funds to wallet
   */
  async addFunds(walletId: string, amount: number, description: string = 'Funds deposit'): Promise<string> {
    const walletRef = doc(this.firestore, `wallets/${walletId}`);
    const wallet = await docData(walletRef).pipe(take(1)).toPromise() as Wallet;

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const timestamp = serverTimestamp();
    const transactionsRef = collection(this.firestore, 'wallet_transactions');
    const transactionId = doc(transactionsRef).id;

    const transaction: WalletTransaction = {
      id: transactionId,
      walletId,
      amount,
      type: 'deposit',
      description,
      createdAt: new Date().getTime(),
      status: 'completed'
    };

    const newBalance = wallet.balance + amount;

    // Update wallet balance
    await updateDoc(walletRef, {
      balance: newBalance,
      updatedAt: timestamp
    });

    // Add transaction
    await setDoc(doc(transactionsRef, transactionId), transaction);

    return transactionId;
  }

  /**
   * Withdraws funds from wallet
   */
  async withdrawFunds(walletId: string, amount: number, description: string = 'Funds withdrawal'): Promise<string> {
    const walletRef = doc(this.firestore, `wallets/${walletId}`);
    const wallet = await docData(walletRef).pipe(take(1)).toPromise() as Wallet;

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const timestamp = serverTimestamp();
    const transactionsRef = collection(this.firestore, 'wallet_transactions');
    const transactionId = doc(transactionsRef).id;

    const transaction: WalletTransaction = {
      id: transactionId,
      walletId,
      amount: -amount, // Negative amount for withdrawal
      type: 'withdrawal',
      description,
      createdAt: new Date().getTime(),
      status: 'completed'
    };

    const newBalance = wallet.balance - amount;

    // Update wallet balance
    await updateDoc(walletRef, {
      balance: newBalance,
      updatedAt: timestamp
    });

    // Add transaction
    await setDoc(doc(transactionsRef, transactionId), transaction);

    return transactionId;
  }

  /**
   * Checks if wallet has sufficient balance
   */
  checkSufficientBalance(amount: number): Observable<boolean> {
    return this.getUserWallet().pipe(
      take(1),
      map(wallet => {
        if (!wallet) return false;
        return wallet.balance >= amount;
      }),
      catchError(error => {
        console.error('Balance check error:', error);
        return of(false);
      })
    );
  }

  /**
   * Makes a payment from wallet
   */
  async makePayment(walletId: string, amount: number, bookingId: string, description: string = 'Booking payment'): Promise<string> {
    const walletRef = doc(this.firestore, `wallets/${walletId}`);
    const wallet = await docData(walletRef).pipe(take(1)).toPromise() as Wallet;

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.balance < amount) {
      throw new Error('Insufficient balance');
    }

    const timestamp = serverTimestamp();
    const transactionsRef = collection(this.firestore, 'wallet_transactions');
    const transactionId = doc(transactionsRef).id;

    const transaction: WalletTransaction = {
      id: transactionId,
      walletId,
      amount: -amount, // Negative amount for payment
      type: 'payment',
      description,
      createdAt: new Date().getTime(),
      status: 'completed',
      bookingId
    };

    const newBalance = wallet.balance - amount;

    // Update wallet balance
    await updateDoc(walletRef, {
      balance: newBalance,
      updatedAt: timestamp
    });

    // Add transaction
    await setDoc(doc(transactionsRef, transactionId), transaction);

    return transactionId;
  }

  /**
   * Processes a refund to wallet
   */
  async refundPayment(walletId: string, amount: number, bookingId: string, description: string = 'Booking refund'): Promise<string> {
    const walletRef = doc(this.firestore, `wallets/${walletId}`);
    const wallet = await docData(walletRef).pipe(take(1)).toPromise() as Wallet;

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    const timestamp = serverTimestamp();
    const transactionsRef = collection(this.firestore, 'wallet_transactions');
    const transactionId = doc(transactionsRef).id;

    const transaction: WalletTransaction = {
      id: transactionId,
      walletId,
      amount, // Positive amount for refund
      type: 'refund',
      description,
      createdAt: new Date().getTime(),
      status: 'completed',
      bookingId
    };

    const newBalance = wallet.balance + amount;

    // Update wallet balance
    await updateDoc(walletRef, {
      balance: newBalance,
      updatedAt: timestamp
    });

    // Add transaction
    await setDoc(doc(transactionsRef, transactionId), transaction);

    return transactionId;
  }

  /**
   * Batch update wallet balance (for admin operations)
   */
  async batchUpdateWalletBalances(updates: Array<{ walletId: string, amount: number }>): Promise<void> {
    const batch = writeBatch(this.firestore);
    const timestamp = serverTimestamp();

    for (const update of updates) {
      const walletRef = doc(this.firestore, `wallets/${update.walletId}`);
      batch.update(walletRef, {
        balance: update.amount,
        updatedAt: timestamp
      });
    }

    await batch.commit();
  }
  getuserwalletid(userId: string): Observable<string | null> {
    const walletsRef = collection(this.firestore, 'wallets');
    const q = query(
      walletsRef,
      where('userId', '==', userId),
      limit(1)
    );

    return collectionData(q, { idField: 'id' }).pipe(
      take(1), // Ensure we complete after the first emission
      map(wallets => {
        console.log('Wallets found:', wallets);
        return wallets.length > 0 ? wallets[0].id : null;
      }),
      catchError(error => {
        console.error('Error fetching wallet ID:', error);
        return of(null);
      })
    );
  }
}
