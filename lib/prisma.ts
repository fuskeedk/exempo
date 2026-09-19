import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./data/exempo.db";
  if (!raw.startsWith("file:")) return raw;
  const without = raw.slice("file:".length);
  if (path.isAbsolute(without) || /^[A-Za-z]:[\\/]/.test(without)) {
    return `file:${without.replaceAll("\\", "/")}`;
  }
  return `file:${path.resolve(process.cwd(), without).replaceAll("\\", "/")}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
