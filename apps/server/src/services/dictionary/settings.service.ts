import { knex } from '@vidpulse/db';

export class SettingsService {
  async getAllSettings() {
    const rows = await knex('settings').select('key', 'value');
    return rows.reduce<Record<string, string>>((acc, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async upsertSetting(key: string, value: string) {
    await knex('settings').insert({ key, value }).onConflict('key').merge({ value });
  }
}

export const settingsService = new SettingsService();
