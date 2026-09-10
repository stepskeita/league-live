"use client";

import { COMPETITION_FORMATS, type Competition, type CompetitionEntry, type CompetitionFormat, type Team } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Field, Select, TextArea, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { PermissionGate } from "../../../components/PermissionGate";
import { Table, type Column } from "../../../components/ui/Table";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

interface CompetitionFormState {
  name: string;
  category: string;
  season: string;
  format_type: CompetitionFormat;
  format_config_json: string;
  ruleset_json: string;
}

const EMPTY_FORM: CompetitionFormState = {
  name: "",
  category: "",
  season: "",
  format_type: "league",
  format_config_json: "{}",
  ruleset_json: "{}",
};

function parseJsonObject(raw: string, fieldLabel: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${fieldLabel} must be valid JSON.`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${fieldLabel} must be a JSON object.`);
  }
  return parsed as Record<string, unknown>;
}

/** FR13-FR17, competition.manage gated. */
export default function CompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [deleting, setDeleting] = useState<Competition | null>(null);
  const [managingEntries, setManagingEntries] = useState<Competition | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { competitions: list } = await api.competitions.list();
        if (!cancelled) {
          setCompetitions(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load competitions."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { competitions: list } = await api.competitions.list();
      setCompetitions(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load competitions."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.competitions.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const columns: Column<Competition>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "category", label: "Category", render: (row) => row.category },
    { key: "format", label: "Format", render: (row) => row.format.type.replace(/_/g, " ") },
    { key: "season", label: "Season", render: (row) => row.season },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <Button variant="secondary" size="small" onClick={() => setManagingEntries(row)}>
            Entries
          </Button>
          <PermissionGate need="competition.manage">
            <Button variant="secondary" size="small" onClick={() => setEditing(row)}>
              Edit
            </Button>
            <Button variant="danger" size="small" onClick={() => setDeleting(row)}>
              Delete
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Competitions"
        subtitle="Leagues, cups, and tournaments run by your Organization."
        actions={
          <PermissionGate need="competition.manage">
            <Button onClick={() => setCreating(true)}>New Competition</Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={competitions} rowKey={(row) => row.id} emptyMessage="No competitions yet." />

      {creating ? (
        <CompetitionFormModal
          title="New Competition"
          onClose={() => setCreating(false)}
          onSubmit={(input) =>
            api.competitions.create({
              name: input.name,
              category: input.category,
              season: input.season,
              format: { type: input.format_type, config: parseJsonObject(input.format_config_json, "Format config") },
              ruleset: parseJsonObject(input.ruleset_json, "Ruleset"),
            })
          }
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <CompetitionFormModal
          title={`Edit ${editing.name}`}
          initial={{
            name: editing.name,
            category: editing.category,
            season: editing.season,
            format_type: editing.format.type,
            format_config_json: JSON.stringify(editing.format.config, null, 2),
            ruleset_json: JSON.stringify(editing.ruleset, null, 2),
          }}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            api.competitions.update(editing.id, {
              name: input.name,
              category: input.category,
              season: input.season,
              format: { type: input.format_type, config: parseJsonObject(input.format_config_json, "Format config") },
              ruleset: parseJsonObject(input.ruleset_json, "Ruleset"),
            })
          }
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete competition"
          description={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {managingEntries ? <CompetitionEntriesModal competition={managingEntries} onClose={() => setManagingEntries(null)} /> : null}
    </>
  );
}

function CompetitionFormModal({
  title,
  initial = EMPTY_FORM,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  initial?: CompetitionFormState;
  onClose: () => void;
  onSubmit: (input: CompetitionFormState) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<CompetitionFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this competition."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      <Field label="Name" htmlFor="comp-name">
        <TextInput id="comp-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </Field>
      <Field label="Category" htmlFor="comp-category" hint="e.g. Men's Senior, U19.">
        <TextInput
          id="comp-category"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          required
        />
      </Field>
      <Field label="Season" htmlFor="comp-season" hint="e.g. 2025/26.">
        <TextInput id="comp-season" value={form.season} onChange={(event) => setForm({ ...form, season: event.target.value })} required />
      </Field>
      <Field label="Format" htmlFor="comp-format">
        <Select
          id="comp-format"
          value={form.format_type}
          onChange={(event) => setForm({ ...form, format_type: event.target.value as CompetitionFormat })}
        >
          {COMPETITION_FORMATS.map((format) => (
            <option key={format} value={format}>
              {format.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Format config (JSON)" htmlFor="comp-format-config" hint="Format-specific settings, e.g. group count.">
        <TextArea
          id="comp-format-config"
          rows={4}
          value={form.format_config_json}
          onChange={(event) => setForm({ ...form, format_config_json: event.target.value })}
        />
      </Field>
      <Field label="Ruleset (JSON)" htmlFor="comp-ruleset" hint="Points per win/draw/loss, tiebreaker order, etc.">
        <TextArea
          id="comp-ruleset"
          rows={4}
          value={form.ruleset_json}
          onChange={(event) => setForm({ ...form, ruleset_json: event.target.value })}
        />
      </Field>
    </Modal>
  );
}

function CompetitionEntriesModal({ competition, onClose }: { competition: Competition; onClose: () => void }) {
  const [entries, setEntries] = useState<CompetitionEntry[] | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [teamId, setTeamId] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async (): Promise<void> => {
    setError(null);
    try {
      const [{ competitionEntries }, { teams: teamList }] = await Promise.all([
        api.competitions.listEntries(competition.id),
        api.teams.list(),
      ]);
      setEntries(competitionEntries);
      setTeams(teamList);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load entries."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [{ competitionEntries }, { teams: teamList }] = await Promise.all([
          api.competitions.listEntries(competition.id),
          api.teams.list(),
        ]);
        if (!cancelled) {
          setEntries(competitionEntries);
          setTeams(teamList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load entries."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competition.id]);

  const teamName = (id: string): string => teams.find((team) => team.id === id)?.name ?? id;

  const handleAdd = async (): Promise<void> => {
    if (!teamId.trim()) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await api.competitions.addEntry(competition.id, teamId.trim());
      setTeamId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add this team. Double-check the team ID."));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (entryId: string): Promise<void> => {
    setError(null);
    try {
      await api.competitions.removeEntry(competition.id, entryId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove this entry."));
    }
  };

  return (
    <Modal title={`Entries · ${competition.name}`} onClose={onClose}>
      {error ? <Banner variant="error">{error}</Banner> : null}

      <PermissionGate need="competition.manage">
        <Banner variant="info">
          A competition can include teams from other Organizations (FR17) — pick from your own Organization&apos;s teams below,
          or enter another Organization&apos;s team ID directly.
        </Banner>
        <div style={{ display: "flex", gap: "var(--space-2)", margin: "var(--space-4) 0", alignItems: "flex-end" }}>
          <Field label="Team" htmlFor="entry-team">
            <Select id="entry-team" value={teamId} onChange={(event) => setTeamId(event.target.value)}>
              <option value="">Select a team, or type an ID below</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
          <TextInput value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Team ID" style={{ flex: 1 }} />
          <Button onClick={() => void handleAdd()} disabled={adding || !teamId.trim()}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </div>
      </PermissionGate>

      {entries === null ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : entries.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No teams entered yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {entries.map((entry) => (
            <li key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              {teamName(entry.team_id)}
              <PermissionGate need="competition.manage">
                <Button variant="danger" size="small" onClick={() => void handleRemove(entry.id)}>
                  Remove
                </Button>
              </PermissionGate>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
