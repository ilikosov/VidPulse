import { describe, expect, it } from 'vitest';
import {
  validateMediaLibraryBusinessRules,
  validateMediaLibraryPayload,
} from './mediaLibrarySchema.service';

function createValidPayload() {
  return {
    version: 1,
    mode: 'merge',
    groups: [
      {
        name: 'LE SSERAFIM',
        type: 'female',
        artists: [
          {
            name: 'YUNJIN',
            membership: {
              activityType: 'group',
              status: 'active',
            },
            songs: [{ title: 'HOT', aliases: [] }],
          },
        ],
        songs: [{ title: 'EASY', aliases: [] }],
      },
    ],
    soloArtists: [
      {
        name: 'SOMI',
        membership: {
          activityType: 'solo',
          status: 'active',
        },
        songs: [{ title: 'DUMB DUMB', aliases: [] }],
      },
    ],
    events: [{ name: 'KYUNGIL UNIVERSITY FESTIVAL', aliases: ['경일대'] }],
  };
}

describe('mediaLibrarySchema service', () => {
  it('passes valid hierarchical JSON', () => {
    const result = validateMediaLibraryPayload(createValidPayload());
    expect(result).toEqual({ valid: true });
  });

  it('fails for top-level songs[]', () => {
    const payload = { ...createValidPayload(), songs: [{ title: 'NOPE', aliases: [] }] };
    const result = validateMediaLibraryPayload(payload);

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes('must NOT have additional properties'))).toBe(
        true,
      );
    }
  });

  it('fails for unknown extra property', () => {
    const payload = {
      ...createValidPayload(),
      groups: [{ ...createValidPayload().groups[0], unexpectedField: true }],
    };
    const result = validateMediaLibraryPayload(payload);

    expect(result.valid).toBe(false);
  });

  it('fails when solo artist has activityType="group"', () => {
    const payload = createValidPayload();
    payload.soloArtists[0].membership.activityType = 'group';

    const result = validateMediaLibraryBusinessRules(payload);
    expect(result.valid).toBe(false);
  });

  it('fails when group artist has activityType="solo"', () => {
    const payload = createValidPayload();
    payload.groups[0].artists[0].membership.activityType = 'solo';

    const result = validateMediaLibraryBusinessRules(payload);
    expect(result.valid).toBe(false);
  });
});
