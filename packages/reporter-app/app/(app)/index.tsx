import { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { ApiRequestError, type Fixture } from "@leaguelive/shared";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FixtureCard } from "../../components/FixtureCard";
import { Screen } from "../../components/Screen";
import { colors, spacing } from "../../constants/theme";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    try {
      const { fixtures: mine } = await api.fixtures.listMine();
      setFixtures(mine);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Couldn't load your fixtures.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const { fixtures: mine } = await api.fixtures.listMine();
        if (!cancelled) {
          setFixtures(mine);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiRequestError ? err.message : "Couldn't load your fixtures.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onRefresh = async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

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
        renderItem={({ item }) => <FixtureCard fixture={item} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
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
