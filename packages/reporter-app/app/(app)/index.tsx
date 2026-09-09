import { useRouter } from "expo-router";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FixtureCard } from "../../components/FixtureCard";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../constants/theme";
import { useAuth } from "../../lib/auth-context";
import { useFixtures } from "../../lib/fixtures-context";

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { fixtures, error, refreshing, refresh } = useFixtures();
  const router = useRouter();

  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hi, {firstName}</Text>
        <Text style={styles.subtitle}>Your assigned fixtures</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        data={fixtures ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FixtureCard fixture={item} onPress={() => router.push(`/fixtures/${item.id}`)} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        contentContainerStyle={fixtures && fixtures.length > 0 ? undefined : styles.emptyContainer}
        ListEmptyComponent={
          fixtures === null ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No fixtures assigned yet</Text>
              <Text style={styles.emptyBody}>Fixtures assigned to you will show up here.</Text>
            </View>
          )
        }
      />

      <View style={styles.footer}>
        <Button label="Log out" variant="outline" onPress={() => void logout()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  greeting: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "center",
  },
  footer: {
    paddingVertical: spacing.md,
  },
});
