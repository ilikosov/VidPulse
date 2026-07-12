import ffmpeg from 'fluent-ffmpeg';

export interface VideoDimensions {
  width: number;
  height: number;
}

/**
 * Probes a video file's pixel dimensions via ffprobe. Resolves null (never throws) when the
 * ffmpeg/ffprobe binary is missing, the file has no video stream, or probing otherwise fails —
 * a single bad/unsupported file must never abort a scan or link batch.
 */
export function probeDimensions(filePath: string): Promise<VideoDimensions | null> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return resolve(null);
      const stream = data.streams?.find((s) => s.codec_type === 'video');
      if (!stream?.width || !stream?.height) return resolve(null);
      resolve({ width: stream.width, height: stream.height });
    });
  });
}
