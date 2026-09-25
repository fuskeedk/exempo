import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ErrorBanner, Field, Kicker, Title } from "../components";
import { colors } from "../theme";

export function LoginScreen({
  apiUrl,
  onLogin,
  onDemo,
  onSettings,
  busy,
  error,
}: {
  apiUrl: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onDemo: () => Promise<void>;
  onSettings: () => void;
  busy: boolean;
  error: string;
}) {
  const [email, setEmail] = useState("lars@exempo.dk");
  const [password, setPassword] = useState("exempo123");

  return (
    <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Kicker>Exempo</Kicker>
          <Title>Min dag i marken</Title>
          <Text style={styles.lead}>
            Min dag, arbejdssedler, planlægning og tid — samme feltflow som på web, uden kontoret.
          </Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.h2}>Log ind</Text>
          <ErrorBanner message={error} />
          <Field
            label="E-mail"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Field
            label="Adgangskode"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />
          <Button title="Fortsæt" onPress={() => onLogin(email, password)} loading={busy} />
          <View style={styles.gap} />
          <Button title="Prøv demo" onPress={onDemo} variant="secondary" disabled={busy} />
          <Text style={styles.meta}>
            Server: {apiUrl || "ikke sat — åbn Indstillinger eller brug demo"}
          </Text>
          <Button title="Indstillinger" onPress={onSettings} variant="secondary" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.pine },
  scroll: { padding: 20, paddingTop: 72, paddingBottom: 40 },
  hero: { marginBottom: 24 },
  lead: { color: "#e4d8c0", fontSize: 17, lineHeight: 24, marginTop: 10, maxWidth: 360 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: 28,
    padding: 20,
  },
  h2: { fontSize: 24, fontWeight: "700", color: colors.ink, marginBottom: 12 },
  gap: { height: 10 },
  meta: { color: colors.muted, fontSize: 13, marginVertical: 12 },
});
