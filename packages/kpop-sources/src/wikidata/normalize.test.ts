import { describe, expect, it } from 'vitest';
import { normalizeGroups, normalizeSongs } from './normalize';
import type { SparqlBinding } from './queries';

function row(fields: Record<string, { value: string; lang?: string }>): SparqlBinding {
  const b: SparqlBinding = {};
  for (const [k, v] of Object.entries(fields)) {
    b[k] = { type: 'literal', value: v.value, ...(v.lang ? { 'xml:lang': v.lang } : {}) };
  }
  return b;
}

describe('normalizeGroups', () => {
  it('folds (group, member) rows into deduped groups with ko aliases and type', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        groupEn: { value: 'IVE', lang: 'en' },
        groupKo: { value: '아이브', lang: 'ko' },
        typeClass: { value: 'http://www.wikidata.org/entity/Q641066' }, // girl group
        member: { value: 'http://www.wikidata.org/entity/Q111' },
        memberEn: { value: 'Wonyoung', lang: 'en' },
        memberKo: { value: '장원영', lang: 'ko' },
      }),
      // Same group, second member.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        groupEn: { value: 'IVE', lang: 'en' },
        member: { value: 'http://www.wikidata.org/entity/Q222' },
        memberEn: { value: 'Liz', lang: 'en' },
      }),
      // Duplicate member row must be ignored.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        member: { value: 'http://www.wikidata.org/entity/Q111' },
        memberEn: { value: 'Wonyoung', lang: 'en' },
      }),
    ];

    const groups = normalizeGroups(bindings);
    expect(groups).toHaveLength(1);
    const ive = groups[0];
    expect(ive.name).toBe('IVE');
    expect(ive.type).toBe('female');
    expect(ive.active).toBe(true);
    expect(ive.aliases).toEqual(['아이브']);
    expect(ive.artists?.map((a) => a.name)).toEqual(['Wonyoung', 'Liz']);
    expect(ive.artists?.[0].aliases).toEqual(['장원영']);
    expect(ive.artists?.[0].membership).toEqual({
      activityType: 'group',
      status: 'active',
      isPrimary: true,
    });
    // Liz has no Korean label → no aliases key.
    expect(ive.artists?.[1].aliases).toBeUndefined();
  });

  it('prefers the stage name (P742) over the legal label and keeps labels as aliases', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q56806097' },
        groupEn: { value: 'Itzy', lang: 'en' },
        groupKo: { value: '있지', lang: 'ko' },
        typeClass: { value: 'http://www.wikidata.org/entity/Q641066' },
        member: { value: 'http://www.wikidata.org/entity/Q60221103' },
        memberEn: { value: 'Hwang Ye-ji', lang: 'en' }, // legal name as the English label
        memberKo: { value: '황예지', lang: 'ko' },
        memberStageEn: { value: 'Yeji', lang: 'en' }, // P742 stage name
        memberStageKo: { value: '예지', lang: 'ko' },
      }),
    ];

    const [itzy] = normalizeGroups(bindings);
    const yeji = itzy.artists?.[0];
    expect(yeji?.name).toBe('Yeji'); // stage name wins
    // Legal name + both Korean labels survive as aliases (order: stage-ko, legal-en, label-ko).
    expect(yeji?.aliases).toEqual(['예지', 'Hwang Ye-ji', '황예지']);
  });

  it('marks a group inactive when a dissolution date is present', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q500' },
        groupEn: { value: '2NE1', lang: 'en' },
        typeClass: { value: 'http://www.wikidata.org/entity/Q641066' },
        dissolved: { value: '2016-11-25T00:00:00Z' },
        member: { value: 'http://www.wikidata.org/entity/Q9' },
        memberEn: { value: 'CL', lang: 'en' },
      }),
    ];
    const [group] = normalizeGroups(bindings);
    expect(group.active).toBe(false);
  });

  it('maps the boy-band classification to type male', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q300' },
        groupEn: { value: 'BTS', lang: 'en' },
        typeClass: { value: 'http://www.wikidata.org/entity/Q216337' }, // boy band
        member: { value: 'http://www.wikidata.org/entity/Q7' },
        memberEn: { value: 'RM', lang: 'en' },
      }),
    ];
    const [group] = normalizeGroups(bindings);
    expect(group.type).toBe('male');
  });

  it('defaults type to mixed and falls back to Korean/QID names', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q700' },
        groupKo: { value: '카드', lang: 'ko' }, // only Korean label
      }),
    ];
    const [group] = normalizeGroups(bindings);
    expect(group.name).toBe('카드'); // ko fallback as name
    expect(group.type).toBe('mixed');
    expect(group.active).toBe(true);
    expect(group.aliases).toBeUndefined(); // ko used as name, not duplicated as alias
    expect(group.artists).toEqual([]);
  });

  it('attaches Wikidata songs to the matching group by URI', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        groupEn: { value: 'IVE', lang: 'en' },
        member: { value: 'http://www.wikidata.org/entity/Q111' },
        memberEn: { value: 'Wonyoung', lang: 'en' },
      }),
    ];
    const songsByGroup = normalizeSongs([
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        song: { value: 'http://www.wikidata.org/entity/Q1' },
        songEn: { value: 'Love Dive', lang: 'en' },
        songKo: { value: '러브 다이브', lang: 'ko' },
      }),
      // Different group → must not leak into IVE.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q999' },
        song: { value: 'http://www.wikidata.org/entity/Q2' },
        songEn: { value: 'Some Other Song', lang: 'en' },
      }),
    ]);

    const [ive] = normalizeGroups(bindings, songsByGroup);
    expect(ive.songs).toEqual([{ title: 'Love Dive', aliases: ['러브 다이브'] }]);
  });

  it('normalizeSongs dedupes per group, keeps ko as alias, and skips label-less songs', () => {
    const map = normalizeSongs([
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        song: { value: 'http://www.wikidata.org/entity/Q1' },
        songEn: { value: 'Eleven', lang: 'en' },
        songKo: { value: '일레븐', lang: 'ko' },
      }),
      // Duplicate title (case-insensitive) for the same group → ignored.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        song: { value: 'http://www.wikidata.org/entity/Q1b' },
        songEn: { value: 'ELEVEN', lang: 'en' },
      }),
      // Korean-only label → title falls back to ko, no alias.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        song: { value: 'http://www.wikidata.org/entity/Q3' },
        songKo: { value: '키치', lang: 'ko' },
      }),
      // No label at all → skipped.
      row({
        group: { value: 'http://www.wikidata.org/entity/Q24489' },
        song: { value: 'http://www.wikidata.org/entity/Q4' },
      }),
    ]);

    expect(map.get('http://www.wikidata.org/entity/Q24489')).toEqual([
      { title: 'Eleven', aliases: ['일레븐'] },
      { title: '키치', aliases: [] },
    ]);
  });

  it('skips members without any label and groups without a name', () => {
    const bindings: SparqlBinding[] = [
      row({
        group: { value: 'http://www.wikidata.org/entity/Q800' },
        groupEn: { value: 'NewJeans', lang: 'en' },
        member: { value: 'http://www.wikidata.org/entity/Q1' }, // no labels → skipped
      }),
    ];
    const [group] = normalizeGroups(bindings);
    expect(group.name).toBe('NewJeans');
    expect(group.artists).toEqual([]);
  });
});
