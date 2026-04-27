import { expect, type Page } from '@playwright/test';

export class ReviewPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/review');
    await expect(this.page.getByRole('heading', { name: 'Review Queue' })).toBeVisible();
  }

  async fillAndSaveForVideo(title: string, values: {
    perfDate: string;
    group: string;
    artist: string;
    song: string;
    event: string;
    camera: string;
  }) {
    const card = this.page.locator('.ant-card', { hasText: title }).first();
    const inputs = card.locator('input');

    await inputs.nth(0).fill(values.perfDate);
    await inputs.nth(1).fill(values.group);
    await inputs.nth(2).fill(values.artist);
    await inputs.nth(3).fill(values.song);
    await inputs.nth(4).fill(values.event);
    await inputs.nth(5).fill(values.camera);

    await card.getByRole('button', { name: 'Save & Move to New' }).click();
  }
}
