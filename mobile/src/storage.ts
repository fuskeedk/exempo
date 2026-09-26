import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { resolveApiUrl } from "./config";

const TOKEN = "exempo_token";
const API = "exempo_api_url";
const DEMO = "exempo_demo";

function webStorage() {
  try {
    if (Platform.OS === "web" && typeof localStorage !== "undefined") return localStorage;
  } catch {
    /* private mode */
  }
  return null;
}

async function read(key: string) {
  const web = webStorage();
  if (web) return web.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function write(key: string, value: string) {
  const web = webStorage();
  if (web) {
    web.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* native simulator without keychain */
  }
}

async function remove(key: string) {
  const web = webStorage();
  if (web) {
    web.removeItem(key);
    return;
  }
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
    apiUrl: resolveApiUrl(apiUrl || process.env.EXPO_PUBLIC_API_URL),
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
