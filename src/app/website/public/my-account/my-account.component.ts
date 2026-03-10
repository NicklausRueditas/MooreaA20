import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { SesionService } from '../../../core/services/auth/sesion.service';

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [RouterOutlet, RouterLink, AsyncPipe],
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.css',
})
export class MyAccountComponent {
  user$ = this.sesionService.user$;
  imageError = false;

  constructor(private sesionService: SesionService) { }

  onImageError(): void {
    this.imageError = true;
  }
}
