import { redirect } from "next/navigation";

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ dato?: string }>;
}) {
  const { dato } = await searchParams;
  redirect(dato ? `/min-dag?dato=${dato}` : "/min-dag");
}
