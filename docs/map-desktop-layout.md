# Desktop map presentation layout

The previous crowd-density version is preserved at commit `02ecfb5`, with local backup branch `backup/map-before-layout-20261007`. The layout changes are on `feature/map-desktop-layout`.

## Presentation flow

1. Open `/map` on a desktop viewport (at least 1024 px wide). The left task sidebar and right map have separate space.
2. Start in **Plan a route**. Choose **Campus building** or **LTB room**. Search for a start building, explicitly choose a start on the map, or expand **Use my current location** to opt in.
3. For buildings, search a destination or explicitly choose a destination on the map. Press the single **Plan route** button. Ordinary map clicks do not replace an existing route.
4. For LTB, filter by floor or room name, select a room and plan the route. Candidate entrance warnings remain visible. Open the indoor route and return to the outdoor map.
5. Switch to **Crowd estimates**. Signed-in users can enable the overlay and select **Simulated AI-assisted timetables**, using 7 October 2026 at 10:00 Melbourne time for the demonstration. Fictional student provenance is labelled in the sidebar and on the map. This mode does not change route selection.
6. Return to **Plan a route**: the crowd overlay and its source badge remain visible, and inputs are preserved. Disable the overlay in Crowd estimates when finished.
7. **Map tools** contains the optional navigation graph, disabled by default. It uses muted grey lines rather than the previous red network.

## Verification

- TypeScript, lint, existing 172 tests and production webpack build.
- Local Chromium interaction checks: main action visible at 1440 × 900; map gets separate space; map pin labels; clicks outside picking mode preserve routes; panel switches preserve inputs and results; input edits invalidate old results; LTB indoor/outdoor round trip; original building destination remains usable after switching modes; keyboard-operated debug graph; actual demo crowd endpoint; persistent source badge and overlay cleanup.
- Browser routing and indoor data were fixtures, and OSM tiles were intercepted to avoid automated tile requests. These checks validate UI orchestration, not real route accuracy or tile availability.
- Desktop presentation is this change's focus. Existing compact-screen overlay is retained; a new mobile bottom-sheet workflow is not part of this change.
