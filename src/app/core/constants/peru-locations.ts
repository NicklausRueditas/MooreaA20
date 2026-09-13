/**
 * @deprecated Los datos geográficos se migraron a assets/data/peru-locations.json
 * y se cargan de forma asíncrona mediante LocationsService para aligerar el bundle de la app.
 */
export { Location, LocationsService } from '../services/utils/locations.service';
export const PERU_LOCATIONS: import('../services/utils/locations.service').Location[] = [];
