"use client";

import { PERMISSIONS, type PermissionKey, type Role, type UserRole } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Field, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Table, type Column } from "../../../components/ui/Table";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

/** role.manage gated. Built directly against the Permission/Role/UserRole APIs — no dedicated "role builder" backend, this page just drives that API. */
export default function RolesPage() {
  const { user } = useAuth();
  const isPlatformOperator = user?.organization_id === null;
  // An org-scoped admin should only be offered the permissions that are
  // legal within an Organization's own role — the backend independently
  // rejects platform-scoped keys on an org-scoped role anyway, this just
  // avoids offering a checkbox that would always be refused.
  const assignablePermissions = PERMISSIONS.filter((permission) => isPlatformOperator || permission.scope === "organization");

  const [roles, setRoles] = useState<Role[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [managingAssignments, setManagingAssignments] = useState<Role | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { roles: list } = await api.roles.list();
        if (!cancelled) {
          setRoles(list);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load roles."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { roles: list } = await api.roles.list();
      setRoles(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load roles."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.roles.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const columns: Column<Role>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "permissions", label: "Permissions", render: (row) => `${row.permission_keys.length} granted` },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end" }}>
          <Button variant="secondary" size="small" onClick={() => setManagingAssignments(row)}>
            Assignments
          </Button>
          <Button variant="secondary" size="small" onClick={() => setEditing(row)}>
            Edit
          </Button>
          <Button variant="danger" size="small" onClick={() => setDeleting(row)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Create custom roles and assign them to users."
        actions={<Button onClick={() => setCreating(true)}>New Role</Button>}
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={roles} rowKey={(row) => row.id} emptyMessage="No roles yet." />

      {creating ? (
        <RoleFormModal
          title="New Role"
          assignablePermissions={assignablePermissions}
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            await api.roles.create(input);
          }}
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <RoleFormModal
          title={`Edit ${editing.name}`}
          assignablePermissions={assignablePermissions}
          initialName={editing.name}
          initialPermissionKeys={editing.permission_keys}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            await api.roles.update(editing.id, { name: input.name, permission_keys: input.permission_keys });
          }}
          onSaved={() => {
            setEditing(null);
            void refresh();
          }}
        />
      ) : null}

      {deleting ? (
        <ConfirmDialog
          title="Delete role"
          description={`Delete "${deleting.name}"? Anyone currently assigned this role will lose the permissions it grants.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {managingAssignments ? (
        <RoleAssignmentsModal role={managingAssignments} onClose={() => setManagingAssignments(null)} />
      ) : null}
    </>
  );
}

interface RoleFormInput {
  name: string;
  permission_keys: PermissionKey[];
}

function RoleFormModal({
  title,
  assignablePermissions,
  initialName = "",
  initialPermissionKeys = [],
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  assignablePermissions: typeof PERMISSIONS[number][];
  initialName?: string;
  initialPermissionKeys?: PermissionKey[];
  onClose: () => void;
  onSubmit: (input: RoleFormInput) => Promise<void>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [selected, setSelected] = useState<Set<PermissionKey>>(new Set(initialPermissionKeys));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: PermissionKey): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name, permission_keys: [...selected] });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this role."));
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

      <Field label="Name" htmlFor="role-name">
        <TextInput id="role-name" value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>

      <Field label="Permissions" htmlFor="role-permissions">
        <div id="role-permissions" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {assignablePermissions.map((permission) => (
            <label key={permission.key} style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={selected.has(permission.key)}
                onChange={() => toggle(permission.key)}
                style={{ marginTop: 2 }}
              />
              <span>
                <strong>{permission.key}</strong>
                <br />
                <span style={{ color: "var(--color-text-secondary)" }}>{permission.description}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function RoleAssignmentsModal({ role, onClose }: { role: Role; onClose: () => void }) {
  const [assignments, setAssignments] = useState<UserRole[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [assigning, setAssigning] = useState(false);

  const load = async (): Promise<void> => {
    setError(null);
    try {
      const { userRoles } = await api.roles.listAssignments(role.id);
      setAssignments(userRoles);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't load assignments."));
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      try {
        const { userRoles } = await api.roles.listAssignments(role.id);
        if (!cancelled) {
          setAssignments(userRoles);
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, "Couldn't load assignments."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role.id]);

  const handleAssign = async (): Promise<void> => {
    if (!userId.trim()) {
      return;
    }
    setAssigning(true);
    setError(null);
    try {
      await api.roles.assign(role.id, userId.trim());
      setUserId("");
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't assign this role. Double-check the user ID."));
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (targetUserId: string): Promise<void> => {
    setError(null);
    try {
      await api.roles.unassign(role.id, targetUserId);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't remove this assignment."));
    }
  };

  return (
    <Modal title={`Assignments · ${role.name}`} onClose={onClose}>
      {error ? <Banner variant="error">{error}</Banner> : null}

      <Banner variant="info">
        There&apos;s no user directory to pick from yet — enter a user&apos;s ID directly. Ask the user for their ID, or find it via
        their Organization&apos;s own records.
      </Banner>

      <div style={{ display: "flex", gap: "var(--space-2)", margin: "var(--space-4) 0" }}>
        <TextInput
          value={userId}
          onChange={(event) => setUserId(event.target.value)}
          placeholder="User ID"
          style={{ flex: 1 }}
        />
        <Button onClick={() => void handleAssign()} disabled={assigning || !userId.trim()}>
          {assigning ? "Assigning…" : "Assign"}
        </Button>
      </div>

      {assignments === null ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : assignments.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>No one holds this role yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {assignments.map((assignment) => (
            <li
              key={assignment.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}
            >
              {assignment.user_id}
              <Button variant="danger" size="small" onClick={() => void handleUnassign(assignment.user_id)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
