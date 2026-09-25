import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";
import type { Tab } from "../types";

const tabs: { id: Tab; label: string }[] = [
  { id: "day", label: "Min dag" },
  { id: "cases", label: "Arbejdssedler" },
  { id: "calendar", label: "Planlægning" },
  { id: "time", label: "Tid" },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <View style={styles.bar}>
      {tabs.map((item) => (
        <Pressable key={item.id} onPress={() => onChange(item.id)} style={styles.item}>
          <Text style={[styles.label, tab === item.id && styles.active]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.pine,
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 14,
  },
  item: { flex: 1, alignItems: "center" },
  label: { color: "#d7c9a8", fontSize: 12, fontWeight: "600" },
  active: { color: colors.paper },
});
