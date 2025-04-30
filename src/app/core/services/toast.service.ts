import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toastController: ToastController) {}

  async showSuccess(message: string, duration: number = 2000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'success',
      position: 'bottom',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async showError(message: string, duration: number = 3000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'danger',
      position: 'bottom',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async showInfo(message: string, duration: number = 2000) {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'primary',
      position: 'bottom',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  async showWarning(message: string, duration: number = 2500) {
    const toast = await this.toastController.create({
      message,
      duration,
      color: 'warning',
      position: 'bottom',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }
}
