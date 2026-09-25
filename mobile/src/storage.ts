import * as SecureStore from "expo-secure-store";

const TOKEN = "exempo_token";
const API = "exempo_api_url";
const DEMO = "exempo_demo";

async function read(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* web / simulator without keychain */
  }
}

async function remove(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}

export async function loadSession() {
  const [token, apiUrl, demo] = await Promise.all([read(TOKEN), read(API), read(DEMO)]);
  return {
    token: token ?? "",
    apiUrl: apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? "https://exempo.jbnet.dk",
    demo: demo === "1",
  };
}

export async function saveApiUrl(apiUrl: string) {
  await write(API, apiUrl.trim());
}

export async function saveToken(token: string) {
  await write(TOKEN, token);
}

export async function setDemoMode(on: boolean) {
  await write(DEMO, on ? "1" : "0");
  if (on) await remove(TOKEN);
}

export async function clearSession() {
  await remove(TOKEN);
  await write(DEMO, "0");
}
