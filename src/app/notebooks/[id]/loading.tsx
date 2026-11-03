export default function Loading() {
  return (
    <div role="status">
      <span className="sr-only">Notebook wird geladen …</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        <div className="flex h-[89px] items-center justify-between gap-4 px-5 md:px-7">
          <div className="h-6 w-56 rounded bg-[var(--border)]" />
          <div className="size-9 shrink-0 rounded-lg bg-[var(--border)]" />
        </div>
        <div className="flex h-14 items-center gap-2 px-5 min-[1101px]:hidden">
          {[0, 1, 2].map((tab) => (
            <div
              key={tab}
              className="h-8 flex-1 rounded-lg bg-[var(--border)]"
            />
          ))}
        </div>
        <div className="workspace">
          <section className="panel flex flex-col gap-4 p-4">
            <div className="h-5 w-20 rounded bg-[var(--border)]" />
            <div className="h-9 rounded-lg bg-[var(--border)]" />
            <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
            <div className="h-4 w-2/3 rounded bg-[var(--border)]" />
          </section>
          <section className="panel mobile-active flex flex-col p-4">
            <div className="h-5 w-16 rounded bg-[var(--border)]" />
            <div className="mt-auto h-16 rounded-xl bg-[var(--border)]" />
          </section>
          <section className="panel flex flex-col gap-4 p-4">
            <div className="h-5 w-20 rounded bg-[var(--border)]" />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((tile) => (
                <div
                  key={tile}
                  className="h-12 rounded-lg bg-[var(--border)]"
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
