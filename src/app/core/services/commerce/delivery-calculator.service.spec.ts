import { TestBed } from '@angular/core/testing';

import { DeliveryCalculatorService } from './delivery-calculator.service';

describe('DeliveryCalculatorService', () => {
  let service: DeliveryCalculatorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DeliveryCalculatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
