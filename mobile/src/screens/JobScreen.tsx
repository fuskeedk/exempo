import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, ErrorBanner, Field, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";
import type { CaseDetail, DayPayload } from "../types";

function kroner(ore: number) {
  return `${(ore / 100).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr.`;
}

export function JobScreen({
  detail,
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
  onTime,
  onState,
  onStartKls,
}: {
  detail: CaseDetail;
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
  onTime: (hours: string, date: string, kind: string, note: string) => Promise<void>;
  onState: (toState: string) => Promise<void>;
  onStartKls: (templateId: string) => Promise<void>;
}) {
  const job = detail.job;
  const running = day.timer?.caseId === job.id;
  const [productId, setProductId] = useState(day.products[0]?.id ?? "");
  const [quantity, setQuantity] = useState("1");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [templateId, setTemplateId] = useState(day.klsTemplates?.[0]?.id ?? "");

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
        {job.description ? `\n${job.description}` : ""}
      </Muted>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{job.stateLabel}</Text>
      </View>
      <View style={styles.row}>
        {job.phone ? (
          <View style={styles.flex}>
            <Button title="Ring op" onPress={() => Linking.openURL(`tel:${job.phone}`)} variant="secondary" />
          </View>
        ) : null}
        <View style={styles.flex}>
          <Button title="Kort" onPress={() => Linking.openURL(`https://maps.apple.com/?q=${encodeURIComponent(job.address)}`)} variant="secondary" />
        </View>
      </View>
      <ErrorBanner message={error} />

      <Card>
        <Text style={styles.h3}>Tid</Text>
        {running ? (
          <Button title="Stop og registrér tid" onPress={onStop} loading={busy} />
        ) : (
          <Button title="Start tid" onPress={onStart} loading={busy} />
        )}
        <View style={styles.space} />
        <Field label="Timer" value={hours} onChangeText={setHours} keyboardType="decimal-pad" />
        <Field label="Dato" value={date} onChangeText={setDate} />
        <Field label="Note" value={note} onChangeText={setNote} />
        <Button title="Registrér tid" onPress={() => onTime(hours, date, "ARBEJDE", note)} loading={busy} variant="secondary" />
        {detail.timeEntries.map((entry) => (
          <Text key={entry.id} style={styles.line}>
            {entry.userName ?? "Tid"}: {entry.hours} t {entry.note ? `· ${entry.note}` : ""}
          </Text>
        ))}
      </Card>

      {detail.nextStates.length ? (
        <Card>
          <Text style={styles.h3}>Flyt sag</Text>
          <Muted>Tilladte overgange — samme FSM som på web.</Muted>
          <View style={styles.space} />
          {detail.nextStates.map((state) => (
            <View key={state.id} style={styles.tiny}>
              <Button title={state.label} onPress={() => onState(state.id)} variant="secondary" loading={busy} />
            </View>
          ))}
        </Card>
      ) : null}

      <Card>
        <Text style={styles.h3}>Materialer</Text>
        {day.products.map((product) => (
          <View key={product.id} style={styles.tiny}>
            <Button
              title={`${product.sku} · ${product.name}`}
              onPress={() => setProductId(product.id)}
              variant={product.id === productId ? "primary" : "secondary"}
            />
          </View>
        ))}
        <Field label="Antal" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" />
        <Button title="Fra katalog" onPress={() => onMaterial(productId, quantity)} loading={busy} disabled={!productId} />
        <View style={styles.space} />
        <Button title="Scan stregkode" onPress={onScan} variant="secondary" />
        {detail.materials.map((item) => (
          <Text key={item.id} style={styles.line}>
            {item.name} × {item.quantity}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.h3}>Dokumentation</Text>
        <Button title="Foto" onPress={onPhoto} loading={busy} />
        {detail.documents.map((doc) => (
          <Text key={doc.id} style={styles.line}>
            {doc.name} · {doc.category}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.h3}>KLS</Text>
        {detail.kls ? (
          <Muted>
            {detail.kls.name}
            {detail.kls.signedAt ? " · underskrevet" : " · kladde"}
          </Muted>
        ) : (
          <>
            <Muted>Start en tjekliste, som på web.</Muted>
            {(day.klsTemplates ?? []).map((template) => (
              <View key={template.id} style={styles.tiny}>
                <Button
                  title={template.name}
                  onPress={() => setTemplateId(template.id)}
                  variant={template.id === templateId ? "primary" : "secondary"}
                />
              </View>
            ))}
            <Button title="Start KLS" onPress={() => onStartKls(templateId)} loading={busy} disabled={!templateId} />
          </>
        )}
        {detail.kls?.checks.map((check) => (
          <Text key={check.id} style={styles.line}>
            {check.label} · {check.statusLabel}
          </Text>
        ))}
      </Card>

      <Card>
        <Text style={styles.h3}>Ekstraarbejde</Text>
        <Field label="Opgave" value={title} onChangeText={setTitle} />
        <Field label="Beskrivelse" value={description} onChangeText={setDescription} />
        <Field label="Beløb, kr." value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <Button
          title="Opret ekstraarbejde"
          onPress={async () => {
            await onExtra(title, description, amount);
            setTitle("");
            setDescription("");
            setAmount("");
          }}
          loading={busy}
        />
        {detail.extraWorks.map((extra) => (
          <Text key={extra.id} style={styles.line}>
            {extra.title} · {kroner(extra.amount)} · {extra.status}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  space: { height: 12 },
  tiny: { marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, marginVertical: 14 },
  flex: { flex: 1 },
  h3: { fontSize: 18, fontWeight: "700", color: colors.ink, marginBottom: 8 },
  line: { color: colors.muted, marginTop: 10, fontSize: 14 },
  badge: { alignSelf: "flex-start", backgroundColor: colors.moss, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 10 },
  badgeText: { color: colors.pine, fontWeight: "700", fontSize: 12 },
});
