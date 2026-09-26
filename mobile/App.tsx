import { createElement } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, SafeAreaView, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { DEFAULT_API_URL } from "./src/config";

const SITE = DEFAULT_API_URL;

export default function App() {
  if (Platform.OS === "web") {
    return (
      <View style={styles.fill}>
        {createElement("iframe", {
          src: SITE,
          title: "Exempo",
          style: { border: 0, width: "100%", height: "100%" },
        })}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.fill}>
      <StatusBar style="light" />
      <WebView
        source={{ uri: SITE }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        allowsBackForwardNavigationGestures
        geolocationEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        setSupportMultipleWindows={false}
        applicationNameForUserAgent="ExempoApp"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#16382c" },
});
