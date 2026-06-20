export interface Card {
    _id?: string;
    cardNumber: string; // Typically masked in response, full in creation
    cardHolder: string;
    expirationDate: string; // Format: MM/YY
    cardType: string; // Visa, Mastercard, etc.
    cvv?: string; // Optional in response, required for creation
    userId?: string;
    createdAt?: string;
    updatedAt?: string;
}

export interface CreateCardDto {
    cardNumber: string;
    cardHolder: string;
    expirationDate: string;
    cardType: string;
    cvv: string;
}

export interface UpdateCardDto {
    cardHolder?: string;
    expirationDate?: string;
    // Add other updateable fields if API supports them
}

export interface CardResponse {
    success: boolean;
    message?: string;
    card?: Card;
    cards?: Card[];
}
