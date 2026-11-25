# The Forgotten Island · Implementation plan

1. Establish the Vite, React and TypeScript project. Verify Chromium, WebGL and the ability to package an offline build.
2. Define a deterministic terrain and an east–west trail network. Use the same coordinates for terrain flattening, locations, navigation and interactions.
3. Build the walking controller, camera, collision footprints, shore limits and tower access. Keep animation state outside React and persist only serializable progress.
4. Model the coast and its eight landmarks with reusable low-poly meshes and procedural foliage. Add a custom ocean shader, animated falls and a warm coastal sky.
5. Implement a data-driven expedition journal, discoveries and five gate puzzles. Derive objective status from persisted evidence. Require all main evidence and a physical approach to the archive.
6. Build the menu, contextual HUD, journal, inventory, map, settings, ending and Web Audio ambience. Use native pointer lock with drag and keyboard fallbacks.
7. Run static checks and model tests, then use Chromium to take scene captures and play twice from fresh saves with keyboard and UI. Record wrong-answer, early-door, reload and collision coverage. Rerun affected coverage after fixes.
8. Package the source and an offline build, add operating instructions and record any checks whose result remains unknown.

## Acceptance criteria

The browser reaches an ending after walking from the beach and using the intended interactions in a 500 m world. At least four different puzzles have discoverable clues, safe retries and meaningful rewards. Optional exploration remains possible after the ending. Reload resumes a valid save and a new game starts clean. The build must run without a backend, bundled third-party assets or network access during play. Browser visuals, complete runs and measurements are reported with their test environment and limitations.
