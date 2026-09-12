# Idea X — quiz funnel prototype

A working static prototype of a 4-step quiz funnel: hero → 19 quiz slides in 4 sections → "analyzing" loader → paywall. Built as a CRO study of how subscription quiz funnels are structured.

**This is a prototype, not a product.** No payment is processed. Reviews, ratings, learner counts and the guarantee are placeholder copy for layout only — none of them are real claims. The page is marked `noindex, nofollow`.

## Two variants, for A/B testing

| | URL | What it is |
|---|---|---|
| **A** | `/` | The original build. Purple/teal, Geist, soft shadows, mixed corner radii. |
| **B** | `/b/` | Same funnel, "green playground" skin: one saturated green, 12px corners everywhere, depth from solid borders instead of shadows, Nunito + heavy Inter display. |

Both variants share `app.js`, `styles.css` and `assets/`, and B's markup is **generated** from A's:

```bash
python3 tools/build-variant-b.py
```

So the questions, copy, order, timings and storage keys are identical by construction — the two pages cannot drift apart. The difference between them is `site/b/theme.css` plus one declared markup swap: the four bullet illustrations (`ASSET_SWAPS` in the build script). Everything the funnel *asks* and *does* is identical; only how it looks differs. That is what makes the test readable.

Re-run the build after editing `site/index.html`, or B will still be serving the old copy.

To split traffic, point ads at the two URLs directly rather than adding a client-side redirect — a redirect costs latency on the exact step you are measuring.

## Run it locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765 for A and http://localhost:8765/b/ for B. Append `?reset` to start over (answers persist per tab).

## What's inside

| File | What it is |
|---|---|
| `index.html` | All four screens. Layout structure was studied from an existing subscription funnel; all brand names, logos, third-party rating badges and customer reviews have been removed and replaced with Idea X placeholders. |
| `styles.css` | The rules these screens use, plus an override block at the bottom that replaces the original Webflow JS interactions. |
| `app.js` | Flow logic: screen routing, quiz state in `sessionStorage` (`q-*` keys), progress bars, answer mirroring (`data-show-if-key/value`), loader animation, 10-minute countdown, plan tabs, checkout modal. ~300 lines, commented. |
| `assets/` | Generic imagery (emoji icons, illustrations, chart, avatars) and the Idea X placeholder logo. |
| `b/index.html` | Variant B. Generated — do not edit by hand. |
| `b/theme.css` | Variant B's entire design layer. Loads after `styles.css` and repaints it. |

## Before this could become a real funnel

- Replace every `Placeholder review` block with real, attributable testimonials
- Replace `Join [N]+ learners` with a real figure
- Wire a real checkout; the guarantee copy needs real terms behind it
- Replace `support@ideax.example` with a real address
- Remove the prototype banner and the `noindex` tag

The prototype banner is hidden on localhost so it stays out of the way while you are judging the design, and shown everywhere else — including the deployed Pages copy, which is publicly reachable and still carries placeholder reviews and ratings. Add `?proto` to any local URL to force it back on.

## Variant B — design notes

Built from a "green playground" style reference. The rules it holds to:

- **One radius.** 12px on every card, button, tag and input; only true circles and the checkbox keep their own shape.
- **No shadows, no gradients.** Depth is a solid darker border along the bottom edge, so buttons and answer cards physically press down on `:active`.
- **Three greens, three jobs.** `#58cc02` fills, `#4aa802` for display text, `#367b00` for body text. The fill green is only 2.1:1 against white, so text never uses it; labels on a green fill are Midnight `#000437`, which is what the reference prescribes.
- **Verified:** zero contrast failures at WCAG AA across all four screens, every one of the 19 slides, their selected states, and the checkout modal — plus zero shadows and zero gradients in the computed styles.

Two of variant A's raster badges have teal baked in and are hue-rotated in CSS. Photographs and product logos are left as they are.

### Pricing — quiet rows

Same information as A (plan name, saving, old price, new price, per-day price, popular flag), four fewer containers. A's row nested three rounded boxes, a left-pointing tag arrow and a saturated green price slab, which put two greens in competition: "this is the price" and "this is the one you picked". In B the price is plain dark type and green means selection only, so the chosen row is the one coloured thing on screen. Done entirely in CSS — the DOM is untouched, so `app.js` still reads the plan out of the card for the checkout modal.

### Bullet illustrations

The four `bullet-0*-green.webp` files are originals generated for this variant. They replace `Image_01`–`Image_04`, **two of which still carry the original site's name and logo** — A continues to serve those until they are replaced there too.

## Shared behaviour (both variants)

The mobile sticky "Get started" bar exists to send you to the plans, so it stands down while the plan cards are in view and returns below them. It watches the card list, not the whole pricing section — the section starts a screenful earlier at the heading. Lives in `app.js` + one rule in `styles.css`, so A and B behave identically and the test stays clean.
