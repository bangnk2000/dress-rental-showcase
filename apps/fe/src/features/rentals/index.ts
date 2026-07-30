/**
 * PUBLIC SURFACE of the rentals feature. Export names are the contract with
 * app/router.tsx. NewRentalRoute is live (rentals/create-rental); the LIST
 * route stays a shell until a rentals read slice ships.
 */
export { RentalsRoute } from './rentals-route';
export { NewRentalRoute } from './new-rental-route';
