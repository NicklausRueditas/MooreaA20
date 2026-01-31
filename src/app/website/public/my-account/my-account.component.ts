import { Component } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-my-account',
  standalone: true,
  imports: [RouterOutlet,RouterLink],
  templateUrl: './my-account.component.html',
  styleUrl: './my-account.component.css',
})
export class MyAccountComponent {
  selectedTab: string = 'perfil'; // 📌 Tab activa por defecto

  /** 🔄 Cambia la pestaña activa */
  setTab(tab: string) {
    this.selectedTab = tab;
  }
}
