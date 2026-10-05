export interface User {
  _id: string;
  displayName?: string;
  email: string;
  profilePicture?: string;
  roles: string[];
  phone?: string;
  dni?: string;
  ruc?: string;
  businessName?: string;
  fiscalAddress?: string;
  invoicePreference?: 'boleta' | 'factura';
  googleId?: string;
  isActive?: boolean;
  addresses?: string[];
  cards?: string[];
  createdAt?: string | Date;
  updatedAt?: string | Date;
  lastLogin?: string | Date;
  sellerProfiles?: any[];
}
