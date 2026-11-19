import { Transform } from 'class-transformer';

/**
 * Shared transformer that trims string values during DTO validation.
 * Use as: @Transform(trim)
 */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Same as trim but also lowercases — for email fields.
 * Use as: @Transform(trimLower)
 */
export const trimLower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;
