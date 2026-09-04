import type { Request, Response } from "express";
import { z } from "zod";
import * as venueService from "../services/venue.service";
import { requireUser } from "../utils/require-user";

const locationSchema = z.object({
  address: z.string().trim().min(1).optional(),
  city: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
});

const venueParamsSchema = z.object({
  venueId: z.string().min(1),
});

const createVenueSchema = z.object({
  name: z.string().trim().min(1).max(200),
  location: locationSchema,
  organization_id: z.string().optional(),
});

export async function createVenue(req: Request, res: Response): Promise<void> {
  const input = createVenueSchema.parse(req.body);
  const venue = await venueService.createVenue(requireUser(req), input);
  res.status(201).json({ venue: venue.toJSON() });
}

export async function listVenues(req: Request, res: Response): Promise<void> {
  const venues = await venueService.listVenues(requireUser(req));
  res.status(200).json({ venues: venues.map((venue) => venue.toJSON()) });
}

export async function getVenue(req: Request, res: Response): Promise<void> {
  const { venueId } = venueParamsSchema.parse(req.params);
  const venue = await venueService.getVenue(requireUser(req), venueId);
  res.status(200).json({ venue: venue.toJSON() });
}

const updateVenueSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  location: locationSchema.optional(),
});

export async function updateVenue(req: Request, res: Response): Promise<void> {
  const { venueId } = venueParamsSchema.parse(req.params);
  const input = updateVenueSchema.parse(req.body);
  const venue = await venueService.updateVenue(requireUser(req), venueId, input);
  res.status(200).json({ venue: venue.toJSON() });
}

export async function deleteVenue(req: Request, res: Response): Promise<void> {
  const { venueId } = venueParamsSchema.parse(req.params);
  await venueService.deleteVenue(requireUser(req), venueId);
  res.status(204).send();
}
