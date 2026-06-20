export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000',
  payment: {
    gateway: 'niubiz' as const,
    sandboxMode: true,           // true mientras se usa sandbox de Niubiz
  },
};
