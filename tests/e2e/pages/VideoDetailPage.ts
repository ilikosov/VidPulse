import { expect, type Page } from '@playwright/test';

export class VideoDetailPage {
  constructor(private readonly page: Page) {}

  async goto(id: number) {
    await this.page.goto(`/videos/${id}`);
    await expect(this.page.getByRole('button', { name: 'Edit' })).toBeVisible();
  }

  async editMetadata(data: {
    perfDate: string;
    group: string;
    artist: string;
    song: string;
    event: string;
    camera: string;
  }) {
    await this.page.getByRole('button', { name: 'Edit' }).click();
    await this.page.getByPlaceholder('e.g., 240315').fill(data.perfDate);
    await this.page.getByPlaceholder('Enter group name').fill(data.group);
    await this.page.getByPlaceholder('Enter artist name').fill(data.artist);
    await this.page.getByPlaceholder('Enter song title').fill(data.song);
    await this.page.getByPlaceholder('Enter event').fill(data.event);
    await this.page.locator('.ant-form-item').filter({ hasText: 'Camera Type' }).locator('input').fill(data.camera);
    await this.page.getByRole('button', { name: 'Save Changes' }).click();
  }
}
