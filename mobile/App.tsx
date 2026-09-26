import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { DEFAULT_API_URL } from "./src/config";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const SITE = DEFAULT_API_URL;
const HOST = "exempo.jbnet.dk";

function hideSplash() {
  SplashScreen.hideAsync().catch(() => undefined);
}

function shouldOpenOutside(url: string) {
  if (
    url.startsWith("tel:") ||
    url.startsWith("mailto:") ||
    url.startsWith("sms:") ||
    url.startsWith("maps:") ||
    url.startsWith("itms-apps:")
  ) {
    return true;
  }
  try {
    const next = new URL(url);
    if (next.hostname === HOST || next.hostname === `www.${HOST}`) return false;
    return next.protocol === "http:" || next.protocol === "https:";
  } catch {
    return false;
  }
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const onNav = useCallback((request: WebViewNavigation) => {
    const url = request.url;
    if (request.navigationType === "other" && url === "about:blank") return true;
    if (shouldOpenOutside(url)) {
      Linking.openURL(url).catch(() => undefined);
      return false;
    }
    return true;
  }, []);

  const reload = useCallback(() => {
    setError("");
    setLoading(true);
    webRef.current?.reload();
  }, []);

  const openInSafari = useCallback(() => {
    Linking.openURL(SITE).catch(() => undefined);
  }, []);

  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.location.replace(SITE);
    return <View style={styles.fill} />;
  }

  return (
    <View style={styles.fill}>
      <StatusBar style="light" />
      {error ? (
        <View style={styles.center}>
          <Text style={styles.kicker}>Exempo</Text>
          <Text style={styles.title}>Kunne ikke åbne Exempo</Text>
          <Text style={styles.lead}>
            Appen viser det samme system som på computeren. Tjek netværket, og prøv igen.
          </Text>
          <Pressable onPress={reload} style={styles.button}>
            <Text style={styles.buttonText}>Prøv igen</Text>
          </Pressable>
          <Pressable onPress={openInSafari} style={styles.linkButton}>
            <Text style={styles.linkText}>Åbn i Safari</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: SITE }}
          style={styles.fill}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          setSupportMultipleWindows={false}
          pullToRefreshEnabled
          geolocationEnabled={false}
          autoManageStatusBarEnabled={false}
          keyboardDisplayRequiresUserAction={false}
          contentMode="mobile"
          decelerationRate="normal"
          applicationNameForUserAgent="ExempoApp/1.0"
          originWhitelist={["https://*", "http://*", "tel:*", "mailto:*", "maps:*"]}
          onShouldStartLoadWithRequest={onNav}
          onFileDownload={(event) => {
            const url = event.nativeEvent.downloadUrl;
            if (url) Linking.openURL(url).catch(() => undefined);
          }}
          onContentProcessDidTerminate={() => {
            webRef.current?.reload();
          }}
          onLoadEnd={() => {
            setLoading(false);
            hideSplash();
          }}
          onError={() => {
            setError("timeout");
            setLoading(false);
            hideSplash();
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              setError("server");
              setLoading(false);
              hideSplash();
            }
          }}
          renderLoading={() => (
            <View style={styles.loader}>
              <ActivityIndicator color="#f4efe4" size="large" />
            </View>
          )}
        />
      )}
      {loading && !error ? (
        <View pointerEvents="none" style={styles.loader}>
          <ActivityIndicator color="#f4efe4" size="large" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#16382c" },
  loader: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16382c",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    padding: 28,
    paddingTop: 72,
    backgroundColor: "#16382c",
  },
  kicker: {
    color: "#d7c9a8",
    fontSize: 12,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: { color: "#f4efe4", fontSize: 28, fontWeight: "700", marginBottom: 12 },
  lead: { color: "#e4d8c0", fontSize: 17, lineHeight: 24, marginBottom: 24 },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#b85c38",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  linkButton: { alignSelf: "flex-start", marginTop: 16, paddingVertical: 8 },
  linkText: { color: "#e4d8c0", fontSize: 16, textDecorationLine: "underline" },
});
