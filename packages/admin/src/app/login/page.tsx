"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Banner } from "../../components/ui/Banner";
import { Button } from "../../components/ui/Button";
import { Field, TextInput } from "../../components/ui/Field";
import { useAuth } from "../../lib/auth-context";
import { getErrorMessage } from "../../lib/error";
import styles from "./page.module.css";

export default function LoginPage() {
  const { status, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === "signedIn") {
    router.replace("/");
    return null;
  }

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>LeagueLive Admin</h1>
        <p className={styles.subtitle}>Sign in to manage your Organization.</p>

        {error ? <Banner variant="error">{error}</Banner> : null}

        <form onSubmit={(event) => void handleSubmit(event)}>
          <Field label="Email" htmlFor="email">
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Field label="Password" htmlFor="password">
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" className={styles.submit} disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
