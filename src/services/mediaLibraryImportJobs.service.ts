import { randomUUID } from 'crypto';
import { MediaLibraryImportSummary } from './dictionary.service';

export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface ImportJobProgress {
  jobId: string;
  status: ImportJobStatus;
  phase:
    | 'queued'
    | 'validating'
    | 'clearing'
    | 'groups'
    | 'artists'
    | 'songs'
    | 'events'
    | 'completed'
    | 'failed';
  processed: number;
  total: number;
  percent: number;
  message?: string;
  error?: string;
  summary?: MediaLibraryImportSummary;
  createdAt: string;
  updatedAt: string;
}

class MediaLibraryImportJobsService {
  private jobs = new Map<string, ImportJobProgress>();
  private readonly ttlMs = 60 * 60 * 1000;

  createJob(total = 0): ImportJobProgress {
    this.cleanupOldJobs();
    const now = new Date().toISOString();
    const job: ImportJobProgress = {
      jobId: randomUUID(),
      status: 'queued',
      phase: 'queued',
      processed: 0,
      total,
      percent: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.jobId, job);
    return job;
  }

  getJob(jobId: string) {
    this.cleanupOldJobs();
    return this.jobs.get(jobId);
  }

  updateJob(jobId: string, patch: Partial<Omit<ImportJobProgress, 'jobId' | 'createdAt'>>) {
    const current = this.jobs.get(jobId);
    if (!current) return;
    const processed = patch.processed ?? current.processed;
    const total = patch.total ?? current.total;
    const percent =
      total > 0
        ? Math.min(100, Math.round((processed / total) * 100))
        : (patch.percent ?? current.percent);
    this.jobs.set(jobId, {
      ...current,
      ...patch,
      processed,
      total,
      percent,
      updatedAt: new Date().toISOString(),
    });
  }

  completeJob(jobId: string, summary: MediaLibraryImportSummary) {
    this.updateJob(jobId, {
      status: 'completed',
      phase: 'completed',
      summary,
      percent: 100,
      message: 'Import completed',
    });
  }

  failJob(jobId: string, error: string) {
    this.updateJob(jobId, { status: 'failed', phase: 'failed', error, message: 'Import failed' });
  }

  cleanupOldJobs() {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - new Date(job.updatedAt).getTime() > this.ttlMs) this.jobs.delete(id);
    }
  }
}

export const mediaLibraryImportJobsService = new MediaLibraryImportJobsService();
