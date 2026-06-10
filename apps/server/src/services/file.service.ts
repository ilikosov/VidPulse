import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { AppError } from '../middleware/AppError';
import { fileRepository, videoRepository } from '../repositories/knex.repositories';
import type { FileWithVideo } from '../interfaces/repositories';

/**
 * A YouTube video id is exactly 11 chars of [A-Za-z0-9_-]. Files are named
 * `<id><separator><rest>` (or just `<id>.<ext>`), so we take the first 11
 * id-chars when followed by a separator or end of string. `_`/`-` are valid
 * id chars but, since the id is fixed at 11 chars, anything after position 11
 * is a separator. The DB lookup in linkAllByYoutubeId filters false positives.
 */
const YOUTUBE_ID_PREFIX = /^([A-Za-z0-9_-]{11})(?:[ ._\-[\]()]|$)/;

export interface ScanResult {
  scanned: number;
  linked: number;
  errors: string[];
}

export class FileService {
  /** Extracts the leading youtube_id from a filename, or null if it doesn't match. */
  extractYoutubeId(filename: string): string | null {
    return YOUTUBE_ID_PREFIX.exec(filename)?.[1] ?? null;
  }

  /**
   * Scans the configured input directory, upserts a row per file, and links
   * files to videos by their youtube_id prefix.
   */
  async scan(): Promise<ScanResult> {
    const dir = config.files.inputDir;
    if (!dir) {
      throw AppError.badRequest('FILES_INPUT_DIR is not configured');
    }
    if (!fs.existsSync(dir)) {
      throw AppError.badRequest(`Input directory does not exist: ${dir}`);
    }

    const errors: string[] = [];
    let scanned = 0;

    const allowedExts = config.files.filter;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filename = entry.name;
      if (allowedExts) {
        const ext = path.extname(filename).replace(/^\./, '').toLowerCase();
        if (!allowedExts.includes(ext) || !ext) continue;
      }
      try {
        const fullPath = path.join(dir, filename);
        const stat = fs.statSync(fullPath);
        await fileRepository.upsert({
          filename,
          directory: dir,
          extension: path.extname(filename) || null,
          size_bytes: stat.size,
          youtube_id: this.extractYoutubeId(filename),
          video_id: null,
        });
        scanned += 1;
      } catch (err) {
        errors.push(`${filename}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const linked = await fileRepository.linkAllByYoutubeId();
    return { scanned, linked, errors };
  }

  async getFiles(params?: { videoId?: number; page?: number; limit?: number }): Promise<{
    files: FileWithVideo[];
    total: number;
  }> {
    return fileRepository.getAll(params);
  }

  async getFile(id: number): Promise<FileWithVideo> {
    const file = await fileRepository.getById(id);
    if (!file) throw AppError.notFound('File not found');
    return file;
  }

  /** Manually link (or unlink) a file to a video. */
  async linkVideo(fileId: number, videoId: number | null): Promise<FileWithVideo> {
    await this.getFile(fileId);
    if (videoId != null) {
      const video = await videoRepository.findById(videoId);
      if (!video) throw AppError.badRequest('Video not found');
    }
    await fileRepository.linkVideo(fileId, videoId);
    return this.getFile(fileId);
  }

  /** Removes the file record (not the file on disk). */
  async deleteFile(id: number): Promise<void> {
    await this.getFile(id);
    await fileRepository.deleteById(id);
  }
}

export const fileService = new FileService();
