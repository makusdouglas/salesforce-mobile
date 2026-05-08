import { DataLayerError } from '../types';

export { DataLayerError };

export function throwValidation(message: string, field?: string): never {
  throw new DataLayerError('VALIDATION', message, field);
}

export function throwNotFound(entity: string, id: string): never {
  throw new DataLayerError('NOT_FOUND', `${entity} with id "${id}" not found`);
}

export function throwStateTransition(entity: string, from: string, to: string): never {
  throw new DataLayerError(
    'STATE_TRANSITION',
    `Invalid ${entity} status transition: ${from} → ${to}`,
  );
}

export function throwForeignKey(entity: string, refEntity: string, refId: string): never {
  throw new DataLayerError(
    'FOREIGN_KEY',
    `${entity} references ${refEntity} "${refId}" which does not exist`,
  );
}
