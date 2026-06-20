export interface User {
  _id: string;
  displayName: string;
  email: string;
  profilePicture: string;
  roles: string[];
  phone: string;
  dni: string;
  addresses: string[]; // ObjectId como string
  cards: string[]; // ObjectId como string
}
