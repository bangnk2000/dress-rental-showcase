/**
 * Handler registry — one line per OpenAPI tag, mirroring src/api/generated.
 * Feature agents add handlers in their own tag file, not here.
 */
import { catalogHandlers } from './catalog';
import { identityHandlers } from './identity';

export const handlers = [...identityHandlers, ...catalogHandlers];
