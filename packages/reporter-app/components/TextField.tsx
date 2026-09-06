import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors, minTapTarget, radius, spacing } from "../constants/theme";

export interface TextFieldProps extends TextInputProps {
  label: string;
}

export function TextField({ label, style, ...inputProps }: TextFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor={colors.textMuted} style={[styles.input, style]} {...inputProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  input: {
    minHeight: minTapTarget,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
});
