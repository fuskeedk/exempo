const DB_NAME = "exempo-offline";
const STORE = "outbox";

export type OutboxKind = "time" | "kls" | "photo";

export type OutboxItem = {
  id: string;
  kind: OutboxKind;
  payload: object;
  createdAt: number;
};

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function isNetworkFailure(err: unknown) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (err instanceof TypeError) return true;
  const message = err instanceof Error ? err.message : String(err ?? "");
  return /failed to fetch|network|load failed|offline/i.test(message);
}

export async function enqueueOutbox(kind: OutboxKind, payload: object) {
  const db = await openDb();
  const item: OutboxItem = {
    id: crypto.randomUUID(),
    kind,
    payload,
    createdAt: Date.now(),
  };
  const tx = db.transaction(STORE, "readwrite");
  tx.objectStore(STORE).add(item);
  await txDone(tx);
  db.close();
  return item.id;
}

export async function listOutbox(): Promise<OutboxItem[]> {
  const db = await openDb();
  const tx = db.transaction(STORE, "readonly");
  const request = tx.objectStore(STORE).getAll();
  const rows = await new Promise<OutboxItem[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result as OutboxItem[]);
    request.onerror = () => reject(request.error);
  });
  await txDone(tx);
  db.close();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function removeOutbox(ids: string[]) {
  if (ids.length === 0) return;
  const db = await openDb();
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  for (const id of ids) store.delete(id);
  await txDone(tx);
  db.close();
}

export async function queueKlsForm(formData: FormData) {
  const fields: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") fields[key] = value;
  }
  await enqueueOutbox("kls", { fields });
}

async function fileToBase64(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function queuePhotoForm(formData: FormData) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return false;
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Filen er for stor til at gemme offline.");
  }
  const data = await fileToBase64(file);
  await enqueueOutbox("photo", {
    caseId: String(formData.get("caseId") ?? ""),
    category: String(formData.get("category") ?? "FOTO"),
    folderId: String(formData.get("folderId") ?? ""),
    name: file.name,
    mimeType: file.type || "image/jpeg",
    data,
  });
  return true;
}

export async function queuePhotoIfOffline(formData: FormData) {
  if (typeof navigator !== "undefined" && navigator.onLine) return false;
  return queuePhotoForm(formData);
}
