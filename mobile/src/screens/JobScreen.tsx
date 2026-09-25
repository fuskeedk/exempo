import { type ReactNode, useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, ErrorBanner, Field, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";
import type { DayPayload, Job } from "../types";

function kroner(ore: number) {
  return `${(ore / 100).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr.`;
}

export function JobScreen({
  job,
  day,
  busy,
  error,
  onBack,
  onStart,
  onStop,
  onMaterial,
  onScan,
  onPhoto,
  onExtra,
}: {
  job: Job;
  day: DayPayload;
  busy: boolean;
  error: string;
  onBack: () => void;
  onStart: () => void;
  onStop: () => void;
  onMaterial: (productId: string, quantity: string) => Promise<void>;
  onScan: () => void;
  onPhoto: () => void;
  onExtra: (title: string, description: string, amount: string) => Promise<void>;
}) {
  const running = day.timer?.caseId === job.id;
  const [productId, setProductId] = useState(day.products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const selected = day.products.find((item) => item.id === productId);

  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Button title="Tilbage" onPress={onBack} variant="secondary" />
      <View style={styles.space} />
      <Kicker>{job.caseNumber}</Kicker>
      <Title>{job.title}</Title>
      <Muted>
        {job.customerName}
        {"\n"}
        {job.address}
      </Muted>
      <View style={styles.row}>
        {job.phone ? (
          <View style={styles.flex}>
            <Button title="Ring op" onPress={() => Linking.openURL(`tel:${job.phone}`)} variant="secondary" />
          </View>
        ) : null}
        {job.address ? (
          <View style={styles.flex}>
            <Button
              title="Kort"
              onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(job.address)}`)}
              variant="secondary"
            />
          </View>
        ) : null}
      </View>

      <ErrorBanner message={error} />

      <Card>
        <Text style={styles.h3}>Tid</Text>
        {running ? (
          <Button title="Stop og registrér tid" onPress={onStop} loading={busy} />
        ) : (
          <Button title="Start tid" onPress={onStart} loading={busy} />
        )}
      </Card>

      <Card>
        <Text style={styles.h3}>Materialer</Text>
        <Muted>
          Vælg fra kataloget eller scan stregkode. Valgt: {selected?.name ?? "ingen varer"}
        </Muted>
        <View style={styles.space} />
        {day.products.map((product) => (
          <Button
            key={product.id}
            title={`${product.sku} · ${product.name}`}
            onPress={() => setProductId(product.id)}
            variant={product.id === productId ? "primary" : "secondary"}
          />
        )).reduce<ReactNode[]>((acc, node, index) => {
          acc.push(node);
          acc.push(<View key={`gap-${index}`} style={styles.tiny} />);
          return acc;
        }, [])}
        <Field label="Antal" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        <Button
          title="Læg på sagen"
          onPress={() => onMaterial(productId, quantity)}
          loading={busy}
          disabled={!productId}
        />
        <View style={styles.space} />
        <Button title="Scan stregkode" onPress={onScan} variant="secondary" />
      </Card>

      <Card>
        <Text style={styles.h3}>Foto</Text>
        <Muted>Tag et billede eller vælg fra rullen. Det gemmes som dokumentation på sagen.</Muted>
        <View style={styles.space} />
        <Button title="Tilføj foto" onPress={onPhoto} loading={busy} />
      </Card>

      <Card>
        <Text style={styles.h3}>Ekstraarbejde</Text>
        <Field label="Titel" value={title} onChangeText={setTitle} placeholder="Fx ekstra stikkontakt" />
        <Field label="Beskrivelse" value={description} onChangeText={setDescription} />
        <Field label="Beløb (kr.)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Button
          title="Send ekstraarbejde"
          onPress={async () => {
            await onExtra(title, description, amount);
            setTitle("");
            setDescription("");
            setAmount("");
          }}
          loading={busy}
        />
        {job.extraWorks.map((extra) => (
          <Text key={extra.id} style={styles.extra}>
            {extra.title} · {kroner(extra.amount)} · {extra.status}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 64, paddingBottom: 48 },
  space: { height: 12 },
  tiny: { height: 8 },
  row: { flexDirection: "row", gap: 8, marginVertical: 14 },
  flex: { flex: 1 },
  h3: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  extra: { color: colors.muted, marginTop: 10, fontSize: 14 },
});
