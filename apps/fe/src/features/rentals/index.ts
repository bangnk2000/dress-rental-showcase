/**
 * PUBLIC SURFACE of the rentals feature. Export names are the contract with
 * app/router.tsx: the list (`/rentals`), the new-rental form (`/rentals/new`),
 * the rental detail (`/rentals/:id`, FR-RENT-12) and the owner's edit form
 * (`/rentals/:id/edit`, FR-RENT-13).
 */
export { RentalsRoute } from './rentals-route';
export { NewRentalRoute } from './new-rental-route';
export { RentalDetailRoute } from './rental-detail-route';
export { EditRentalRoute } from './edit-rental-route';
