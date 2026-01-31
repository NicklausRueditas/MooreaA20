// basket.interface.ts
export interface BasketItem {
  product: string | { _id: string; [key: string]: any };
  quantity: number;
}

export interface Basket {
  _id: string;
  userId: string;
  items: BasketItem[];
  createdAt: Date;
  updatedAt: Date;
  __v: number;
}