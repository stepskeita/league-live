"use client";

import {
  FIXTURE_STATUSES,
  type Competition,
  type CompetitionEntry,
  type Fixture,
  type FixtureStatus,
  type Team,
  type Venue,
} from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Field, Select, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { PermissionGate } from "../../../components/PermissionGate";
import { Table, type Column } from "../../../components/ui/Table";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

interface FixtureFormState {
  competition_id: string;
  home_entry_id: string;
  away_entry_id: string;
  venue_id: string;
  datetime: string;
  status: FixtureStatus;
}

/** FR18/FR19, fixture.manage gated (reporter assignment is the separate reporter.assign permission). */
export default function FixturesPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitionFilter, setCompetitionFilter] = useState("");
  const [entriesByCompetition, setEntriesByCompetition] = useState<Record<string, CompetitionEntry[]>>({});

  const [fixtures, setFixtures] = useState<Fixture[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Fixture | null>(null);
  const [deleting, setDeleting] = useState<Fixture | null>(null);
  const [assigningReporter, setAssigningReporter] = useState<Fixture | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [{ competitions: compList }, { venues: venueList }, { teams: teamList }] = await Promise.all([
          api.competitions.list(),
          api.venues.list(),
          api.teams.list(),
        ]);
        if (!cancelled) {
          setCompetitions(compList);
          setVenues(venueList);
          setTeams(teamList);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load fixtures."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEntries = async (competitionId: string): Promise<CompetitionEntry[]> => {
    const cached = entriesByCompetition[competitionId];
    if (cached) {
      return cached;
    }
    const { competitionEntries } = await api.competitions.listEntries(competitionId);
    setEntriesByCompetition((prev) => ({ ...prev, [competitionId]: competitionEntries }));
    return competitionEntries;
  };

  const refresh = async (): Promise<void> => {
    try {
      const { fixtures: list } = await api.fixtures.list(competitionFilter || undefined);
      setFixtures(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load fixtures."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setFixtures(null);
      try {
        const { fixtures: list } = await api.fixtures.list(competitionFilter || undefined);
        if (!cancelled) {
          setFixtures(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load fixtures."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [competitionFilter]);

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.fixtures.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const competitionName = (id: string): string => competitions.find((comp) => comp.id === id)?.name ?? id;
  const venueName = (id: string | null): string => (id ? (venues.find((venue) => venue.id === id)?.name ?? id) : "TBD");
  const entryTeamName = (competitionId: string, entryId: string): string => {
    const entries = entriesByCompetition[competitionId];
    const teamId = entries?.find((entry) => entry.id === entryId)?.team_id;
    return teamId ? (teams.find((team) => team.id === teamId)?.name ?? teamId) : entryId;
  };

  const columns: Column<Fixture>[] = [
    { key: "competition", label: "Competition", render: (row) => competitionName(row.competition_id) },
    {
      key: "matchup",
      label: "Fixture",
      render: (row) => `${entryTeamName(row.competition_id, row.home_entry_id)} vs ${entryTeamName(row.competition_id, row.away_entry_id)}`,
    },
    { key: "datetime", label: "Date", render: (row) => new Date(row.datetime).toLocaleString() },
    { key: "venue", label: "Venue", render: (row) => venueName(row.venue_id) },
    { key: "status", label: "Status", render: (row) => row.status.replace(/_/g, " ") },
    { key: "reporter", label: "Reporter", render: (row) => row.reporter_user_id ?? "Unassigned" },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <PermissionGate need="reporter.assign">
            <Button variant="secondary" size="small" onClick={() => setAssigningReporter(row)}>
              Reporter
            </Button>
          </PermissionGate>
          <PermissionGate need="fixture.manage">
            <Button
              variant="secondary"
              size="small"
              onClick={async () => {
                await loadEntries(row.competition_id);
                setEditing(row);
              }}
            >
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
        title="Fixtures"
        subtitle="Scheduled matches, and who's reporting on them."
        actions={
          <PermissionGate need="fixture.manage">
            <Button
              onClick={async () => {
                if (competitions[0]) {
                  await loadEntries(competitions[0].id);
                }
                setCreating(true);
              }}
              disabled={competitions.length === 0}
            >
              New Fixture
            </Button>
          </PermissionGate>
        }
      />

      <div style={{ maxWidth: 320, marginBottom: "var(--space-4)" }}>
        <Field label="Competition" htmlFor="fixture-competition-filter">
          <Select id="fixture-competition-filter" value={competitionFilter} onChange={(event) => setCompetitionFilter(event.target.value)}>
            <option value="">All competitions</option>
            {competitions.map((comp) => (
              <option key={comp.id} value={comp.id}>
                {comp.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={fixtures} rowKey={(row) => row.id} emptyMessage="No fixtures yet." />

      {creating ? (
        <FixtureFormModal
          title="New Fixture"
          competitions={competitions}
          venues={venues}
          entriesByCompetition={entriesByCompetition}
          teams={teams}
          loadEntries={loadEntries}
          onClose={() => setCreating(false)}
          onSubmit={(input) =>
            api.fixtures.create({
              competition_id: input.competition_id,
              home_entry_id: input.home_entry_id,
              away_entry_id: input.away_entry_id,
              venue_id: input.venue_id || null,
              datetime: new Date(input.datetime).toISOString(),
              status: input.status,
            })
          }
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <FixtureFormModal
          title="Edit Fixture"
          competitions={competitions}
          venues={venues}
          entriesByCompetition={entriesByCompetition}
          teams={teams}
          loadEntries={loadEntries}
          initial={{
            competition_id: editing.competition_id,
            home_entry_id: editing.home_entry_id,
            away_entry_id: editing.away_entry_id,
            venue_id: editing.venue_id ?? "",
            datetime: toLocalDatetimeInput(editing.datetime),
            status: editing.status,
          }}
          lockCompetition
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            api.fixtures.update(editing.id, {
              home_entry_id: input.home_entry_id,
              away_entry_id: input.away_entry_id,
              venue_id: input.venue_id || null,
              datetime: new Date(input.datetime).toISOString(),
              status: input.status,
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
          title="Delete fixture"
          description="Delete this fixture? This can't be undone."
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {assigningReporter ? (
        <ReporterAssignmentModal
          fixture={assigningReporter}
          onClose={() => setAssigningReporter(null)}
          onSaved={() => {
            setAssigningReporter(null);
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}

function toLocalDatetimeInput(isoString: string): string {
  const date = new Date(isoString);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FixtureFormModal({
  title,
  competitions,
  venues,
  entriesByCompetition,
  teams,
  loadEntries,
  initial,
  lockCompetition = false,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  competitions: Competition[];
  venues: Venue[];
  entriesByCompetition: Record<string, CompetitionEntry[]>;
  teams: Team[];
  loadEntries: (competitionId: string) => Promise<CompetitionEntry[]>;
  initial?: FixtureFormState;
  lockCompetition?: boolean;
  onClose: () => void;
  onSubmit: (input: FixtureFormState) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FixtureFormState>(
    initial ?? {
      competition_id: competitions[0]?.id ?? "",
      home_entry_id: "",
      away_entry_id: "",
      venue_id: "",
      datetime: "",
      status: "scheduled",
    },
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = entriesByCompetition[form.competition_id] ?? [];
  const teamName = (teamId: string): string => teams.find((team) => team.id === teamId)?.name ?? teamId;

  const handleCompetitionChange = async (competitionId: string): Promise<void> => {
    setForm((prev) => ({ ...prev, competition_id: competitionId, home_entry_id: "", away_entry_id: "" }));
    await loadEntries(competitionId);
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    if (form.home_entry_id === form.away_entry_id) {
      setError("Home and away must be different entries.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this fixture."));
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

      <Field label="Competition" htmlFor="fixture-competition">
        <Select
          id="fixture-competition"
          value={form.competition_id}
          onChange={(event) => void handleCompetitionChange(event.target.value)}
          disabled={lockCompetition}
        >
          {competitions.map((comp) => (
            <option key={comp.id} value={comp.id}>
              {comp.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Home entry" htmlFor="fixture-home">
        <Select id="fixture-home" value={form.home_entry_id} onChange={(event) => setForm({ ...form, home_entry_id: event.target.value })}>
          <option value="">Select…</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {teamName(entry.team_id)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Away entry" htmlFor="fixture-away">
        <Select id="fixture-away" value={form.away_entry_id} onChange={(event) => setForm({ ...form, away_entry_id: event.target.value })}>
          <option value="">Select…</option>
          {entries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {teamName(entry.team_id)}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Venue" htmlFor="fixture-venue">
        <Select id="fixture-venue" value={form.venue_id} onChange={(event) => setForm({ ...form, venue_id: event.target.value })}>
          <option value="">TBD</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Date & time" htmlFor="fixture-datetime">
        <TextInput
          id="fixture-datetime"
          type="datetime-local"
          value={form.datetime}
          onChange={(event) => setForm({ ...form, datetime: event.target.value })}
          required
        />
      </Field>

      <Field label="Status" htmlFor="fixture-status">
        <Select id="fixture-status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as FixtureStatus })}>
          {FIXTURE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

function ReporterAssignmentModal({
  fixture,
  onClose,
  onSaved,
}: {
  fixture: Fixture;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [userId, setUserId] = useState(fixture.reporter_user_id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAssign = async (): Promise<void> => {
    if (!userId.trim()) {
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.fixtures.assignReporter(fixture.id, userId.trim());
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't assign this reporter. Double-check the user ID."));
      setSubmitting(false);
    }
  };

  const handleUnassign = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await api.fixtures.unassignReporter(fixture.id);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove the assigned reporter."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Assign Reporter"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          {fixture.reporter_user_id ? (
            <Button variant="danger" onClick={() => void handleUnassign()} disabled={submitting}>
              Unassign
            </Button>
          ) : null}
          <Button onClick={() => void handleAssign()} disabled={submitting || !userId.trim()}>
            {submitting ? "Saving…" : "Assign"}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}
      <Banner variant="info">There&apos;s no user directory to pick from yet — enter the Reporter&apos;s user ID directly.</Banner>
      <div style={{ marginTop: "var(--space-4)" }}>
        <Field label="Reporter user ID" htmlFor="reporter-user-id">
          <TextInput id="reporter-user-id" value={userId} onChange={(event) => setUserId(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
