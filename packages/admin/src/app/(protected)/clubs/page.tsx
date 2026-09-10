"use client";

import type { Club } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Field, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { PermissionGate } from "../../../components/PermissionGate";
import { Table, type Column } from "../../../components/ui/Table";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

/** FR16, roster.manage gated. */
export default function ClubsPage() {
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Club | null>(null);
  const [deleting, setDeleting] = useState<Club | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { clubs: list } = await api.clubs.list();
        if (!cancelled) {
          setClubs(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load clubs."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { clubs: list } = await api.clubs.list();
      setClubs(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load clubs."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.clubs.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const columns: Column<Club>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
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
        title="Clubs"
        subtitle="Clubs your Organization's teams belong to."
        actions={
          <PermissionGate need="roster.manage">
            <Button onClick={() => setCreating(true)}>New Club</Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={clubs} rowKey={(row) => row.id} emptyMessage="No clubs yet." />

      {creating ? (
        <ClubFormModal
          title="New Club"
          onClose={() => setCreating(false)}
          onSubmit={(input) => api.clubs.create(input)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <ClubFormModal
          title={`Edit ${editing.name}`}
          initialName={editing.name}
          onClose={() => setEditing(null)}
          onSubmit={(input) => api.clubs.update(editing.id, input)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete club"
          description={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function ClubFormModal({
  title,
  initialName = "",
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (input: { name: string }) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this club."));
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
      <Field label="Name" htmlFor="club-name">
        <TextInput id="club-name" value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>
    </Modal>
  );
}
