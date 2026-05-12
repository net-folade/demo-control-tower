type EmptyStateProps = {
  title?: string;
  message: string;
  hint?: string;
  error?: string | null;
};

export function EmptyState({ title, message, hint, error }: EmptyStateProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-6 py-5 flex flex-col gap-1.5">
      {title && (
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          {title}
        </p>
      )}
      <p className="text-neutral-300 text-sm">{message}</p>
      {hint && (
        <p className="text-neutral-500 font-mono text-xs">{hint}</p>
      )}
      {error && (
        <p className="text-rose-400/80 font-mono text-[11px] mt-1">
          {error}
        </p>
      )}
    </section>
  );
}
