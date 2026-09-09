import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { FixturesProvider } from "../../lib/fixtures-context";

export default function AppLayout() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (status === "signedOut") {
    return <Redirect href="/login" />;
  }

  return (
    <FixturesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </FixturesProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
