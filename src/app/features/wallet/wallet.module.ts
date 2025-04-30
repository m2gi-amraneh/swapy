import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Note: WalletComponent est maintenant un composant standalone
// et ne doit pas être déclaré dans ce module

@NgModule({
  declarations: [
    // WalletComponent est retiré des déclarations car c'est un composant standalone
  ],
  imports: [
    CommonModule,
    IonicModule,
    ReactiveFormsModule,
    RouterModule
  ],
  exports: [
    // WalletComponent est retiré des exports car c'est un composant standalone
  ]
})
export class WalletModule { }
