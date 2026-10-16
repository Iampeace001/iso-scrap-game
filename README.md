# Iso-Scrap: Neon Salvage

An isometric browser arcade game built with React, Three.js, React Three Fiber, Rapier, Zustand, and Vite.

## Run locally

```sh
npm install
npm run dev
```

Build the static site with `npm run build`; Vite writes it to `dist/`. The app can be hosted on any static web host that serves the SPA entry point. No server-side runtime is required.

## Controls

- Drive with **W/A/S/D** or the **arrow keys**.
- Collect pink energy cores for 100 points and five extra seconds.
- Avoid red spike hazards and tiles that flash before dropping.
- The best score is saved in the browser's local storage.

## start.ng integration

The game asks `https://start.ng/connect` for the current player and shared leaderboard. It verifies the message origin and source, shows the player's character face, name, and account in a profile card, and offers the documented sign-in return link to guests. Signed-in runs are submitted with the `score` statistic declared in `startng.json`; the top five entries appear in the game HUD. The game remains playable without a start.ng response when running locally.

## Build and publish

1. Run `npm install` and `npm run build`.
2. Push this repository to a **public GitHub repository**. Commit the generated `dist/` folder, `startng.json`, and `cover.png`.
3. Check the repository with `POST https://api.start.ng/games/check` using `{ "repo_url": "https://github.com/<owner>/<repo>", "name": "iso-scrap" }`.
4. Fix any reported errors, then send the same JSON to `POST https://api.start.ng/games/publish`.
5. For the first publish, open the returned `approve_url` and approve the game. It will then be available at `https://iso-scrap.start.ng`; later pushes to the published branch update it automatically.
