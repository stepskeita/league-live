"use client";

import { ORGANIZATION_TYPES, type Organization, type OrganizationType } from "@leaguelive/shared";
import { useCallback, useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { Field, TextInput, Select } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Table, type Column } from "../../../components/ui/Table";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

interface OrgFormState {
  name: string;
  type: OrganizationType;
  country: string;
  confederation: string;
  email: string;
  phone: string;
}

interface AdminFormState {
  name: string;
  email: string;
  phone: string;
  password: string;
}

const EMPTY_ORG_FORM: OrgFormState = { name: "", type: "federation", country: "", confederation: "", email: "", phone: "" };
const EMPTY_ADMIN_FORM: AdminFormState = { name: "", email: "", phone: "", password: "" };

/** FR1/FR2, Platform Operator only. Onboarding creates the Organization, seeds its default roles, and creates + assigns its first admin, all server-side in one call. */
export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoadError(null);
    try {
      const { organizations: list } = await api.organizations.list();
      setOrganizations(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load Organizations."));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { organizations: list } = await api.organizations.list();
        if (!cancelled) {
          setOrganizations(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load Organizations."));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const columns: Column<Organization>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "type", label: "Type", render: (row) => row.type.replace(/_/g, " ") },
    { key: "country", label: "Country", render: (row) => row.country ?? "—" },
    { key: "email", label: "Contact", render: (row) => row.contact.email },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <Button variant="secondary" size="small" onClick={() => setEditing(row)}>
          Edit
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Organizations"
        subtitle="Onboard and manage every Organization on the platform."
        actions={<Button onClick={() => setCreating(true)}>Onboard Organization</Button>}
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={organizations} rowKey={(row) => row.id} emptyMessage="No Organizations yet." />

      {creating ? (
        <OnboardOrganizationModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      ) : null}

      {editing ? (
        <EditOrganizationModal
          organization={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      ) : null}
    </>
  );
}

function OnboardOrganizationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [org, setOrg] = useState<OrgFormState>(EMPTY_ORG_FORM);
  const [admin, setAdmin] = useState<AdminFormState>(EMPTY_ADMIN_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await api.organizations.create({
        name: org.name,
        type: org.type,
        country: org.country || null,
        confederation: org.confederation || null,
        contact: { email: org.email, phone: org.phone || undefined },
        admin: { name: admin.name, email: admin.email, phone: admin.phone || undefined, password: admin.password },
      });
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't onboard this Organization."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Onboard Organization"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "Onboarding…" : "Onboard"}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}

      <Field label="Name" htmlFor="org-name">
        <TextInput id="org-name" value={org.name} onChange={(event) => setOrg({ ...org, name: event.target.value })} required />
      </Field>
      <Field label="Type" htmlFor="org-type">
        <Select id="org-type" value={org.type} onChange={(event) => setOrg({ ...org, type: event.target.value as OrganizationType })}>
          {ORGANIZATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Country" htmlFor="org-country" hint="Leave blank for a confederation-level Organization.">
        <TextInput id="org-country" value={org.country} onChange={(event) => setOrg({ ...org, country: event.target.value })} />
      </Field>
      <Field label="Confederation" htmlFor="org-confederation">
        <TextInput
          id="org-confederation"
          value={org.confederation}
          onChange={(event) => setOrg({ ...org, confederation: event.target.value })}
        />
      </Field>
      <Field label="Contact email" htmlFor="org-email">
        <TextInput
          id="org-email"
          type="email"
          value={org.email}
          onChange={(event) => setOrg({ ...org, email: event.target.value })}
          required
        />
      </Field>
      <Field label="Contact phone" htmlFor="org-phone">
        <TextInput id="org-phone" value={org.phone} onChange={(event) => setOrg({ ...org, phone: event.target.value })} />
      </Field>

      <hr style={{ border: "none", borderTop: "1px solid var(--color-border)", margin: "var(--space-5) 0" }} />
      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 var(--space-3)" }}>First Organization Admin</p>

      <Field label="Name" htmlFor="admin-name">
        <TextInput
          id="admin-name"
          value={admin.name}
          onChange={(event) => setAdmin({ ...admin, name: event.target.value })}
          required
        />
      </Field>
      <Field label="Email" htmlFor="admin-email">
        <TextInput
          id="admin-email"
          type="email"
          value={admin.email}
          onChange={(event) => setAdmin({ ...admin, email: event.target.value })}
          required
        />
      </Field>
      <Field label="Phone" htmlFor="admin-phone">
        <TextInput id="admin-phone" value={admin.phone} onChange={(event) => setAdmin({ ...admin, phone: event.target.value })} />
      </Field>
      <Field label="Temporary password" htmlFor="admin-password" hint="At least 8 characters. Share this with them securely.">
        <TextInput
          id="admin-password"
          type="password"
          value={admin.password}
          onChange={(event) => setAdmin({ ...admin, password: event.target.value })}
          minLength={8}
          required
        />
      </Field>
    </Modal>
  );
}

function EditOrganizationModal({
  organization,
  onClose,
  onSaved,
}: {
  organization: Organization;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<OrgFormState>({
    name: organization.name,
    type: organization.type,
    country: organization.country ?? "",
    confederation: organization.confederation ?? "",
    email: organization.contact.email,
    phone: organization.contact.phone ?? "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await api.organizations.update(organization.id, {
        name: form.name,
        type: form.type,
        country: form.country || null,
        confederation: form.confederation || null,
        contact: { email: form.email, phone: form.phone || undefined },
      });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this Organization."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Edit ${organization.name}`}
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
      <Field label="Name" htmlFor="edit-org-name">
        <TextInput id="edit-org-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
      </Field>
      <Field label="Type" htmlFor="edit-org-type">
        <Select
          id="edit-org-type"
          value={form.type}
          onChange={(event) => setForm({ ...form, type: event.target.value as OrganizationType })}
        >
          {ORGANIZATION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Country" htmlFor="edit-org-country">
        <TextInput id="edit-org-country" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
      </Field>
      <Field label="Confederation" htmlFor="edit-org-confederation">
        <TextInput
          id="edit-org-confederation"
          value={form.confederation}
          onChange={(event) => setForm({ ...form, confederation: event.target.value })}
        />
      </Field>
      <Field label="Contact email" htmlFor="edit-org-email">
        <TextInput
          id="edit-org-email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
      </Field>
      <Field label="Contact phone" htmlFor="edit-org-phone">
        <TextInput id="edit-org-phone" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
      </Field>
    </Modal>
  );
}
