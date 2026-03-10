import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { User } from '../../interfaces/user.interface';
import { AuthService } from './auth.service';

/**
 * SesionService - Facade for AuthService
 * 
 * This service is now a simple wrapper around AuthService.
 * All authentication and session management is handled by AuthService.
 * This facade exists for backward compatibility with existing components.
 * 
 * @deprecated Consider using AuthService directly for new code
 */
@Injectable({
  providedIn: 'root'
})
export class SesionService {
  constructor(private authService: AuthService) { }

  /**
   * Get user observable (delegates to AuthService)
   */
  get user$(): Observable<User | null> {
    return this.authService.user$;
  }

  /**
   * Get user profile (delegates to AuthService)
   */
  getProfile(): Observable<User | null> {
    return this.authService.getProfile();
  }

  /**
   * Update user profile (delegates to AuthService)
   */
  updateProfile(data: Partial<User>): Observable<User> {
    return this.authService.updateProfile(data);
  }

  /**
   * Delete user profile (delegates to AuthService)
   */
  deleteProfile(): Observable<void> {
    return this.authService.deleteProfile();
  }

  /**
   * Ensure profile is loaded (delegates to AuthService.getProfile)
   * @deprecated Use getProfile() instead
   */
  ensureProfileLoaded(): Observable<User | null> {
    return this.authService.getProfile();
  }
}