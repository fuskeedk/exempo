import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Exempo</p>
      <h1 className="mt-3 font-serif text-4xl">Ikke fundet</h1>
      <p className="mt-2 text-muted">Siden eller sagen findes ikke — eller du har ikke adgang.</p>
      <Link href="/" className="mt-6 inline-block rounded-full bg-rust px-4 py-2 text-sm font-semibold text-white">
        Til tavlen
      </Link>
    </div>
  );
}
