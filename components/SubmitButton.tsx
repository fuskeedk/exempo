"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-rust text-white hover:bg-[#9a4a2c]"
      : variant === "secondary"
        ? "border border-line bg-white text-ink hover:bg-paper"
        : "text-pine-2 hover:underline";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 ${styles}`}
    >
      {pending ? "Gemmer…" : children}
    </button>
  );
}
