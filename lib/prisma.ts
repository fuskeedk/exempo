import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { decodeJwt } from "jose";
import { PrismaClient } from "@prisma/client";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { defaultTenantSlug, tenantDatabaseUrl } from "@/lib/platform";
import { SESSION_COOKIE } from "@/lib/session-token";

type TenantStore = { slug: string };

const tenantAls = new AsyncLocalStorage<TenantStore>();
const requestTenant = cache((): TenantStore => ({ slug: defaultTenantSlug() }));
const tenantByWorkUnit = new WeakMap<object, string>();

const globalForPrisma = globalThis as unknown as {
  prismaClients?: Map<string, PrismaClient>;
};

function clients(): Map<string, PrismaClient> {
  globalForPrisma.prismaClients ??= new Map();
  return globalForPrisma.prismaClients;
}

export function tenantPrisma(slug = defaultTenantSlug()): PrismaClient {
  const url = tenantDatabaseUrl(slug);
  const cacheMap = clients();
  const existing = cacheMap.get(url);
  if (existing) return existing;
  const client = new PrismaClient({ datasourceUrl: url });
  cacheMap.set(url, client);
  return client;
}

function bindWorkUnit(slug: string) {
  try {
    const store = workUnitAsyncStorage.getStore();
    if (store) tenantByWorkUnit.set(store, slug);
  } catch {
    /* scripts and tests have no Next request store */
  }
}

function tenantSlugFromCookie(): string | null {
  try {
    const store = workUnitAsyncStorage.getStore() as
      | { type?: string; cookies?: { get: (name: string) => { value: string } | undefined } }
      | undefined;
    if (!store || store.type !== "request") return null;
    const token = store.cookies?.get(SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = decodeJwt(token);
    return typeof payload.tenantSlug === "string" && payload.tenantSlug ? payload.tenantSlug : null;
  } catch {
    return null;
  }
}

export function currentTenantSlug(): string {
  try {
    const store = workUnitAsyncStorage.getStore();
    if (store) {
      const bound = tenantByWorkUnit.get(store);
      if (bound) return bound;
    }
  } catch {
    /* ignore */
  }
  return tenantAls.getStore()?.slug ?? tenantSlugFromCookie() ?? requestTenant().slug;
}

export function enterTenant(slug?: string | null) {
  const next = (slug ?? "").trim() || defaultTenantSlug();
  const store = { slug: next };
  requestTenant().slug = next;
  tenantAls.enterWith(store);
  bindWorkUnit(next);
}

export function currentPrisma(): PrismaClient {
  return tenantPrisma(currentTenantSlug());
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, _receiver) {
    const client = currentPrisma();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
