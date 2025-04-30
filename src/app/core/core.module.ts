import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { FirebaseModule } from './firebase.module';
import { AppStoreModule } from './store/store.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule,
    FirebaseModule,
    AppStoreModule
  ],
  exports: [
    HttpClientModule,
    FirebaseModule
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only.');
    }
  }
}
