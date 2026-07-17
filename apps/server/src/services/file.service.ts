import fs from 'fs';
import path from 'path';
import { config } from '../config';
import { AppError } from '../middleware/AppError';
import { fileRepository, videoRepository } from '@vidpulse/db';
import type { FileEntity, FileWithVideo } from '@vidpulse/db';
import { probeDimensions } from './file-probe.service';
import { bufferToDataUri, generateThumbnailBuffers } from './file-thumbnail.service';
import { videoService } from './video.service';
import { renderTemplate } from './template/template.engine';
import { buildVideoContext } from './template/videoContext';

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
  probed: number;
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
    const { probed } = await this.probeUnprobedFiles();
    return { scanned, linked, probed, errors };
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

  /** `getFile` plus a preview of the name this file would get renamed to (null when the file
   * isn't linked to a video, or no RENAME_TEMPLATE_VIDEO is configured). Mirrors the exact
   * base-name computation `video.service.ts::renameFiles` uses for the real rename. */
  async getFileDetails(id: number): Promise<FileWithVideo & { predicted_filename: string | null }> {
    const file = await this.getFile(id);
    const template = config.files.renameTemplate;
    if (file.video_id == null || !template) {
      return { ...file, predicted_filename: null };
    }
    const video = await videoService.getVideoById(file.video_id);
    const baseName = renderTemplate(template, { video: [buildVideoContext(video)] })
      .replace(/\//g, '-')
      .trim();
    return { ...file, predicted_filename: baseName ? baseName + (file.extension ?? '') : null };
  }

  /** Manually link (or unlink) a file to a video. */
  async linkVideo(fileId: number, videoId: number | null): Promise<FileWithVideo> {
    const file = await this.getFile(fileId);
    if (videoId != null) {
      const video = await videoRepository.findById(videoId);
      if (!video) throw AppError.badRequest('Video not found');
    }
    await fileRepository.linkVideo(fileId, videoId);
    if (videoId != null && file.width == null) {
      await this.probeAndPersist(file);
    }
    return this.getFile(fileId);
  }

  private async probeAndPersist(file: FileEntity): Promise<boolean> {
    const dims = await probeDimensions(path.join(file.directory, file.filename));
    if (!dims) return false;
    await fileRepository.updateDimensions(file.id, dims.width, dims.height);
    return true;
  }

  /** Probes every linked file that hasn't been probed yet (called after scan's bulk auto-link). */
  async probeUnprobedFiles(): Promise<{ probed: number }> {
    const files = await fileRepository.getUnprobedLinked();
    let probed = 0;
    for (const file of files) {
      if (await this.probeAndPersist(file)) probed++;
    }
    return { probed };
  }

  /** Previously-generated preview frames from storage as base64 data URIs. `[]` until previews
   * have been generated for this file (via `generatePreviews`) — reading never touches ffmpeg. */
  async getThumbnails(id: number): Promise<string[]> {
    const images = await fileRepository.getPreviews(id);
    return images.map(bufferToDataUri);
  }

  /**
   * Generate preview frames from the video on disk and store them (replacing any earlier set),
   * then return them as base64 data URIs. Throws 404 if the file record is unknown and 400 if the
   * file is not present on disk. Stores nothing when ffmpeg yields no frames (bad/unreadable file).
   */
  async generatePreviews(id: number): Promise<string[]> {
    const file = await this.getFile(id);
    const fullPath = path.join(file.directory, file.filename);
    if (!fs.existsSync(fullPath)) {
      throw AppError.badRequest('File is not available on disk');
    }
    const images = await generateThumbnailBuffers(fullPath);
    await fileRepository.replacePreviews(id, images);
    return images.map(bufferToDataUri);
  }

  /** Removes the file record (not the file on disk). */
  async deleteFile(id: number): Promise<void> {
    await this.getFile(id);
    await fileRepository.deleteById(id);
  }
}

export const fileService = new FileService();
