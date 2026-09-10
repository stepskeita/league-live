"use client";

import type { Location, Venue } from "@leaguelive/shared";
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

interface VenueFormState {
  name: string;
  address: string;
  city: string;
  country: string;
}

const EMPTY_FORM: VenueFormState = { name: "", address: "", city: "", country: "" };

/** FR16, roster.manage gated. */
export default function VenuesPage() {
  const [venues, setVenues] = useState<Venue[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [deleting, setDeleting] = useState<Venue | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { venues: list } = await api.venues.list();
        if (!cancelled) {
          setVenues(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load venues."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { venues: list } = await api.venues.list();
      setVenues(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load venues."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.venues.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const columns: Column<Venue>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "city", label: "City", render: (row) => row.location.city ?? "—" },
    { key: "country", label: "Country", render: (row) => row.location.country ?? "—" },
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
        title="Venues"
        subtitle="Grounds your Organization's fixtures are played at."
        actions={
          <PermissionGate need="roster.manage">
            <Button onClick={() => setCreating(true)}>New Venue</Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={venues} rowKey={(row) => row.id} emptyMessage="No venues yet." />

      {creating ? (
        <VenueFormModal
          title="New Venue"
          onClose={() => setCreating(false)}
          onSubmit={(input) => api.venues.create(input)}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <VenueFormModal
          title={`Edit ${editing.name}`}
          initial={{
            name: editing.name,
            address: editing.location.address ?? "",
            city: editing.location.city ?? "",
            country: editing.location.country ?? "",
          }}
          onClose={() => setEditing(null)}
          onSubmit={(input) => api.venues.update(editing.id, input)}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete venue"
          description={`Delete "${deleting.name}"? This can't be undone.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}
    </>
  );
}

function VenueFormModal({
  title,
  initial = EMPTY_FORM,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  initial?: VenueFormState;
  onClose: () => void;
  onSubmit: (input: { name: string; location: Location }) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<VenueFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        location: { address: form.address || undefined, city: form.city || undefined, country: form.country || undefined },
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this venue."));
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
      <Field label="Name" htmlFor="venue-name">
        <TextInput id="venue-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </Field>
      <Field label="Address" htmlFor="venue-address">
        <TextInput id="venue-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
      </Field>
      <Field label="City" htmlFor="venue-city">
        <TextInput id="venue-city" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
      </Field>
      <Field label="Country" htmlFor="venue-country">
        <TextInput id="venue-country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
      </Field>
    </Modal>
  );
}
