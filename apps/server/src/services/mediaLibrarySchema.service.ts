import fs from 'fs';
import path from 'path';
import Ajv2020, { type ErrorObject } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';

type ValidationResult = { valid: true } | { valid: false; errors: string[] };

const schemaPath = path.resolve(__dirname, '../../../../schemas/media-library.schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
});
addFormats(ajv);

const validate = ajv.compile(schema);

function formatAjvError(error: ErrorObject): string {
  const pathValue = error.instancePath || '/';
  return `${pathValue} ${error.message ?? 'is invalid'}`;
}

export function validateMediaLibraryPayload(payload: unknown): ValidationResult {
  const valid = validate(payload);

  if (valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: (validate.errors ?? []).map(formatAjvError),
  };
}

export function validateMediaLibraryBusinessRules(payload: unknown): ValidationResult {
  const baseValidation = validateMediaLibraryPayload(payload);
  if (!baseValidation.valid) {
    return baseValidation;
  }

  const errors: string[] = [];
  const data = payload as Record<string, unknown>;

  const mode = (data.mode as string | undefined) ?? 'merge';
  if (mode !== 'merge' && mode !== 'replace') {
    errors.push('/mode must be equal to one of the allowed values: merge, replace');
  }

  const groups = Array.isArray(data.groups) ? data.groups : [];
  groups.forEach((group, groupIndex) => {
    const groupData = group as Record<string, unknown>;

    // TODO(2026-05-15): Check if group exists in DB in import service. If group does not exist, group.type is required.
    const artists = Array.isArray(groupData.artists) ? groupData.artists : [];
    artists.forEach((artist, artistIndex) => {
      const membership = (artist as Record<string, unknown>).membership as
        | Record<string, unknown>
        | undefined;
      if (membership?.activityType === 'solo') {
        errors.push(
          `/groups/${groupIndex}/artists/${artistIndex}/membership/activityType cannot be "solo" for group artist`,
        );
      }
    });
  });

  const soloArtists = Array.isArray(data.soloArtists) ? data.soloArtists : [];
  soloArtists.forEach((artist, artistIndex) => {
    const membership = (artist as Record<string, unknown>).membership as
      | Record<string, unknown>
      | undefined;
    if (membership?.activityType === 'group') {
      errors.push(
        `/soloArtists/${artistIndex}/membership/activityType cannot be "group" for solo artist`,
      );
    }
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
