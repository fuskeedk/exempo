"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Fejl</p>
      <h1 className="mt-3 font-serif text-3xl">Noget gik galt</h1>
      <p className="mt-3 text-muted">{error.message || "Prøv igen om et øjeblik."}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white"
      >
        Prøv igen
      </button>
    </div>
  );
}
