import { FIXTURE_STATUSES, type FixtureStatus } from "@leaguelive/shared";
import { Schema, Types, model, type Document } from "mongoose";
import { withBaseOptions } from "./plugins/schema-options";

export interface FixtureAttrs {
  organization_id: Types.ObjectId;
  competition_id: Types.ObjectId;
  home_entry_id: Types.ObjectId;
  away_entry_id: Types.ObjectId;
  venue_id: Types.ObjectId | null;
  datetime: Date;
  status: FixtureStatus;
  // FR19: set only via a dedicated reporter.assign gated action — see
  // fixture.service.ts's assignReporter/unassignReporter.
  reporter_user_id: Types.ObjectId | null;
  // FR25: set by startMatchSession/endMatchSession.
  started_at: Date | null;
  ended_at: Date | null;
  // FR28: set only by confirmResult (results.verify), which computes these
  // from MatchEvent. Once result_locked_at is set, no more MatchEvents may
  // be logged for this fixture.
  home_score: number | null;
  away_score: number | null;
  result_locked_at: Date | null;
}

export interface FixtureDocument extends FixtureAttrs, Document {}

const fixtureSchema = new Schema<FixtureDocument>(
  {
    organization_id: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    competition_id: {
      type: Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    home_entry_id: {
      type: Schema.Types.ObjectId,
      ref: "CompetitionEntry",
      required: true,
    },
    away_entry_id: {
      type: Schema.Types.ObjectId,
      ref: "CompetitionEntry",
      required: true,
    },
    venue_id: {
      type: Schema.Types.ObjectId,
      ref: "Venue",
      default: null,
    },
    datetime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: FIXTURE_STATUSES,
      default: "scheduled",
    },
    reporter_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    started_at: {
      type: Date,
      default: null,
    },
    ended_at: {
      type: Date,
      default: null,
    },
    home_score: {
      type: Number,
      default: null,
      min: 0,
    },
    away_score: {
      type: Number,
      default: null,
      min: 0,
    },
    result_locked_at: {
      type: Date,
      default: null,
    },
  },
  withBaseOptions<FixtureDocument>(),
);

export const Fixture = model<FixtureDocument>("Fixture", fixtureSchema);
