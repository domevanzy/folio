export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Notebooks werden geladen …</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="mx-auto flex h-24 max-w-[1380px] items-center justify-between px-6 md:px-12">
          <div className="h-8 w-24 rounded-lg bg-[var(--border)]" />
          <div className="size-9 rounded-full bg-[var(--border)]" />
        </div>
        <div className="mx-auto max-w-[1284px] px-6 pb-12 md:px-12">
          <div className="mb-6 mt-4 h-8 w-48 rounded-lg bg-[var(--border)]" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((card) => (
              <div key={card} className="panel space-y-4 p-5">
                <div className="size-10 rounded-xl bg-[var(--border)]" />
                <div className="h-5 w-3/4 rounded bg-[var(--border)]" />
                <div className="h-3 w-1/2 rounded bg-[var(--border)]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
