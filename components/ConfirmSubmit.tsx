"use client";

export function ConfirmSubmit({
  message,
  children,
  variant = "secondary",
}: {
  message: string;
  children: string;
  variant?: "secondary" | "danger";
}) {
  const className =
    variant === "danger"
      ? "inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-[#7c2f2a] hover:bg-paper"
      : "inline-flex items-center justify-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:bg-paper";
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
