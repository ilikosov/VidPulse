export interface ImageProps {
  width?: number | string;
  height?: number | string;
  alt?: string;
  src?: string;
}

/** Placeholder-first Image: renders the real <img> once src resolves, an icon slot until then. */
export function Image({ width = '100%', height, alt = '', src }: ImageProps) {
  if (src)
    return (
      <img
        src={src}
        alt={alt}
        style={{ width, height, objectFit: 'cover', borderRadius: 12, display: 'block' }}
      />
    );
  return (
    <div
      className="kp-img"
      style={{ width, height: height ?? '100%', aspectRatio: height ? undefined : '16 / 9' }}
    >
      <svg
        viewBox="0 0 24 24"
        width={28}
        height={28}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 5h16v14H4z" />
        <path d="M4 16l5-5 4 4 3-3 4 4" />
        <path d="M9 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    </div>
  );
}
