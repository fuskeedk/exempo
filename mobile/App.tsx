import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, StatusBar } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SplashScreen from "expo-splash-screen";
import {
  addAbsence,
  addExtraWork,
  addMaterial,
  checkHealth,
  fetchDay,
  login,
  setTimer,
  uploadPhoto,
} from "./src/api";
import {
  demoAddAbsence,
  demoAddExtra,
  demoAddMaterial,
  demoDay,
  demoReset,
  demoStartTimer,
  demoStopTimer,
} from "./src/demo";
import { AbsenceScreen } from "./src/screens/AbsenceScreen";
import { DayScreen } from "./src/screens/DayScreen";
import { JobScreen } from "./src/screens/JobScreen";
import { LegalScreen } from "./src/screens/LegalScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { clearSession, loadSession, saveApiUrl, saveToken, setDemoMode } from "./src/storage";
import { colors } from "./src/theme";
import type { DayPayload, Route } from "./src/types";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrl] = useState("");
  const [token, setToken] = useState("");
  const [demo, setDemo] = useState(false);
  const [day, setDay] = useState<DayPayload | null>(null);
  const [route, setRoute] = useState<Route>({ name: "login" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const job = useMemo(() => {
    const jobId = route.name === "job" ? route.id : route.name === "scan" ? route.caseId : null;
    return jobId ? day?.jobs.find((item) => item.id === jobId) ?? null : null;
  }, [day, route]);

  const refresh = useCallback(async (nextToken = token, nextDemo = demo, nextUrl = apiUrl) => {
    if (nextDemo) {
      setDay(demoDay());
      return;
    }
    if (!nextToken) {
      setDay(null);
      return;
    }
    setDay(await fetchDay(nextUrl, nextToken));
  }, [apiUrl, demo, token]);

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      setApiUrl(session.apiUrl);
      setToken(session.token);
      setDemo(session.demo);
      try {
        if (session.demo) {
          setDay(demoDay());
          setRoute({ name: "day" });
        } else if (session.token && session.apiUrl) {
          setDay(await fetchDay(session.apiUrl, session.token));
          setRoute({ name: "day" });
        }
      } catch {
        await clearSession();
        setToken("");
      } finally {
        setReady(true);
        SplashScreen.hideAsync().catch(() => undefined);
      }
    })();
  }, []);

  async function wrap(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Noget gik galt.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(email: string, password: string) {
    await wrap(async () => {
      const result = await login(apiUrl, email, password);
      await setDemoMode(false);
      await saveToken(result.token);
      setDemo(false);
      setToken(result.token);
      await refresh(result.token, false, apiUrl);
      setRoute({ name: "day" });
    });
  }

  async function handleDemo() {
    await wrap(async () => {
      demoReset();
      await setDemoMode(true);
      setDemo(true);
      setToken("");
      setDay(demoDay());
      setRoute({ name: "day" });
    });
  }

  async function handleLogout() {
    await clearSession();
    demoReset();
    setToken("");
    setDemo(false);
    setDay(null);
    setError("");
    setRoute({ name: "login" });
  }

  async function handleTimer(action: "start" | "stop", caseId?: string) {
    await wrap(async () => {
      if (demo) {
        const result = action === "start" && caseId ? demoStartTimer(caseId) : demoStopTimer();
        setDay(demoDay());
        if (action === "stop") Alert.alert("Tid registreret", `${result.hours} timer er lagt på sagen.`);
        return;
      }
      const result = await setTimer(apiUrl, token, action, caseId);
      await refresh();
      if (!result.running && result.hours) {
        Alert.alert("Tid registreret", `${result.hours} timer er lagt på sagen.`);
      }
    });
  }

  async function handleMaterial(caseId: string, productId?: string, barcode?: string, quantity = "1") {
    await wrap(async () => {
      const name = demo
        ? demoAddMaterial(productId || barcode || "")
        : (await addMaterial(apiUrl, token, { caseId, productId, barcode, quantity })).name;
      await refresh();
      Alert.alert("Materiale lagt på", name);
      if (route.name === "scan") setRoute({ name: "job", id: caseId });
    });
  }

  async function handlePhoto(caseId: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const pick =
      permission.granted
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (pick.canceled || !pick.assets[0]) return;
    await wrap(async () => {
      if (demo) {
        Alert.alert("Foto", "I demo gemmes billedet ikke på en server.");
        return;
      }
      await uploadPhoto(apiUrl, token, caseId, pick.assets[0].uri);
      Alert.alert("Foto uploaded", "Billedet ligger som dokumentation på sagen.");
    });
  }

  async function handleExtra(caseId: string, title: string, description: string, amount: string) {
    if (!title.trim()) {
      setError("Sag og titel er påkrævet.");
      return;
    }
    await wrap(async () => {
      if (demo) demoAddExtra(caseId, title, amount);
      else await addExtraWork(apiUrl, token, { caseId, title, description, amount });
      await refresh();
      Alert.alert("Ekstraarbejde", "Sendt til kontoret.");
    });
  }

  if (!ready) return null;

  let body = (
    <LoginScreen
      apiUrl={apiUrl}
      onLogin={handleLogin}
      onDemo={handleDemo}
      onSettings={() => setRoute({ name: "settings" })}
      busy={busy}
      error={error}
    />
  );

  if (route.name === "settings") {
    body = (
      <SettingsScreen
        apiUrl={apiUrl}
        demo={demo}
        busy={busy}
        error={error}
        status={status}
        onBack={() => setRoute(day ? { name: "day" } : { name: "login" })}
        onLegal={() => setRoute({ name: "legal" })}
        onLogout={handleLogout}
        onSave={async (url) => {
          await wrap(async () => {
            await saveApiUrl(url);
            setApiUrl(url.trim());
            setStatus("Adressen er gemt.");
          });
        }}
        onTest={async (url) => {
          await wrap(async () => {
            const health = await checkHealth(url);
            setStatus(`${health.name} ${health.version} svarer.`);
          });
        }}
      />
    );
  } else if (route.name === "legal") {
    body = <LegalScreen onBack={() => setRoute({ name: "settings" })} />;
  } else if (route.name === "day" && day) {
    body = (
      <DayScreen
        day={day}
        busy={busy}
        onOpenJob={(id) => {
          setError("");
          setRoute({ name: "job", id });
        }}
        onAbsence={() => {
          setError("");
          setRoute({ name: "absence" });
        }}
        onSettings={() => setRoute({ name: "settings" })}
        onRefresh={() => wrap(() => refresh())}
        onStop={() => handleTimer("stop")}
      />
    );
  } else if (route.name === "job" && day && job) {
    body = (
      <JobScreen
        job={job}
        day={day}
        busy={busy}
        error={error}
        onBack={() => {
          setError("");
          setRoute({ name: "day" });
        }}
        onStart={() => handleTimer("start", job.id)}
        onStop={() => handleTimer("stop")}
        onMaterial={(productId, quantity) => handleMaterial(job.id, productId, undefined, quantity)}
        onScan={() => setRoute({ name: "scan", caseId: job.id })}
        onPhoto={() => handlePhoto(job.id)}
        onExtra={(title, description, amount) => handleExtra(job.id, title, description, amount)}
      />
    );
  } else if (route.name === "scan" && job) {
    body = (
      <ScanScreen
        busy={busy}
        onBack={() => setRoute({ name: "job", id: job.id })}
        onCode={(code) => handleMaterial(job.id, undefined, code, "1")}
      />
    );
  } else if (route.name === "absence") {
    body = (
      <AbsenceScreen
        busy={busy}
        error={error}
        onBack={() => setRoute({ name: "day" })}
        onSave={async (input) => {
          await wrap(async () => {
            if (demo) demoAddAbsence();
            else await addAbsence(apiUrl, token, input);
            Alert.alert("Fravær", "Registreret.");
            setRoute({ name: "day" });
          });
        }}
      />
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: route.name === "login" ? colors.pine : colors.paper }}>
      <StatusBar barStyle={route.name === "login" ? "light-content" : "dark-content"} />
      {body}
    </SafeAreaView>
  );
}
