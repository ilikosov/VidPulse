export function Empty({ description = 'Ничего не найдено' }: { description?: string }) {
  return (
    <div className="kp-empty">
      <svg
        viewBox="0 0 24 24"
        width={44}
        height={44}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-5 9 5-9 5-9-5Z" />
        <path d="M3 9v7l9 5 9-5V9M12 14v5" />
      </svg>
      <div className="kp-empty-text">{description}</div>
    </div>
  );
}
