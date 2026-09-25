import { useCallback, useEffect, useState } from "react";
import { Alert, SafeAreaView, StatusBar, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as SplashScreen from "expo-splash-screen";
import {
  addAbsence,
  addExtraWork,
  addMaterial,
  addTime,
  checkHealth,
  fetchCase,
  fetchCustomers,
  fetchDay,
  login,
  saveKls,
  setCaseState,
  setTimer,
  uploadPhoto,
} from "./src/api";
import {
  demoAddAbsence,
  demoAddExtra,
  demoAddMaterial,
  demoCase,
  demoDay,
  demoReset,
  demoStartTimer,
  demoStopTimer,
} from "./src/demo";
import { CasesScreen } from "./src/screens/CasesScreen";
import { CustomersScreen } from "./src/screens/CustomersScreen";
import { DayScreen } from "./src/screens/DayScreen";
import { JobScreen } from "./src/screens/JobScreen";
import { LegalScreen } from "./src/screens/LegalScreen";
import { LoginScreen } from "./src/screens/LoginScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { TabBar } from "./src/screens/TabBar";
import { TimeScreen } from "./src/screens/TimeScreen";
import { clearSession, loadSession, saveApiUrl, saveToken, setDemoMode } from "./src/storage";
import { colors } from "./src/theme";
import type { CaseDetail, Customer, DayPayload, Route, Tab } from "./src/types";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function App() {
  const [ready, setReady] = useState(false);
  const [apiUrl, setApiUrl] = useState("https://exempo.jbnet.dk");
  const [token, setToken] = useState("");
  const [demo, setDemo] = useState(false);
  const [day, setDay] = useState<DayPayload | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [route, setRoute] = useState<Route>({ name: "login" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const refresh = useCallback(async (nextToken = token, nextDemo = demo, nextUrl = apiUrl) => {
    if (nextDemo) {
      const payload = demoDay();
      setDay(payload);
      setCustomers(payload.customers ?? []);
      return;
    }
    if (!nextToken) {
      setDay(null);
      return;
    }
    const payload = await fetchDay(nextUrl, nextToken);
    setDay(payload);
    try {
      setCustomers(await fetchCustomers(nextUrl, nextToken));
    } catch {
      setCustomers(payload.customers ?? []);
    }
  }, [apiUrl, demo, token]);

  async function openJob(id: string) {
    setError("");
    if (demo) {
      setDetail(demoCase(id));
      setRoute({ name: "job", id });
      return;
    }
    setDetail(await fetchCase(apiUrl, token, id));
    setRoute({ name: "job", id });
  }

  async function reloadDetail(id: string) {
    if (demo) {
      setDetail(demoCase(id));
      await refresh();
      return;
    }
    setDetail(await fetchCase(apiUrl, token, id));
    await refresh();
  }

  useEffect(() => {
    (async () => {
      const session = await loadSession();
      setApiUrl(session.apiUrl);
      setToken(session.token);
      setDemo(session.demo);
      try {
        if (session.demo) {
          const payload = demoDay();
          setDay(payload);
          setCustomers(payload.customers ?? []);
          setRoute({ name: "app", tab: "day" });
        } else if (session.token && session.apiUrl) {
          const payload = await fetchDay(session.apiUrl, session.token);
          setDay(payload);
          try {
            setCustomers(await fetchCustomers(session.apiUrl, session.token));
          } catch {
            setCustomers(payload.customers ?? []);
          }
          setRoute({ name: "app", tab: "day" });
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
      setRoute({ name: "app", tab: "day" });
    });
  }

  async function handleDemo() {
    await wrap(async () => {
      demoReset();
      await setDemoMode(true);
      setDemo(true);
      setToken("");
      const payload = demoDay();
      setDay(payload);
      setCustomers(payload.customers ?? []);
      setRoute({ name: "app", tab: "day" });
    });
  }

  async function handleLogout() {
    await clearSession();
    demoReset();
    setToken("");
    setDemo(false);
    setDay(null);
    setCustomers([]);
    setDetail(null);
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
      if (route.name === "job") await reloadDetail(caseId);
      Alert.alert("Materiale lagt på", name);
      if (route.name === "scan") setRoute({ name: "job", id: caseId });
    });
  }

  async function handlePhoto(caseId: string) {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    const pick = permission.granted
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ["images"] });
    if (pick.canceled || !pick.assets[0]) return;
    await wrap(async () => {
      if (demo) {
        Alert.alert("Foto", "I demo gemmes billedet ikke på en server.");
        return;
      }
      await uploadPhoto(apiUrl, token, caseId, pick.assets[0].uri);
      await reloadDetail(caseId);
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
      if (route.name === "job") await reloadDetail(caseId);
    });
  }

  if (!ready) return null;

  const goTab = (tab: Tab) => {
    setError("");
    setRoute({ name: "app", tab });
  };

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
        onBack={() => setRoute(day ? { name: "app", tab: "day" } : { name: "login" })}
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
  } else if (route.name === "app" && day) {
    const tab = route.tab;
    body = (
      <View style={{ flex: 1 }}>
        {tab === "day" ? (
          <DayScreen
            day={day}
            error={error}
            busy={busy}
            onOpenJob={(id) => wrap(() => openJob(id))}
            onSettings={() => setRoute({ name: "settings" })}
            onStart={(id) => handleTimer("start", id)}
            onStop={() => handleTimer("stop")}
            onMaterial={(caseId, productId, quantity) => handleMaterial(caseId, productId, undefined, quantity)}
            onScan={(caseId) => setRoute({ name: "scan", caseId })}
            onExtra={(caseId, title, amount) => handleExtra(caseId, title, "", amount)}
          />
        ) : null}
        {tab === "cases" ? (
          <CasesScreen cases={day.cases ?? day.jobs} onOpen={(id) => wrap(() => openJob(id))} />
        ) : null}
        {tab === "customers" ? <CustomersScreen customers={customers} /> : null}
        {tab === "time" ? (
          <TimeScreen
            entries={day.timeEntries ?? []}
            absences={day.absences ?? []}
            busy={busy}
            error={error}
            onAbsence={async (input) => {
              await wrap(async () => {
                if (demo) demoAddAbsence();
                else await addAbsence(apiUrl, token, input);
                await refresh();
                Alert.alert("Fravær", "Registreret.");
              });
            }}
          />
        ) : null}
        <TabBar tab={tab} onChange={goTab} />
      </View>
    );
  } else if (route.name === "job" && day && detail) {
    body = (
      <JobScreen
        detail={detail}
        day={day}
        busy={busy}
        error={error}
        onBack={() => {
          setError("");
          setRoute({ name: "app", tab: "day" });
        }}
        onStart={() => handleTimer("start", detail.job.id)}
        onStop={() => handleTimer("stop")}
        onMaterial={(productId, quantity) => handleMaterial(detail.job.id, productId, undefined, quantity)}
        onScan={() => setRoute({ name: "scan", caseId: detail.job.id })}
        onPhoto={() => handlePhoto(detail.job.id)}
        onExtra={(title, description, amount) => handleExtra(detail.job.id, title, description, amount)}
        onTime={async (hours, date, kind, note) => {
          await wrap(async () => {
            if (!demo) await addTime(apiUrl, token, { caseId: detail.job.id, hours, date, kind, note });
            await reloadDetail(detail.job.id);
          });
        }}
        onState={async (toState) => {
          await wrap(async () => {
            if (!demo) await setCaseState(apiUrl, token, detail.job.id, toState);
            await reloadDetail(detail.job.id);
          });
        }}
        onStartKls={async (templateId) => {
          await wrap(async () => {
            if (!demo) await saveKls(apiUrl, token, { caseId: detail.job.id, action: "start", templateId });
            await reloadDetail(detail.job.id);
          });
        }}
      />
    );
  } else if (route.name === "scan") {
    body = (
      <ScanScreen
        busy={busy}
        onBack={() => setRoute({ name: "job", id: route.caseId })}
        onCode={(code) => handleMaterial(route.caseId, undefined, code, "1")}
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
