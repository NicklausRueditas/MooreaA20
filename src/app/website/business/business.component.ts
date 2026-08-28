import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { BusinessHeaderComponent } from './components/business-header/business-header.component';

@Component({
  selector: 'app-business',
  standalone: true,
  imports: [CommonModule, RouterOutlet, BusinessHeaderComponent],
  templateUrl: './business.component.html',
})
export class BusinessComponent {}
