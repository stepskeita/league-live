"use client";

import type { Club, Player, RosterEntry, Team, Venue } from "@leaguelive/shared";
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

interface TeamFormState {
  name: string;
  category: string;
  club_id: string;
  venue_id: string;
}

/** FR16/FR20, roster.manage gated. */
export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [managingRoster, setManagingRoster] = useState<Team | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [{ teams: teamList }, { clubs: clubList }, { venues: venueList }] = await Promise.all([
          api.teams.list(),
          api.clubs.list(),
          api.venues.list(),
        ]);
        if (!cancelled) {
          setTeams(teamList);
          setClubs(clubList);
          setVenues(venueList);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load teams."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { teams: list } = await api.teams.list();
      setTeams(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load teams."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.teams.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const clubName = (id: string): string => clubs.find((club) => club.id === id)?.name ?? id;
  const venueName = (id: string | null): string => (id ? (venues.find((venue) => venue.id === id)?.name ?? id) : "—");

  const columns: Column<Team>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "category", label: "Category", render: (row) => row.category },
    { key: "club", label: "Club", render: (row) => clubName(row.club_id) },
    { key: "venue", label: "Home venue", render: (row) => venueName(row.venue_id) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <PermissionGate need="roster.manage">
            <Button variant="secondary" size="small" onClick={() => setManagingRoster(row)}>
              Roster
            </Button>
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
        title="Teams"
        subtitle="Teams within your Organization, and their player rosters."
        actions={
          <PermissionGate need="roster.manage">
            <Button onClick={() => setCreating(true)} disabled={clubs.length === 0}>
              New Team
            </Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}
      {clubs.length === 0 && teams !== null ? (
        <Banner variant="info">Create a Club first — every Team belongs to one.</Banner>
      ) : null}

      <Table columns={columns} rows={teams} rowKey={(row) => row.id} emptyMessage="No teams yet." />

      {creating ? (
        <TeamFormModal
          title="New Team"
          clubs={clubs}
          venues={venues}
          onClose={() => setCreating(false)}
          onSubmit={(input) =>
            api.teams.create({
              name: input.name,
              category: input.category,
              club_id: input.club_id,
              venue_id: input.venue_id || null,
            })
          }
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <TeamFormModal
          title={`Edit ${editing.name}`}
          clubs={clubs}
          venues={venues}
          initial={{
            name: editing.name,
            category: editing.category,
            club_id: editing.club_id,
            venue_id: editing.venue_id ?? "",
          }}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            api.teams.update(editing.id, {
              name: input.name,
              category: input.category,
              club_id: input.club_id,
              venue_id: input.venue_id || null,
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
          title="Delete team"
          description={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {managingRoster ? <TeamRosterModal team={managingRoster} onClose={() => setManagingRoster(null)} /> : null}
    </>
  );
}

function TeamFormModal({
  title,
  clubs,
  venues,
  initial,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  clubs: Club[];
  venues: Venue[];
  initial?: TeamFormState;
  onClose: () => void;
  onSubmit: (input: TeamFormState) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<TeamFormState>(
    initial ?? { name: "", category: "", club_id: clubs[0]?.id ?? "", venue_id: "" },
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this team."));
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
      <Field label="Name" htmlFor="team-name">
        <TextInput id="team-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </Field>
      <Field label="Category" htmlFor="team-category" hint="e.g. Men's Senior, U19, Women's Senior.">
        <TextInput
          id="team-category"
          value={form.category}
          onChange={(event) => setForm({ ...form, category: event.target.value })}
          required
        />
      </Field>
      <Field label="Club" htmlFor="team-club">
        <Select id="team-club" value={form.club_id} onChange={(event) => setForm({ ...form, club_id: event.target.value })}>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Home venue" htmlFor="team-venue">
        <Select id="team-venue" value={form.venue_id} onChange={(event) => setForm({ ...form, venue_id: event.target.value })}>
          <option value="">None</option>
          {venues.map((venue) => (
            <option key={venue.id} value={venue.id}>
              {venue.name}
            </option>
          ))}
        </Select>
      </Field>
    </Modal>
  );
}

function TeamRosterModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const [roster, setRoster] = useState<RosterEntry[] | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState("");
  const [season, setSeason] = useState("");
  const [adding, setAdding] = useState(false);

  const load = async (): Promise<void> => {
    setError(null);
    try {
      const [{ rosterEntries }, { players: playerList }] = await Promise.all([
        api.teams.listRoster(team.id),
        api.players.list(),
      ]);
      setRoster(rosterEntries);
      setPlayers(playerList);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load this team's roster."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const [{ rosterEntries }, { players: playerList }] = await Promise.all([
          api.teams.listRoster(team.id),
          api.players.list(),
        ]);
        if (!cancelled) {
          setRoster(rosterEntries);
          setPlayers(playerList);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load this team's roster."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [team.id]);

  const playerName = (id: string): string => players.find((player) => player.id === id)?.name ?? id;

  const handleAdd = async (): Promise<void> => {
    if (!playerId || !season.trim()) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await api.teams.addToRoster(team.id, { player_id: playerId, season: season.trim() });
      setPlayerId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't add this player to the roster."));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (entryId: string): Promise<void> => {
    setError(null);
    try {
      await api.teams.removeFromRoster(team.id, entryId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove this roster entry."));
    }
  };

  return (
    <Modal title={`Roster · ${team.name}`} onClose={onClose}>
      {error ? <Banner variant="error">{error}</Banner> : null}

      <PermissionGate need="roster.manage">
        <div style={{ display: "flex", gap: "var(--space-2)", margin: "0 0 var(--space-4)", alignItems: "flex-end" }}>
          <Field label="Player" htmlFor="roster-player">
            <Select id="roster-player" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              <option value="">Select a player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Season" htmlFor="roster-season">
            <TextInput id="roster-season" value={season} onChange={(event) => setSeason(event.target.value)} placeholder="2025/26" />
          </Field>
          <Button onClick={() => void handleAdd()} disabled={adding || !playerId || !season.trim()}>
            {adding ? "Adding…" : "Add"}
          </Button>
        </div>
      </PermissionGate>

      {roster === null ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : roster.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No players on this roster yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {roster.map((entry) => (
            <li key={entry.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              {playerName(entry.player_id)} — {entry.season}
              <PermissionGate need="roster.manage">
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
