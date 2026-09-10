"use client";

import type { AnomalyFlag, AnomalyFlagStatus, Competition, DisciplinaryRecordRow, Player } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { Field, Select, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Table, type Column } from "../../../components/ui/Table";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

/** FR39-FR41, results.verify gated. */
export default function ModerationPage() {
  const [statusFilter, setStatusFilter] = useState<AnomalyFlagStatus>("open");
  const [flags, setFlags] = useState<AnomalyFlag[] | null>(null);
  const [flagsError, setFlagsError] = useState<string | null>(null);
  const [resolving, setResolving] = useState<AnomalyFlag | null>(null);

  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [competitionId, setCompetitionId] = useState("");
  const [discipline, setDiscipline] = useState<DisciplinaryRecordRow[] | null>(null);
  const [disciplineError, setDisciplineError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ competitions: compList }, { players: playerList }] = await Promise.all([
          api.competitions.list(),
          api.players.list(),
        ]);
        if (!cancelled) {
          setCompetitions(compList);
          setPlayers(playerList);
          setCompetitionId((current) => current || compList[0]?.id || "");
        }
      } catch {
        // Non-critical for the flags list; the discipline section just stays empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshFlags = async (): Promise<void> => {
    setFlagsError(null);
    try {
      const { anomalyFlags } = await api.moderation.listFlags({ status: statusFilter });
      setFlags(anomalyFlags);
    } catch (err) {
      setFlagsError(getErrorMessage(err, "Couldn't load anomaly flags."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFlagsError(null);
      setFlags(null);
      try {
        const { anomalyFlags } = await api.moderation.listFlags({ status: statusFilter });
        if (!cancelled) {
          setFlags(anomalyFlags);
        }
      } catch (err) {
        if (!cancelled) {
          setFlagsError(getErrorMessage(err, "Couldn't load anomaly flags."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  useEffect(() => {
    if (!competitionId) {
      return;
    }
    let cancelled = false;
    (async () => {
      setDisciplineError(null);
      setDiscipline(null);
      try {
        const { disciplinaryRecords } = await api.moderation.listDiscipline(competitionId);
        if (!cancelled) {
          setDiscipline(disciplinaryRecords);
        }
      } catch (err) {
        if (!cancelled) {
          setDisciplineError(getErrorMessage(err, "Couldn't load disciplinary records."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionId]);

  const playerName = (id: string): string => players.find((player) => player.id === id)?.name ?? id;

  const flagColumns: Column<AnomalyFlag>[] = [
    { key: "reason", label: "Reason", render: (row) => row.reason.replace(/_/g, " ") },
    { key: "details", label: "Details", render: (row) => row.details },
    { key: "fixture", label: "Fixture", render: (row) => row.fixture_id },
    { key: "when", label: "Flagged", render: (row) => new Date(row.createdAt).toLocaleString() },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) =>
        row.status === "open" ? (
          <Button variant="secondary" size="small" onClick={() => setResolving(row)}>
            Resolve
          </Button>
        ) : (
          <span style={{ color: "var(--color-text-muted)", fontSize: 12 }}>
            Resolved {row.resolved_at ? new Date(row.resolved_at).toLocaleDateString() : ""}
          </span>
        ),
    },
  ];

  const disciplineColumns: Column<DisciplinaryRecordRow>[] = [
    { key: "player", label: "Player", render: (row) => playerName(row.player_id) },
    { key: "yellow", label: "Yellow cards", render: (row) => String(row.yellow_cards) },
    { key: "red", label: "Red cards", render: (row) => String(row.red_cards) },
  ];

  return (
    <>
      <PageHeader title="Moderation" subtitle="System-flagged anomalies, and disciplinary records by competition." />

      <section style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Anomaly Flags</h2>
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as AnomalyFlagStatus)}
              style={{ width: 140 }}
            >
              <option value="open">Open</option>
              <option value="resolved">Resolved</option>
            </Select>
            <Button variant="secondary" size="small" onClick={() => void refreshFlags()}>
              Refresh
            </Button>
          </div>
        </div>

        {flagsError ? <Banner variant="error">{flagsError}</Banner> : null}

        <Table
          columns={flagColumns}
          rows={flags}
          rowKey={(row) => row.id}
          emptyMessage={statusFilter === "open" ? "No open flags — nothing needs review." : "No resolved flags yet."}
        />
      </section>

      <section>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 var(--space-3)" }}>Disciplinary Records</h2>

        <div style={{ maxWidth: 320, marginBottom: "var(--space-4)" }}>
          <Field label="Competition" htmlFor="discipline-competition">
            <Select id="discipline-competition" value={competitionId} onChange={(event) => setCompetitionId(event.target.value)}>
              {competitions.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {disciplineError ? <Banner variant="error">{disciplineError}</Banner> : null}

        <Table
          columns={disciplineColumns}
          rows={discipline}
          rowKey={(row) => row.player_id}
          emptyMessage="No disciplinary records for this competition yet."
        />
      </section>

      {resolving ? (
        <ResolveFlagModal
          flag={resolving}
          onClose={() => setResolving(null)}
          onSaved={() => {
            setResolving(null);
            void refreshFlags();
          }}
        />
      ) : null}
    </>
  );
}

function ResolveFlagModal({ flag, onClose, onSaved }: { flag: AnomalyFlag; onClose: () => void; onSaved: () => void }) {
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await api.moderation.resolveFlag(flag.id, note.trim() || undefined);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't resolve this flag."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Resolve Flag"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleResolve()} disabled={submitting}>
            {submitting ? "Resolving…" : "Resolve"}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      <p style={{ marginTop: 0, color: "var(--color-text-secondary)" }}>{flag.details}</p>
      <Field label="Resolution note" htmlFor="resolution-note" hint="Optional — what you checked and why this is (or isn't) a real issue.">
        <TextInput id="resolution-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
    </Modal>
  );
}
