import { Injectable, NgZone } from '@angular/core';
import { 
  Auth,
  UserCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
  PhoneAuthProvider,
  RecaptchaVerifier,
  ConfirmationResult,
  signInWithPhoneNumber
} from '@angular/fire/auth';
import { 
  Firestore, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  docData,
  serverTimestamp
} from '@angular/fire/firestore';
import { Observable, from, of, BehaviorSubject } from 'rxjs';
import { switchMap, map, catchError, tap, take, shareReplay } from 'rxjs/operators';
import { UserProfile, ClientProfile, ProviderProfile, UserRole, BaseUserProfile } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserProfile$ = new BehaviorSubject<UserProfile | null>(null);
  private userRole: UserRole = 'client';
  private userProfileCache = new Map<string, UserProfile>();


  constructor(
    private auth: Auth,
    private firestore: Firestore,
    private ngZone: NgZone
  ) {
    this.initializeAuthState();

  }
  get user$(): Observable<UserProfile | null> {
    return this.currentUserProfile$.asObservable().pipe(
      shareReplay(1) // Share the latest value with all subscribers
    );
  }
  private initializeAuthState(): void {
    onAuthStateChanged(this.auth, async (user) => {
      if (user) {
        await this.loadUserProfile(user.uid);
      } else {
        this.currentUserProfile$.next(null);
      }
    });
  }
  private async loadUserProfile(uid: string): Promise<void> {
    // Check cache first
    if (this.userProfileCache.has(uid)) {
      this.currentUserProfile$.next(this.userProfileCache.get(uid)!);
      return;
    }

    const userRef = doc(this.firestore, `users/${uid}`);
    const docSnap = await getDoc(userRef);
    
    if (docSnap.exists()) {
      const profile = docSnap.data() as UserProfile;
      this.userProfileCache.set(uid, profile);
      this.currentUserProfile$.next(profile);
      this.userRole = profile.role;
      await this.updateLastActive(uid);
    } else {
      this.currentUserProfile$.next(null);
    }
  }
  async signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    await this.updateLastActive(credential.user.uid);
    return credential;
  }

  async signInWithGoogle(): Promise<UserCredential> {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    
    try {
      const credential = await signInWithPopup(this.auth, provider);
      
      // Check if user exists in Firestore, if not create a profile
      const userRef = doc(this.firestore, `users/${credential.user.uid}`);
      const docSnap = await getDoc(userRef);
      
      if (!docSnap.exists()) {
        await this.createUserProfile(credential.user, { role: this.userRole });
      } else {
        await this.updateLastActive(credential.user.uid);
      }
      
      return credential;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  async signInWithPhoneNumber(phoneNumber: string, appVerifier: RecaptchaVerifier): Promise<ConfirmationResult> {
    return signInWithPhoneNumber(this.auth, phoneNumber, appVerifier);
  }

  async verifyPhoneNumberAndSignIn(confirmationResult: ConfirmationResult, verificationCode: string): Promise<UserCredential> {
    const credential = await confirmationResult.confirm(verificationCode);
    
    // Check if user exists, create profile if not
    const userRef = doc(this.firestore, `users/${credential.user.uid}`);
    const docSnap = await getDoc(userRef);
    
    if (!docSnap.exists()) {
      await this.createUserProfile(credential.user, { 
        role: this.userRole,
        phone: credential.user.phoneNumber || undefined
      });
    } else {
      await this.updateLastActive(credential.user.uid);
    }
    
    return credential;
  }

  async createUserWithEmailAndPassword(email: string, password: string, userData?: Partial<BaseUserProfile>): Promise<UserCredential> {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    await this.createUserProfile(credential.user, userData);
    return credential;
  }

  async signOut(): Promise<void> {
    // Update user's online status before signing out
    const user = this.auth.currentUser;
    if (user) {
      const userRef = doc(this.firestore, `users/${user.uid}`);
      await updateDoc(userRef, {
        isOnline: false,
        lastActive: serverTimestamp()
      });
    }
    return signOut(this.auth);
  }

  async resetPassword(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email);
  }

  getCurrentUser(): Observable<User | null> {
    return new Observable<User | null>(subscriber => {
      return onAuthStateChanged(this.auth, subscriber);
    });
  }

  getCurrentUserPromise(): Promise<User | null> {
    return new Promise((resolve, reject) => {
      const unsubscribe = onAuthStateChanged(
        this.auth,
        (user) => {
          unsubscribe();
          resolve(user);
        },
        (error) => {
          unsubscribe();
          reject(error);
        }
      );
    });
  }

  async updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  async createUserProfile(user: User, additionalData?: Partial<BaseUserProfile>): Promise<void> {
    const userRef = doc(this.firestore, `users/${user.uid}`);
    
    // Only include address if it's provided and not undefined
    const userData: BaseUserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt:new Date().getTime(),// Use serverTimestamp instead of client time
      lastActive: new Date().getTime(),
      isOnline: true,
      role: additionalData?.role || 'client',
      phone: additionalData?.phone || user.phoneNumber || '',
      businessName: additionalData?.businessName || '',
      ...(additionalData?.address && { address: additionalData.address }) // Only include if defined
    };
  
    if (userData.role === 'client') {
      const clientData: ClientProfile = {
        favoriteServices: [],
        savedProviders: [],
        preferences: {
          notifications: true,
          language: 'en'
        }
      };
      
      await setDoc(userRef, { ...userData, ...clientData });
    } else {
      const providerData: ProviderProfile = {
        businessName: additionalData?.businessName || user.displayName || '',
        profession: '',
        bio: '',
        services: [],
        availability: {},
        rating: 0,
        reviewCount: 0,
        verified: false,
        badges: [],
        specialties: [],
        languages: ['English'],
        certifications: []
      };
      
      await setDoc(userRef, { ...userData, ...providerData });
    }
  }

  private async updateLastActive(uid: string): Promise<void> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return updateDoc(userRef, {
      lastActive: serverTimestamp(),
      isOnline: true
    }).catch(error => {
      console.error('Error updating last active status:', error);
    });
  }

  getClientProfile(uid: string): Observable<ClientProfile | null> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return docData(userRef).pipe(
      map(profile => {
        if (profile && profile['role'] === 'client') {
          return profile as ClientProfile;
        }
        return null;
      })
    );
  }

  getProviderProfile(uid: string): Observable<ProviderProfile | null> {
    const userRef = doc(this.firestore, `users/${uid}`);
    return docData(userRef).pipe(
      map(profile => {
        if (profile && profile['role'] === 'provider') {
          return profile as ProviderProfile;
        }
        return null;
      })
    );
  }

  getUserRole(userId: string): Observable<UserRole> {
    const userRef = doc(this.firestore, `users/${userId}`);
    return docData(userRef).pipe(
      map((user: any) => user?.role || 'client')
    );
  }

  setUserRole(role: UserRole): void {
    this.userRole = role;
  }

  getCurrentUserRole(): Observable<UserRole | null> {
    return this.currentUserProfile$.pipe(
      take(1),
      map(user => user ? user.role : null)
    );
  }

  isAuthenticated(): Observable<boolean> {
    return this.getCurrentUser().pipe(
      map(user => !!user)
    );
  }

  isProvider(): Observable<boolean> {
    return this.currentUserProfile$.pipe(
      map(user => !!user && user.role === 'provider')
    );
  }

  isClient(): Observable<boolean> {
    return this.currentUserProfile$.pipe(
      map(user => !!user && user.role === 'client')
    );
  }
}