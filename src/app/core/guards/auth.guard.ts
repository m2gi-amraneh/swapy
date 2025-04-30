import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, take, tap } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean> {
    return this.authService.user$.pipe(
      take(1),
      map(user => !!user),
      tap(isLoggedIn => {
        if (!isLoggedIn) {
          console.log('Accès refusé. Redirection vers la page de connexion.');
          this.router.navigate(['/auth/login'], {
            queryParams: { returnUrl: state.url }
          });
        }
      })
    );
  }
}