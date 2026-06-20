export const environment = {
  production: true,
  apiUrl: 'https://tu-api.com',  // ← cambiar por la URL de producción
  payment: {
    gateway: 'niubiz' as const,
    sandboxMode: false,          // false en producción
  },
};
