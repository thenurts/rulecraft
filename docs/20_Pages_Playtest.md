# Rulecraft HTTPS playtest

GitHub Pages is ready for review as the preferred host for the public, unpromoted playtest. The expected address after deployment is `https://thenurts.github.io/rulecraft/`. The source repository stays private. Anybody who knows or discovers the test address can play without signing in. The `noindex, nofollow` directive asks search engines to avoid indexing the page and provides no access control. Share the address directly with invited testers and avoid public listings. [Issue #16 and owner authorisation](https://github.com/thenurts/rulecraft/issues/16#issuecomment-7065550309)

## First publish after review

GitHub reports `thenurts/rulecraft` as a private repository under a personal account, with Pages disabled. The integration cannot read the Pages endpoint or the account plan. GitHub requires an eligible paid plan for Pages from a private repository. Before merging, the owner can open **Settings → Pages** to check whether **GitHub Actions** is available as a source. [GitHub Pages availability and setup](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

1. After approving and merging the deployment PR, open **Settings → Pages**. Under **Build and deployment → Source**, choose **GitHub Actions**. If no source is available for the private repository, stop and use the fallback below. Keep repository visibility **Private**.
2. In **Settings → Environments → github-pages**, confirm the deployment branch restriction allows only `main`. If the environment is missing, use **New environment** to create it. If needed, choose **Selected branches and tags** and add the branch `main`. Then open **Actions → Publish playtest to GitHub Pages → Run workflow**. Select `main` and click **Run workflow**. Allow the run to finish.
3. Open the link in the workflow’s `github-pages` deployment or **Settings → Pages → Visit site**. Confirm the actual URL is HTTPS, the workflow’s HTTPS check passes, and the game loads in a signed-out browser. Send that URL privately to testers. They can tap it in Android Chrome or iPhone Safari and start a village with no installation, account or local server.

For an update, merge the reviewed change and run the workflow again on `main`. To remove the site, use **Settings → Pages → … → Unpublish site** and confirm the URL no longer serves the playtest. For a rollback, revert the offending change through a reviewed PR and dispatch again from `main`; unpublish first if the link needs to come down immediately. [GitHub unpublishing guide](https://docs.github.com/en/pages/getting-started-with-github-pages/unpublishing-a-github-pages-site)

If private-source Pages is unavailable, use **Cloudflare Pages Direct Upload**. After agreeing on the fallback, an engineer can prepare a ZIP whose root contains the compiled `index.html` and `assets/` from the reviewed `main` commit with `npm run build` (root base). The owner needs a Cloudflare account and can choose **Workers & Pages → Create application → Drag and drop your files**, name the project and upload that ZIP. Use the HTTPS `pages.dev` address and verify the same flow before sharing. This requires no GitHub integration or visibility change. [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## What testers should know

IndexedDB saves are local to the current browser profile, device and origin. A save from localhost, a LAN address or another hostname will not appear on the playtest site. Saves are neither synced nor transferable through the app. Private browsing, eviction and clearing site data can remove them. Restarting intentionally replaces the save after confirmation. PNG cards are exported locally.

Run this checklist separately on physical **Android Chrome** and **iPhone Safari**. Record device model, OS and browser versions, viewport, test date, and a pass/fail plus notes for each step. Use a fresh browser profile or test device where replacing a village is safe.

| Check | What to record |
| --- | --- |
| Open the HTTPS URL | Load without sign-in, safe-area fit in portrait, tap targets, native select usability, and whether 200% text cuts off labels or actions. |
| Start Junior Hungry Village | Enact a typed decree and advance through checkpoint day six and debrief day 12. Open the linked Royal Inquiry, Gazette and Chronicle, then export a local PNG or use its selectable text. |
| Resume the completed day-12 save | Reload on the same origin, resume and verify day 12. Repeat after backgrounding the tab and after a browser restart. Record any interruption or lost progress. |
| Try both Sandbox starting presets | Record a seed, verify the chosen preset and the 12-day limit, cancel a restart, then confirm a same-seed retry. |
| Try network loss | With the game loaded, record what happens when the connection drops during play. Then test a fresh offline reload separately. Offline reload is outside the current hosting design. |
| Measure responsiveness | Time opening/resuming the day-12 save, confirming an advance until results appear, and requesting the local PNG. Record outliers and any visible freeze. |

Physical Android, physical iOS, manual screen-reader sessions and novice playtests are **Not Yet Tested**. The automated coverage supports a moderated first-time-player pilot after a real phone owner verifies the link and save/resume flow on both platforms. Desktop Chromium results do not validate Android Chrome, iPhone Safari, or player comprehension.

## Engineering verification

The manual workflow builds the selected `main` commit with Node 24, `npm ci` and `npm run build:pages`. The build checks the output directory for the HTML entry and fingerprinted JS, CSS and worker, and rejects other files or source-map references. The public executable necessarily contains client logic and the starting configuration it uses. The workflow uploads no separate source, fixtures, environment files, saves or QA artifacts. Only the deploy job has Pages write and identity-token permissions. PR CI runs both browser paths without deployment rights.

```sh
npm test
npm run typecheck
npm run build
npm run test:browser
npm run build:pages
npm run test:browser:pages
```

| Check | Result |
| --- | --- |
| `npm ci`, `npm test`, `npm run typecheck`, `npm run build` | Passed. 175 tests across 20 files. |
| `npm run test:browser` | 24 passed in 40.5 s against the root production preview. |
| `npm run build:pages` | Passed. The output contained `index.html`, 346.65 kB main JS, 7.53 kB CSS and a 39.28 kB worker. A temporary `.map` file was rejected by the artifact check. |
| `npm run test:browser:pages` | 25 passed in 44.8 s against `/rulecraft/` with Linux Chromium 156, including phone-sized emulation. |
| `actionlint`, `git diff --check` | Passed. |
| Signed-out live HTTPS, physical Android/iOS, manual screen reader and novice sessions | **Not Yet Tested.** The Pages deploy workflow is pending review. |

The base-path run verified the JS, CSS and save worker paths, status and MIME types, rejection of raw source and map asset requests, a Junior decree through the day-six checkpoint and day-12 debrief, both seeded Sandbox presets through day 12, same-origin resume, confirmed replacement, Inquiry, Chronicle and the local PNG. Chromium treated loopback as a secure context. The workflow checks HTTPS on the actual Pages host after an authorised deploy.

The local subpath run measured day-12 save at 105.6 ms and median save verification after reload at 224 ms (five reloads). The local share-card export took 33.1 ms for a 127,137-byte PNG. These are desktop Chromium observations.

[Day-six checkpoint at 390 px](screenshots/issue-16/checkpoint-390.png) · [Local share-card preview at 390 px](screenshots/issue-16/share-preview-390.png)
