"use client";

import { PLAYER_POSITIONS, type Player, type PlayerPosition } from "@leaguelive/shared";
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

interface PlayerFormState {
  name: string;
  position: PlayerPosition;
  date_of_birth: string;
}

const EMPTY_FORM: PlayerFormState = { name: "", position: "goalkeeper", date_of_birth: "" };

/** FR16/FR20, roster.manage gated. */
export default function PlayersPage() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [deleting, setDeleting] = useState<Player | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { players: list } = await api.players.list();
        if (!cancelled) {
          setPlayers(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load players."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { players: list } = await api.players.list();
      setPlayers(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load players."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.players.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const columns: Column<Player>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "position", label: "Position", render: (row) => row.position },
    { key: "dob", label: "Date of birth", render: (row) => row.date_of_birth.slice(0, 10) },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <PermissionGate need="roster.manage">
          <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
            <Button variant="secondary" size="small" onClick={() => setEditing(row)}>
              Edit
            </Button>
            <Button variant="danger" size="small" onClick={() => setDeleting(row)}>
              Delete
            </Button>
          </div>
        </PermissionGate>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Players"
        subtitle="Every player registered to your Organization."
        actions={
          <PermissionGate need="roster.manage">
            <Button onClick={() => setCreating(true)}>New Player</Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={players} rowKey={(row) => row.id} emptyMessage="No players yet." />

      {creating ? (
        <PlayerFormModal
          title="New Player"
          onClose={() => setCreating(false)}
          onSubmit={(input) => api.players.create(input)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <PlayerFormModal
          title={`Edit ${editing.name}`}
          initial={{ name: editing.name, position: editing.position, date_of_birth: editing.date_of_birth.slice(0, 10) }}
          onClose={() => setEditing(null)}
          onSubmit={(input) => api.players.update(editing.id, input)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete player"
          description={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function PlayerFormModal({
  title,
  initial = EMPTY_FORM,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  initial?: PlayerFormState;
  onClose: () => void;
  onSubmit: (input: PlayerFormState) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PlayerFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this player."));
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
      <Field label="Name" htmlFor="player-name">
        <TextInput id="player-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </Field>
      <Field label="Position" htmlFor="player-position">
        <Select
          id="player-position"
          value={form.position}
          onChange={(event) => setForm({ ...form, position: event.target.value as PlayerPosition })}
        >
          {PLAYER_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {position}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date of birth" htmlFor="player-dob">
        <TextInput
          id="player-dob"
          type="date"
          value={form.date_of_birth}
          onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })}
          required
        />
      </Field>
    </Modal>
  );
}
