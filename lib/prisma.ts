import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL || "file:./prisma/dev.db";
  if (!raw.startsWith("file:")) return raw;
  const without = raw.slice("file:".length);
  if (path.isAbsolute(without) || /^[A-Za-z]:[\\/]/.test(without)) {
    return `file:${without.replaceAll("\\", "/")}`;
  }
  const fromCwd = path.resolve(process.cwd(), without);
  const fromPrisma = path.resolve(process.cwd(), "prisma", path.basename(without));
  const usable = (file: string) => existsSync(file) && statSync(file).size > 0;
  const chosen = usable(fromCwd) ? fromCwd : usable(fromPrisma) ? fromPrisma : fromCwd;
  return `file:${chosen.replaceAll("\\", "/")}`;
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatabaseUrl(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
