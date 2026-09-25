import { Linking, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { Card, Kicker, Muted, Title } from "../components";
import { colors } from "../theme";
import type { Customer } from "../types";

export function CustomersScreen({ customers }: { customers: Customer[] }) {
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Kicker>Kartotek</Kicker>
      <Title>Kunder</Title>
      <Muted>Samme kundeliste som på web — ring eller slå adressen op.</Muted>
      {customers.map((customer) => (
        <Card key={customer.id}>
          <Text style={styles.name}>{customer.name}</Text>
          <Muted>
            {customer.address || "Ingen adresse"}
            {customer.phone ? `\n${customer.phone}` : ""}
            {customer.email ? `\n${customer.email}` : ""}
          </Muted>
          <Text style={styles.meta}>
            {customer.caseCount} sag{customer.caseCount === 1 ? "" : "er"}
          </Text>
          {customer.phone ? (
            <Pressable onPress={() => Linking.openURL(`tel:${customer.phone}`)}>
              <Text style={styles.link}>Ring op</Text>
            </Pressable>
          ) : null}
        </Card>
      ))}
      {customers.length === 0 ? (
        <Card>
          <Muted>Ingen kunder i kartoteket.</Muted>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 24 },
  name: { color: colors.ink, fontSize: 20, fontWeight: "700", marginBottom: 6 },
  meta: { color: colors.gold, marginTop: 8, fontSize: 13, fontWeight: "600" },
  link: { color: colors.pine, fontWeight: "700", marginTop: 10 },
});
