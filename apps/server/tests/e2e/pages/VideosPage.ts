import { expect, type Page } from '@playwright/test';

export class VideosPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/videos');
    await expect(this.page.getByRole('heading', { name: 'Video Library' })).toBeVisible();
  }

  async expectVideoVisible(title: string) {
    await expect(this.page.locator('tbody tr', { hasText: title })).toBeVisible();
  }

  async filterByStatus(statusLabel: string) {
    await this.page.locator('.ant-select').first().click();
    await this.page.getByText(statusLabel, { exact: true }).click();
  }

  async selectVideoByTitle(title: string) {
    const row = this.page.locator('tbody tr', { hasText: title });
    await row.locator('input[type="checkbox"]').check({ force: true });
  }

  async confirmDownloadSelected() {
    await this.page.getByRole('button', { name: 'Confirm Download Selected' }).click();
  }
}
