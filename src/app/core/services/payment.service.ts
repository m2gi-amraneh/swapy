import { Injectable } from '@angular/core';
import {
  Firestore, // Import Firestore instead of AngularFirestore
  collection, // Function to create a collection reference
  collectionData, // Function to get collection data as Observable
  doc, // Function to create a document reference
  docData, // Function to get document data as Observable
  query, // Function to create a query
  where, // Function for query constraints (where clauses)
  orderBy, // Function for query constraints (ordering)
  setDoc, // Function to write/overwrite a document
  updateDoc, // Function to update a document
  getDoc, // Function to get a single document snapshot
  Timestamp, // Use Firestore Timestamp if needed, though Date.now() is used here
  serverTimestamp // Use serverTimestamp for server-generated timestamps if preferred
} from '@angular/fire/firestore';
import { Observable, of, from } from 'rxjs'; // Import 'from' for promise conversion if needed
import { map, } from 'rxjs/operators'; // Import firstValueFrom
import { Payment, PaymentMethod, PaymentStatus } from '../models/payment.model';
import { WalletService } from './wallet.service';
import { Wallet } from '../models/wallet.model';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  // No need for AngularFirestoreCollection member variable in modular syntax
  // References are usually created within the methods where they are needed.

  constructor(
    private firestore: Firestore, // Inject modular Firestore
    private walletService: WalletService
  ) { }

  getPayments(): Observable<Payment[]> {
    // 1. Get a reference to the collection
    const paymentsRef = collection(this.firestore, 'payments');
    // 2. Get data using collectionData, specifying the ID field
    return collectionData(paymentsRef, { idField: 'id' }) as Observable<Payment[]>;
  }
  getPaymentsByBookingId(bookingId: string): Observable<Payment[]> {
    const paymentsRef = collection(this.firestore, 'payments');
    // 1. Create a query with where and orderBy clauses
    const q = query(
      paymentsRef,
      where('bookingId', '==', bookingId),
      orderBy('createdAt', 'desc')
    );
    // 2. Get data from the query result
    return collectionData(q, { idField: 'id' }) as Observable<Payment[]>;
  }
  getPaymentsByClient(clientId: string): Observable<Payment[]> {
    const paymentsRef = collection(this.firestore, 'payments');
    // 1. Create a query with where and orderBy clauses
    const q = query(
      paymentsRef,
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc')
    );
    // 2. Get data from the query result
    return collectionData(q, { idField: 'id' }) as Observable<Payment[]>;
  }

  getPaymentsByProvider(providerId: string): Observable<Payment[]> {
    const paymentsRef = collection(this.firestore, 'payments');
    const q = query(
      paymentsRef,
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Payment[]>;
  }

  getPaymentsByBooking(bookingId: string): Observable<Payment[]> {
    const paymentsRef = collection(this.firestore, 'payments');
    const q = query(
      paymentsRef,
      where('bookingId', '==', bookingId),
      orderBy('createdAt', 'desc')
    );
    return collectionData(q, { idField: 'id' }) as Observable<Payment[]>;
  }

  getPayment(id: string): Observable<Payment | null> {
    // 1. Get a reference to the specific document
    const paymentRef = doc(this.firestore, `payments/${id}`);
    // 2. Get the document data
    return docData(paymentRef, { idField: 'id' }).pipe(
      map(payment => (payment as Payment) || null) // Map to Payment or null
    );
  }

  async createPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const timestamp = Date.now(); // Or use serverTimestamp() for server time
    const paymentsRef = collection(this.firestore, 'payments');

    // 1. Create a reference for a new document *with* an auto-generated ID
    const newPaymentRef = doc(paymentsRef); // Ref to a doc with a new ID in 'payments' collection

    // 2. Use setDoc to create the document with the generated ID
    await setDoc(newPaymentRef, {
      ...paymentData,
      id: newPaymentRef.id, // Use the generated ID
      createdAt: timestamp, // Consider serverTimestamp()
      updatedAt: timestamp  // Consider serverTimestamp()
    });

    return newPaymentRef.id; // Return the generated ID
  }

  async updatePaymentStatus(id: string, status: PaymentStatus, transactionId?: string): Promise<void> {
    const timestamp = Date.now(); // Or serverTimestamp()
    const paymentRef = doc(this.firestore, `payments/${id}`);

    const updateData: Partial<Payment> = { // Use Partial<Payment> for type safety
      status,
      updatedAt: timestamp
    };

    if (transactionId !== undefined) { // Check specifically for undefined
      updateData.transactionId = transactionId;
    }

    // Use updateDoc to update the document
    return updateDoc(paymentRef, updateData);
  }

  async confirmCashPayment(id: string, notes?: string): Promise<void> {
    const timestamp = Date.now(); // Or serverTimestamp()
    const paymentRef = doc(this.firestore, `payments/${id}`);
    return updateDoc(paymentRef, {
      status: 'completed',
      notes: notes ?? 'Payment confirmed by provider', // Use nullish coalescing
      updatedAt: timestamp
    });
  }

  async refundPayment(id: string, notes?: string): Promise<void> {
    const timestamp = Date.now(); // Or serverTimestamp()
    const paymentRef = doc(this.firestore, `payments/${id}`);
    return updateDoc(paymentRef, {
      status: 'refunded',
      notes: notes ?? 'Payment refunded',
      updatedAt: timestamp
    });
  }

  // --- Initiation methods remain largely the same logic, just call the updated createPayment ---

  async initiateBaridiMobPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'method' | 'status'>): Promise<string> {
    // Real implementation would call BaridiMob API
    console.log('Simulating BaridiMob payment initiation...');
    return this.createPayment({
      ...paymentData,
      method: 'baridiMob',
      status: 'pending'
    });
  }

  async initiateEdahabiaPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'method' | 'status'>): Promise<string> {
    // Real implementation would call EDAHABIA API
    console.log('Simulating EDAHABIA payment initiation...');
    return this.createPayment({
      ...paymentData,
      method: 'edahabia',
      status: 'pending'
    });
  }

  async initiateCashPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'method' | 'status'>): Promise<string> {
    console.log('Initiating Cash payment record...');
    return this.createPayment({
      ...paymentData,
      method: 'cash',
      status: 'pending' // Pending confirmation from provider
    });
  }

  async initiateWalletPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'method' | 'status'>, walletId: string): Promise<string> {
    // 1. Get wallet document using getDoc
    const walletRef = doc(this.firestore, `wallets/${walletId}`);
    try {
      const walletSnap = await getDoc(walletRef);

      if (!walletSnap.exists()) { // Check document existence
        throw new Error('Wallet not found');
      }

      const wallet = walletSnap.data() as Wallet; // Get data

      if (wallet.balance < paymentData.amount) {
        throw new Error('Insufficient balance to make this payment');
      }

      // 2. Create payment record (status 'processing')
      const paymentId = await this.createPayment({
        ...paymentData,
        method: 'wallet',
        status: 'processing' // Indicate processing before wallet deduction
      });

      try {
        // 3. Perform wallet deduction via WalletService
        await this.walletService.makePayment(walletId, paymentData.amount, paymentData.bookingId, paymentId);

        // 4. Update payment status to 'completed'
        await this.updatePaymentStatus(paymentId, 'completed');

        return paymentId;
      } catch (error) {
        // 5. If wallet deduction fails, mark payment as 'failed'
        console.error('Wallet payment deduction failed, marking payment as failed.', error);
        await this.updatePaymentStatus(paymentId, 'failed');
        throw error; // Re-throw the error from walletService or updatePaymentStatus
      }
    } catch (error) {
      console.error('Error during wallet payment initiation:', error);
      throw error; // Re-throw error (e.g., wallet not found, insufficient balance)
    }
  }

  /**
   * Checks if the user can pay the specified amount with their wallet.
   * This method relies on walletService, so no direct Firestore changes needed here.
   * @param amount Amount to pay
   * @returns Observable<boolean> indicating if payment is possible
   */
  canPayWithWallet(amount: number): Observable<boolean> {
    // No change needed here as it delegates to walletService
    return this.walletService.checkSufficientBalance(amount);
  }
}
