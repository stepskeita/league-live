import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { CardColor, FixtureTeamSummary } from "@leaguelive/shared";
import { colors, radius, spacing } from "../constants/theme";
import { Button } from "./Button";
import { ErrorBanner } from "./ErrorBanner";
import { EVENT_TYPE_LABEL } from "./EventListItem";
import { MinuteStepper } from "./MinuteStepper";
import { SegmentedToggle } from "./SegmentedToggle";

export type LoggableEventType = "goal" | "card" | "substitution";

export interface EventLogSubmission {
  team_id: string;
  minute: number;
  card_color?: CardColor;
}

export interface EventLogModalProps {
  type: LoggableEventType | null;
  homeTeam: FixtureTeamSummary;
  awayTeam: FixtureTeamSummary;
  initialMinute: number;
  onCancel: () => void;
  onSubmit: (input: EventLogSubmission) => Promise<void>;
}

// One reusable modal for the three event types that genuinely need a
// decision from the reporter (which team, and for a card, which color) —
// half time/full time skip this entirely (see the session screen) since
// there's nothing to ask.
//
// No effect resets these fields between opens: the caller renders this with
// key={type} (see the session screen), so React remounts a fresh instance
// — with fresh useState initial values — every time a (possibly different)
// event type opens, rather than reusing one instance and clearing it.
export function EventLogModal({ type, homeTeam, awayTeam, initialMinute, onCancel, onSubmit }: EventLogModalProps) {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [minute, setMinute] = useState(initialMinute);
  const [cardColor, setCardColor] = useState<CardColor | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!type) {
    return null;
  }

  const canSubmit = teamId !== null && (type !== "card" || cardColor !== null);

  const handleSubmit = async (): Promise<void> => {
    if (!teamId || (type === "card" && !cardColor)) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ team_id: teamId, minute, ...(type === "card" && cardColor ? { card_color: cardColor } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't log that. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onCancel} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Log {EVENT_TYPE_LABEL[type]}</Text>

          {error ? <ErrorBanner message={error} /> : null}

          <SegmentedToggle
            label="Team"
            value={teamId}
            onChange={setTeamId}
            options={[
              { value: homeTeam.id, label: homeTeam.name },
              { value: awayTeam.id, label: awayTeam.name },
            ]}
          />

          {type === "card" ? (
            <SegmentedToggle<CardColor>
              label="Card"
              value={cardColor}
              onChange={setCardColor}
              options={[
                { value: "yellow", label: "Yellow", color: "#ca8a04" },
                { value: "red", label: "Red", color: colors.danger },
              ]}
            />
          ) : null}

          <MinuteStepper value={minute} onChange={setMinute} />

          <View style={styles.actions}>
            <Button label={`Log ${EVENT_TYPE_LABEL[type]}`} onPress={() => void handleSubmit()} disabled={!canSubmit} loading={submitting} />
            <View style={styles.cancelSpacer}>
              <Button label="Cancel" variant="outline" onPress={onCancel} disabled={submitting} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.4)",
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  actions: {
    marginTop: spacing.sm,
  },
  cancelSpacer: {
    marginTop: spacing.sm,
  },
});
