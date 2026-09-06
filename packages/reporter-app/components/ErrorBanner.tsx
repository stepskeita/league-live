import { StyleSheet, Text, View } from "react-native";
import { colors, radius, spacing } from "../constants/theme";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.dangerBackground,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  text: {
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
});
