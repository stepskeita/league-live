"use client";

import type { AuditLogEntry, Organization } from "@leaguelive/shared";
import { useEffect, useState, type CSSProperties } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { Field, Select } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Table, type Column } from "../../../components/ui/Table";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

const PAGE_SIZE = 50;

/** FR11/FR12, audit.view gated. Serves both the Platform Operator's cross-Organization view and an Organization-scoped user's own view — the backend auto-scopes GET /audit-log-entries to the caller's Organization either way, so this is one page, not two. */
export default function AuditLogPage() {
  const { user } = useAuth();
  const isPlatformOperator = user?.organization_id === null;

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationFilter, setOrganizationFilter] = useState<string>("");

  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [viewing, setViewing] = useState<AuditLogEntry | null>(null);

  useEffect(() => {
    if (!isPlatformOperator) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { organizations: list } = await api.organizations.list();
        if (!cancelled) {
          setOrganizations(list);
        }
      } catch {
        // Non-critical: the filter dropdown just stays empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPlatformOperator]);

  const loadFirstPage = async (): Promise<void> => {
    setLoadError(null);
    setEntries(null);
    try {
      const { auditLogEntries } = await api.auditLog.list({
        organization_id: organizationFilter || undefined,
        limit: PAGE_SIZE,
      });
      setEntries(auditLogEntries);
      setHasMore(auditLogEntries.length === PAGE_SIZE);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load the audit log."));
      setEntries([]);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      setEntries(null);
      try {
        const { auditLogEntries } = await api.auditLog.list({
          organization_id: organizationFilter || undefined,
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setEntries(auditLogEntries);
          setHasMore(auditLogEntries.length === PAGE_SIZE);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load the audit log."));
          setEntries([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationFilter]);

  const loadMore = async (): Promise<void> => {
    if (!entries || entries.length === 0) {
      return;
    }
    const oldest = entries[entries.length - 1];
    if (!oldest) {
      return;
    }
    setLoadingMore(true);
    try {
      const { auditLogEntries } = await api.auditLog.list({
        organization_id: organizationFilter || undefined,
        before: oldest.timestamp,
        limit: PAGE_SIZE,
      });
      setEntries([...entries, ...auditLogEntries]);
      setHasMore(auditLogEntries.length === PAGE_SIZE);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load more entries."));
    } finally {
      setLoadingMore(false);
    }
  };

  const orgName = (id: string | null): string => {
    if (id === null) {
      return "—";
    }
    return organizations.find((org) => org.id === id)?.name ?? id;
  };

  const columns: Column<AuditLogEntry>[] = [
    { key: "timestamp", label: "When", render: (row) => new Date(row.timestamp).toLocaleString() },
    { key: "action", label: "Action", render: (row) => row.action },
    { key: "resource", label: "Resource", render: (row) => `${row.resource_type} (${row.resource_id})` },
    { key: "actor", label: "Actor", render: (row) => row.actor_user_id },
    ...(isPlatformOperator
      ? [{ key: "organization", label: "Organization", render: (row: AuditLogEntry) => orgName(row.organization_id) }]
      : []),
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <Button variant="secondary" size="small" onClick={() => setViewing(row)}>
          View
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Audit Log"
        subtitle={
          isPlatformOperator
            ? "Every recorded change across every Organization on the platform."
            : "Every recorded change within your Organization."
        }
        actions={
          <Button variant="secondary" onClick={() => void loadFirstPage()}>
            Refresh
          </Button>
        }
      />

      {isPlatformOperator ? (
        <div style={{ maxWidth: 320, marginBottom: "var(--space-4)" }}>
          <Field label="Organization" htmlFor="org-filter">
            <Select id="org-filter" value={organizationFilter} onChange={(event) => setOrganizationFilter(event.target.value)}>
              <option value="">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      ) : null}

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={entries} rowKey={(row) => row.id} emptyMessage="No audit log entries yet." />

      {entries && entries.length > 0 && hasMore ? (
        <div style={{ marginTop: "var(--space-4)", textAlign: "center" }}>
          <Button variant="secondary" onClick={() => void loadMore()} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}

      {viewing ? (
        <Modal title={`${viewing.action} · ${viewing.resource_type}`} onClose={() => setViewing(null)}>
          <p style={{ fontSize: 13, color: "var(--color-text-secondary)", margin: "0 0 var(--space-4)" }}>
            {new Date(viewing.timestamp).toLocaleString()} — actor {viewing.actor_user_id} — Organization{" "}
            {orgName(viewing.organization_id)}
          </p>
          {viewing.before !== undefined ? (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 var(--space-2)" }}>Before</p>
              <pre style={preStyle}>{JSON.stringify(viewing.before, null, 2)}</pre>
            </>
          ) : null}
          {viewing.after !== undefined ? (
            <>
              <p style={{ fontSize: 13, fontWeight: 700, margin: "var(--space-4) 0 var(--space-2)" }}>After</p>
              <pre style={preStyle}>{JSON.stringify(viewing.after, null, 2)}</pre>
            </>
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}

const preStyle: CSSProperties = {
  background: "var(--color-surface-muted)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
  fontSize: 12,
  overflowX: "auto",
  margin: 0,
};
