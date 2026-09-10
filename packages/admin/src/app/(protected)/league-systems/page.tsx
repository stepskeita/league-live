"use client";

import type { Competition, CompetitionEntry, CompetitionTableRow, LeagueSystem, Team } from "@leaguelive/shared";
import { useEffect, useState } from "react";
import { Banner } from "../../../components/ui/Banner";
import { Button } from "../../../components/ui/Button";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { Field, Select, TextInput } from "../../../components/ui/Field";
import { Modal } from "../../../components/ui/Modal";
import { PageHeader } from "../../../components/ui/PageHeader";
import { PermissionGate } from "../../../components/PermissionGate";
import { Table, type Column } from "../../../components/ui/Table";
import { useAuth } from "../../../lib/auth-context";
import { api } from "../../../lib/api";
import { getErrorMessage } from "../../../lib/error";

interface RulesFormState {
  name: string;
  scope: string;
  promote_count: string;
  relegate_count: string;
}

const EMPTY_FORM: RulesFormState = { name: "", scope: "", promote_count: "1", relegate_count: "1" };

/** FR21-FR23, competition.manage gated. */
export default function LeagueSystemsPage() {
  const [leagueSystems, setLeagueSystems] = useState<LeagueSystem[] | null>(null);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LeagueSystem | null>(null);
  const [deleting, setDeleting] = useState<LeagueSystem | null>(null);
  const [managingTiers, setManagingTiers] = useState<LeagueSystem | null>(null);
  const [endingSeason, setEndingSeason] = useState<LeagueSystem | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const [{ leagueSystems: list }, { competitions: compList }] = await Promise.all([
          api.leagueSystems.list(),
          api.competitions.list(),
        ]);
        if (!cancelled) {
          setLeagueSystems(list);
          setCompetitions(compList);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load league systems."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = async (): Promise<void> => {
    try {
      const { leagueSystems: list } = await api.leagueSystems.list();
      setLeagueSystems(list);
    } catch (err) {
      setLoadError(getErrorMessage(err, "Couldn't load league systems."));
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!deleting) {
      return;
    }
    await api.leagueSystems.delete(deleting.id);
    setDeleting(null);
    await refresh();
  };

  const competitionName = (id: string): string => competitions.find((comp) => comp.id === id)?.name ?? id;

  const columns: Column<LeagueSystem>[] = [
    { key: "name", label: "Name", render: (row) => row.name },
    { key: "scope", label: "Scope", render: (row) => row.scope },
    { key: "tiers", label: "Tiers", render: (row) => (row.tiers.length === 0 ? "—" : row.tiers.map(competitionName).join(" → ")) },
    { key: "rules", label: "Promote / Relegate", render: (row) => `${row.rules.promote_count} / ${row.rules.relegate_count}` },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (row) => (
        <div style={{ display: "flex", gap: "var(--space-2)", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <PermissionGate need="competition.manage">
            <Button variant="secondary" size="small" onClick={() => setManagingTiers(row)}>
              Tiers
            </Button>
            <Button variant="secondary" size="small" onClick={() => setEditing(row)}>
              Edit
            </Button>
            <Button variant="danger" size="small" onClick={() => setDeleting(row)}>
              Delete
            </Button>
            <Button
              variant="danger"
              size="small"
              onClick={() => setEndingSeason(row)}
              disabled={row.tiers.length === 0}
              title={row.tiers.length === 0 ? "Link at least one tier first." : "End the current season for this league system"}
            >
              End Season
            </Button>
          </PermissionGate>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="League Systems"
        subtitle="Pyramids of linked competitions, with promotion and relegation between adjacent tiers."
        actions={
          <PermissionGate need="competition.manage">
            <Button onClick={() => setCreating(true)}>New League System</Button>
          </PermissionGate>
        }
      />

      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Table columns={columns} rows={leagueSystems} rowKey={(row) => row.id} emptyMessage="No league systems yet." />

      {creating ? (
        <LeagueSystemFormModal
          title="New League System"
          onClose={() => setCreating(false)}
          onSubmit={(input) =>
            api.leagueSystems.create({
              name: input.name,
              scope: input.scope,
              rules: { promote_count: Number(input.promote_count), relegate_count: Number(input.relegate_count) },
            })
          }
          onSaved={() => {
            setCreating(false);
            void refresh();
          }}
        />
      ) : null}

      {editing ? (
        <LeagueSystemFormModal
          title={`Edit ${editing.name}`}
          initial={{
            name: editing.name,
            scope: editing.scope,
            promote_count: String(editing.rules.promote_count),
            relegate_count: String(editing.rules.relegate_count),
          }}
          onClose={() => setEditing(null)}
          onSubmit={(input) =>
            api.leagueSystems.update(editing.id, {
              name: input.name,
              scope: input.scope,
              rules: { promote_count: Number(input.promote_count), relegate_count: Number(input.relegate_count) },
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
          title="Delete league system"
          description={`Delete "${deleting.name}"? This doesn't delete its linked competitions, only the tier structure between them.`}
          confirmLabel="Delete"
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      ) : null}

      {managingTiers ? (
        <TiersModal
          leagueSystem={managingTiers}
          competitions={competitions}
          onClose={() => setManagingTiers(null)}
          onSaved={() => {
            setManagingTiers(null);
            void refresh();
          }}
        />
      ) : null}

      {endingSeason ? (
        <EndSeasonModal
          leagueSystem={endingSeason}
          competitions={competitions}
          onClose={() => setEndingSeason(null)}
          onDone={() => {
            setEndingSeason(null);
            void refresh();
          }}
        />
      ) : null}
    </>
  );
}

function LeagueSystemFormModal({
  title,
  initial = EMPTY_FORM,
  onClose,
  onSubmit,
  onSaved,
}: {
  title: string;
  initial?: RulesFormState;
  onClose: () => void;
  onSubmit: (input: RulesFormState) => Promise<unknown>;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<RulesFormState>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    setError(null);
    if (!Number.isInteger(Number(form.promote_count)) || !Number.isInteger(Number(form.relegate_count))) {
      setError("Promote/relegate counts must be whole numbers.");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(form);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save this league system."));
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
      <Field label="Name" htmlFor="ls-name">
        <TextInput id="ls-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
      </Field>
      <Field label="Scope" htmlFor="ls-scope" hint="e.g. national, regional.">
        <TextInput id="ls-scope" value={form.scope} onChange={(event) => setForm({ ...form, scope: event.target.value })} required />
      </Field>
      <Field label="Promoted per tier boundary" htmlFor="ls-promote">
        <TextInput
          id="ls-promote"
          type="number"
          min={0}
          value={form.promote_count}
          onChange={(event) => setForm({ ...form, promote_count: event.target.value })}
        />
      </Field>
      <Field label="Relegated per tier boundary" htmlFor="ls-relegate">
        <TextInput
          id="ls-relegate"
          type="number"
          min={0}
          value={form.relegate_count}
          onChange={(event) => setForm({ ...form, relegate_count: event.target.value })}
        />
      </Field>
    </Modal>
  );
}

function TiersModal({
  leagueSystem,
  competitions,
  onClose,
  onSaved,
}: {
  leagueSystem: LeagueSystem;
  competitions: Competition[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tierIds, setTierIds] = useState<string[]>(leagueSystem.tiers);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = competitions.filter((comp) => !tierIds.includes(comp.id));
  const competitionName = (id: string): string => competitions.find((comp) => comp.id === id)?.name ?? id;

  const move = (index: number, delta: number): void => {
    setTierIds((prev) => {
      const target = index + delta;
      const a = prev[index];
      const b = prev[target];
      if (target < 0 || target >= prev.length || a === undefined || b === undefined) {
        return prev;
      }
      const next = [...prev];
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const handleSave = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      await api.leagueSystems.setTiers(leagueSystem.id, tierIds);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't save the tier order."));
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Tiers · ${leagueSystem.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={submitting}>
            {submitting ? "Saving…" : "Save tier order"}
          </Button>
        </>
      }
    >
      {error ? <Banner variant="error">{error}</Banner> : null}

      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 var(--space-2)" }}>Tiers, top to bottom</p>
      {tierIds.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>No tiers linked yet — add competitions below.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "0 0 var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {tierIds.map((id, index) => (
            <li key={id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
              <span style={{ color: "var(--color-text-muted)", width: 20 }}>{index + 1}.</span>
              <span style={{ flex: 1 }}>{competitionName(id)}</span>
              <Button variant="secondary" size="small" onClick={() => move(index, -1)} disabled={index === 0}>
                Up
              </Button>
              <Button variant="secondary" size="small" onClick={() => move(index, 1)} disabled={index === tierIds.length - 1}>
                Down
              </Button>
              <Button variant="danger" size="small" onClick={() => setTierIds((prev) => prev.filter((tid) => tid !== id))}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 var(--space-2)" }}>Available competitions</p>
      {available.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Every competition is already linked.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {available.map((comp) => (
            <li key={comp.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              {comp.name}
              <Button variant="secondary" size="small" onClick={() => setTierIds((prev) => [...prev, comp.id])}>
                Add
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

interface TierStandingDraft {
  competitionId: string;
  rows: (CompetitionTableRow & { teamName: string })[];
  nextSeasonCompetitionId: string;
}

function EndSeasonModal({
  leagueSystem,
  competitions,
  onClose,
  onDone,
}: {
  leagueSystem: LeagueSystem;
  competitions: Competition[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { hasPermission } = useAuth();
  const [tiers, setTiers] = useState<TierStandingDraft[] | null>(null);
  const [season, setSeason] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadError(null);
      try {
        const { teams } = await api.teams.list();
        const teamName = (id: string): string => teams.find((team: Team) => team.id === id)?.name ?? id;

        const drafts: TierStandingDraft[] = [];
        for (const competitionId of leagueSystem.tiers) {
          const [{ standings }, { competitionEntries }] = await Promise.all([
            api.competitions.getStandings(competitionId),
            api.competitions.listEntries(competitionId),
          ]);
          const entryTeam = new Map<string, string>(
            competitionEntries.map((entry: CompetitionEntry) => [entry.id, entry.team_id]),
          );
          const rows = [...standings]
            .sort((a, b) => a.rank - b.rank)
            .map((row) => ({ ...row, teamName: teamName(entryTeam.get(row.competition_entry_id) ?? "") || row.team_id }));
          drafts.push({ competitionId, rows, nextSeasonCompetitionId: competitionId });
        }
        if (!cancelled) {
          setTiers(drafts);
        }
      } catch (err) {
        if (!cancelled) {
          setLoadError(getErrorMessage(err, "Couldn't load current standings for this league system's tiers."));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueSystem.tiers]);

  const move = (tierIndex: number, rowIndex: number, delta: number): void => {
    setTiers((prev) => {
      if (!prev) {
        return prev;
      }
      const next = prev.map((tier) => ({ ...tier, rows: [...tier.rows] }));
      const rows = next[tierIndex]?.rows;
      if (!rows) {
        return prev;
      }
      const target = rowIndex + delta;
      const a = rows[rowIndex];
      const b = rows[target];
      if (target < 0 || target >= rows.length || a === undefined || b === undefined) {
        return prev;
      }
      rows[rowIndex] = b;
      rows[target] = a;
      return next;
    });
  };

  const setNextSeasonCompetition = (tierIndex: number, competitionId: string): void => {
    setTiers((prev) => {
      if (!prev) {
        return prev;
      }
      const next = [...prev];
      const tier = next[tierIndex];
      if (!tier) {
        return prev;
      }
      next[tierIndex] = { ...tier, nextSeasonCompetitionId: competitionId };
      return next;
    });
  };

  const competitionName = (id: string): string => competitions.find((comp) => comp.id === id)?.name ?? id;

  const canSubmit = Boolean(tiers) && season.trim().length > 0 && hasPermission("competition.manage");

  const handleConfirm = async (): Promise<void> => {
    if (!tiers) {
      return;
    }
    await api.leagueSystems.endSeason(leagueSystem.id, {
      season: season.trim(),
      standings: tiers.map((tier) => ({
        competition_id: tier.competitionId,
        entries: tier.rows.map((row) => row.competition_entry_id),
      })),
      next_season_competition_ids: tiers.map((tier) => tier.nextSeasonCompetitionId),
    });
    onDone();
  };

  if (confirming) {
    return (
      <ConfirmDialog
        title={`End season · ${leagueSystem.name}`}
        description="This locks in this season's final standings and applies promotion/relegation between every adjacent tier. It cannot be undone."
        confirmLabel="End Season"
        requireTypedConfirmation="END SEASON"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />
    );
  }

  return (
    <Modal
      title={`End Season · ${leagueSystem.name}`}
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => setConfirming(true)} disabled={!canSubmit}>
            Review & End Season
          </Button>
        </>
      }
    >
      {loadError ? <Banner variant="error">{loadError}</Banner> : null}

      <Banner variant="warning">
        Confirm each tier&apos;s final standing below (pre-filled from the current live table — reorder if it needs a manual
        correction), then pick each tier&apos;s competition for next season. This is irreversible.
      </Banner>

      <div style={{ margin: "var(--space-4) 0", maxWidth: 240 }}>
        <Field label="Season" htmlFor="end-season-label" hint="The season being closed out, e.g. 2025/26.">
          <TextInput id="end-season-label" value={season} onChange={(event) => setSeason(event.target.value)} required />
        </Field>
      </div>

      {tiers === null ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading current standings…</p>
      ) : (
        tiers.map((tier, tierIndex) => (
          <div key={tier.competitionId} style={{ marginBottom: "var(--space-5)" }}>
            <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 var(--space-2)" }}>
              Tier {tierIndex + 1} · {competitionName(tier.competitionId)}
            </p>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              {tier.rows.map((row, rowIndex) => (
                <li key={row.competition_entry_id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: 13 }}>
                  <span style={{ color: "var(--color-text-muted)", width: 20 }}>{rowIndex + 1}.</span>
                  <span style={{ flex: 1 }}>
                    {row.teamName} — {row.points} pts
                  </span>
                  <Button variant="secondary" size="small" onClick={() => move(tierIndex, rowIndex, -1)} disabled={rowIndex === 0}>
                    Up
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => move(tierIndex, rowIndex, 1)}
                    disabled={rowIndex === tier.rows.length - 1}
                  >
                    Down
                  </Button>
                </li>
              ))}
            </ul>
            <Field label="Next season's competition for this tier" htmlFor={`next-comp-${tierIndex}`}>
              <Select
                id={`next-comp-${tierIndex}`}
                value={tier.nextSeasonCompetitionId}
                onChange={(event) => setNextSeasonCompetition(tierIndex, event.target.value)}
              >
                {competitions.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ))
      )}
    </Modal>
  );
}
