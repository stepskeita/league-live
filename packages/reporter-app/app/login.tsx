import { useState } from "react";
import { Redirect } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ApiRequestError } from "@leaguelive/shared";
import { Button } from "../components/Button";
import { ErrorBanner } from "../components/ErrorBanner";
import { Screen } from "../components/Screen";
import { TextField } from "../components/TextField";
import { colors, spacing } from "../constants/theme";
import { useAuth } from "../lib/auth-context";

export default function LoginScreen() {
  const { status, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reached only via a <Redirect> from (app)/_layout.tsx once status is
  // resolved to "signedOut" — but a successful login() flips status to
  // "signedIn" while this screen is still mounted, so it needs its own
  // redirect out too.
  if (status === "signedIn") {
    return <Redirect href="/(app)" />;
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  const handleSubmit = async (): Promise<void> => {
    if (!canSubmit) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen
      footer={
        <Button
          label={submitting ? "Signing in…" : "Log in"}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.title}>LeagueLive</Text>
        <Text style={styles.subtitle}>Reporter sign in</Text>
      </View>

      <View>
        {error ? <ErrorBanner message={error} /> : null}
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    paddingTop: 80,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: spacing.xs + 2,
  },
});
