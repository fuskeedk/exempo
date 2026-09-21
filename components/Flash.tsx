export function Flash({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mb-6 rounded-xl bg-[#e7efe8] px-4 py-3 text-sm text-[#1f4a3a]">{message}</p>
  );
}

export function ErrorFlash({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mb-6 rounded-xl bg-[#f3d7d4] px-4 py-3 text-sm text-[#7c2f2a]">{message}</p>
  );
}
