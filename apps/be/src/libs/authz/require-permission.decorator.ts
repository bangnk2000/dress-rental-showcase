import { SetMetadata } from '@nestjs/common';
import { PermissionKey } from './authz.types';

export const PERMISSION_KEY = 'required_permission';

/** Declare the ABAC permission an endpoint needs, e.g. @RequirePermission('dress:create'). */
export const RequirePermission = (permission: PermissionKey) =>
  SetMetadata(PERMISSION_KEY, permission);
