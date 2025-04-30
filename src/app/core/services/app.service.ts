import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { BehaviorSubject, Observable } from 'rxjs';
import { Storage } from '@ionic/storage-angular';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Network } from '@capacitor/network';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private _darkMode = new BehaviorSubject<boolean>(false);
  private _networkStatus = new BehaviorSubject<boolean>(true);
  private _appReady = new BehaviorSubject<boolean>(false);
  private _storage: Storage | null = null;

  constructor(
    private platform: Platform,
    private storage: Storage
  ) {
    this.init();
  }

  async init() {
    // Initialize storage
    this._storage = await this.storage.create();
    
    // Initialize dark mode
    const savedDarkMode = await this._storage.get('darkMode');
    if (savedDarkMode !== null) {
      this._darkMode.next(savedDarkMode);
      this.applyTheme(savedDarkMode);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this._darkMode.next(prefersDark);
      this.applyTheme(prefersDark);
      await this._storage.set('darkMode', prefersDark);
    }
    
    // Initialize network status
    if (Capacitor.isNativePlatform()) {
      const status = await Network.getStatus();
      this._networkStatus.next(status.connected);
      
      Network.addListener('networkStatusChange', status => {
        this._networkStatus.next(status.connected);
      });
    }
    
    // Initialize native features
    this.initializeNativeFeatures();
    
    this._appReady.next(true);
  }

  private initializeNativeFeatures() {
    if (Capacitor.isNativePlatform()) {
      // Hide splash screen
      SplashScreen.hide();
      
      // Set status bar
      if (this.platform.is('android')) {
        StatusBar.setStyle({ style: Style.Dark });
        StatusBar.setBackgroundColor({ color: '#3880ff' });
      }
      
      // Handle back button
      App.addListener('backButton', () => {
        // Custom back button behavior can be implemented here
      });
    }
  }

  get appReady(): Observable<boolean> {
    return this._appReady.asObservable();
  }

  get darkMode(): Observable<boolean> {
    return this._darkMode.asObservable();
  }

  get networkStatus(): Observable<boolean> {
    return this._networkStatus.asObservable();
  }

  async toggleDarkMode(): Promise<boolean> {
    const newValue = !this._darkMode.value;
    this._darkMode.next(newValue);
    this.applyTheme(newValue);
    if (this._storage) {
      await this._storage.set('darkMode', newValue);
    }
    return newValue;
  }

  private applyTheme(dark: boolean) {
    document.body.classList.toggle('dark', dark);
  }

  async getAppInfo(): Promise<any> {
    if (Capacitor.isNativePlatform()) {
      const info = await App.getInfo();
      return info;
    }
    return {
      name: 'Algerian Services Marketplace',
      version: '1.0.0',
      build: '1',
      platform: this.platform.platforms().join(', ')
    };
  }

  async exitApp() {
    if (Capacitor.isNativePlatform()) {
      App.exitApp();
    }
  }

  async getStorageItem(key: string): Promise<any> {
    return this._storage?.get(key);
  }

  async setStorageItem(key: string, value: any): Promise<void> {
    return this._storage?.set(key, value);
  }

  async removeStorageItem(key: string): Promise<void> {
    return this._storage?.remove(key);
  }

  async clearStorage(): Promise<void> {
    return this._storage?.clear();
  }
}
