import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";

export function LegalScreen({ onBack }: { onBack: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Button title="Tilbage" onPress={onBack} variant="secondary" />
      <View style={styles.space} />
      <Kicker>Exempo</Kicker>
      <Title>Privatliv og support</Title>
      <Muted>
        Appen sender kun data til den Exempo-server, I selv sætter under Indstillinger. Der trackes
        ikke, og der bruges ikke reklame-id.
      </Muted>
      <Text style={styles.h}>Kamera og billeder</Text>
      <Muted>
        Kameraet bruges til dokumentationsfotos og stregkoder. Billeder knyttes til arbejdssedlen
        på jeres server.
      </Muted>
      <Text style={styles.h}>Login</Text>
      <Muted>Token gemmes i iOS Keychain og slettes, når du logger ud.</Muted>
      <Text style={styles.h}>Support</Text>
      <Muted>Skriv til dvaergen98@gmail.com. Fuld politik ligger på /privatliv på jeres server.</Muted>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  space: { height: 12 },
  h: { color: colors.ink, fontSize: 18, fontWeight: "700", marginTop: 18, marginBottom: 6 },
});
