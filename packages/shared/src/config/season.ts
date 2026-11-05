// The current season shown on Home (Main.dc.html season chip). Served by GET /api/season.
export const SEASON = {
  number: 4,
  name: 'Ember Uprising',
  /** ISO end time; Home renders "· 23d 04h left" from it. */
  endsAt: '2026-11-28T18:00:00Z',
} as const;
