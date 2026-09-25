import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Button, Field, Kicker, Title } from "../components";
import { colors } from "../theme";

export function ScanScreen({
  busy,
  onBack,
  onCode,
}: {
  busy: boolean;
  onBack: () => void;
  onCode: (code: string) => Promise<void>;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState("");
  const [locked, setLocked] = useState(false);

  async function handle(code: string) {
    if (locked || !code.trim()) return;
    setLocked(true);
    try {
      await onCode(code.trim());
    } finally {
      setLocked(false);
    }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Button title="Tilbage" onPress={onBack} variant="secondary" />
        <View style={styles.space} />
        <Kicker>Materialer</Kicker>
        <Title>Scan stregkode</Title>
      </View>
      {!permission?.granted ? (
        <View style={styles.center}>
          <Text style={styles.text}>Kameraet skal bruges til at scanne varer.</Text>
          <Button title="Tillad kamera" onPress={() => requestPermission()} />
        </View>
      ) : (
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "qr", "upc_a", "upc_e"] }}
          onBarcodeScanned={locked || busy ? undefined : ({ data }) => handle(data)}
        />
      )}
      <View style={styles.bottom}>
        <Field label="Eller tast stregkode / varenr." value={manual} onChangeText={setManual} />
        <Button title="Tilføj" onPress={() => handle(manual)} loading={busy || locked} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.paper, paddingTop: 64 },
  top: { paddingHorizontal: 20 },
  space: { height: 12 },
  camera: { flex: 1, margin: 20, borderRadius: 20, overflow: "hidden" },
  center: { flex: 1, justifyContent: "center", padding: 20, gap: 16 },
  text: { color: colors.ink, fontSize: 16 },
  bottom: { padding: 20, paddingBottom: 36 },
});
