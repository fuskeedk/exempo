import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, ErrorBanner, Field, Kicker, Muted, Title } from "../components";

export function SettingsScreen({
  apiUrl,
  demo,
  onSave,
  onTest,
  onLogout,
  onBack,
  onLegal,
  busy,
  error,
  status,
}: {
  apiUrl: string;
  demo: boolean;
  onSave: (url: string) => Promise<void>;
  onTest: (url: string) => Promise<void>;
  onLogout: () => void;
  onBack: () => void;
  onLegal: () => void;
  busy: boolean;
  error: string;
  status: string;
}) {
  const [url, setUrl] = useState(apiUrl);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Button title="Tilbage" onPress={onBack} variant="secondary" />
      <View style={styles.space} />
      <Kicker>App Store</Kicker>
      <Title>Indstillinger</Title>
      <Muted>
        Appen taler med jeres Exempo-server over HTTPS. Til test på samme netværk kan du bruge
        http://DIN-PC:3000.
      </Muted>
      <View style={styles.space} />
      <ErrorBanner message={error} />
      {status ? <Muted>{status}</Muted> : null}
      <Field
        label="Serveradresse"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        placeholder="https://exempo.ditfirma.dk"
      />
      <Button title="Gem adresse" onPress={() => onSave(url)} loading={busy} />
      <View style={styles.space} />
      <Button title="Test forbindelse" onPress={() => onTest(url)} variant="secondary" disabled={busy} />
      <View style={styles.space} />
      <Muted>{demo ? "Du kører i demo uden server." : "Du er logget på jeres server."}</Muted>
      <View style={styles.space} />
      <Button title="Privatliv og support" onPress={onLegal} variant="secondary" />
      <View style={styles.space} />
      <Button title="Log ud" onPress={onLogout} variant="danger" />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  space: { height: 12 },
});
