import type { NormalizedAlert } from '@ewm/alerts-schema';

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireRecord(value: unknown, label: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

export function requireTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label);
  if (Number.isNaN(Date.parse(timestamp))) throw new Error(`${label} must be a timestamp`);
  return timestamp;
}

function validPosition(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
  );
}

function validRing(value: unknown): boolean {
  return Array.isArray(value) && value.length >= 4 && value.every(validPosition);
}

function validPolygonCoordinates(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0 && value.every(validRing);
}

export function requirePolygonGeometry(
  value: unknown,
  label: string,
): NonNullable<NormalizedAlert['geometry']> {
  const geometry = requireRecord(value, label);
  if (geometry.type === 'Polygon' && validPolygonCoordinates(geometry.coordinates)) {
    return geometry as unknown as NonNullable<NormalizedAlert['geometry']>;
  }
  if (
    geometry.type === 'MultiPolygon' &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length > 0 &&
    geometry.coordinates.every(validPolygonCoordinates)
  ) {
    return geometry as unknown as NonNullable<NormalizedAlert['geometry']>;
  }
  throw new Error(`${label} must be a valid Polygon or MultiPolygon`);
}

export function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}
