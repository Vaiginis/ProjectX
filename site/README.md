# Idea X — quiz funnel prototype

A working static prototype of a 4-step quiz funnel: hero → 19 quiz slides in 4 sections → "analyzing" loader → paywall. Built as a CRO study of how subscription quiz funnels are structured.

**This is a prototype, not a product.** No payment is processed. Reviews, ratings, learner counts and the guarantee are placeholder copy for layout only — none of them are real claims. The page is marked `noindex, nofollow`.

## Run it locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765. Append `?reset` to start over (answers persist per tab).

## What's inside

| File | What it is |
|---|---|
| `index.html` | All four screens. Layout structure was studied from an existing subscription funnel; all brand names, logos, third-party rating badges and customer reviews have been removed and replaced with Idea X placeholders. |
| `styles.css` | The rules these screens use, plus an override block at the bottom that replaces the original Webflow JS interactions. |
| `app.js` | Flow logic: screen routing, quiz state in `sessionStorage` (`q-*` keys), progress bars, answer mirroring (`data-show-if-key/value`), loader animation, 10-minute countdown, plan tabs, checkout modal. ~300 lines, commented. |
| `assets/` | Generic imagery (emoji icons, illustrations, chart, avatars) and the Idea X placeholder logo. |

## Before this could become a real funnel

- Replace every `Placeholder review` block with real, attributable testimonials
- Replace `Join [N]+ learners` with a real figure
- Wire a real checkout; the guarantee copy needs real terms behind it
- Replace `support@ideax.example` with a real address
- Remove the prototype banner and the `noindex` tag
