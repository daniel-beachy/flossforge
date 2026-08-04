# FlossForge

**Describe a friendship bracelet that doesn't exist yet. Get one back you can actually tie.**

Live: **https://daniel-beachy.github.io/flossforge/**

Type something like *"daisy chain with little watermelons between them"*, *"sunset chevron in warm oranges"*, or *"blue bracelet with the word LOVE written across"*. FlossForge gives you five distinct designs, a rendered preview of each, a materials list, per-colour cut lengths **with the arithmetic shown**, and numbered step-by-step tying instructions with a phone-friendly follow-along mode.

Everything is static. No server, no build step, no dependencies. It runs on GitHub Pages and it runs from a `file://` URL if you want.

---

## The idea

Finished bracelet patterns are all over the internet. What isn't out there is a way to describe a bracelet *that doesn't exist yet* and get a real, tie-able one back.

So the split is deliberate:

| The language model does | The engine does |
| --- | --- |
| Reads your sentence | Validates the design against real knot rules |
| Picks a style, colours, motifs, layout, repeat | Repairs what it can, rejects what it can't |
| Names the design and writes the blurb | Simulates every knot to produce the preview |
| Nothing else | Computes cut lengths, materials, and every instruction |

The model never writes an instruction, never invents a colour code, and never decides a knot. It proposes a *design*; the engine decides whether that design is physically possible and then builds the pattern itself. If the model returns something un-tie-able the engine says so and fixes it, and the repair is listed on the pattern page so you can see what changed.

That means **the app works with no API key at all** — there's a built-in offline designer that parses your prompt with a hand-written parser and a 35-motif library. It's less imaginative than the model, but it produces the same five candidates and the same quality of instructions.

---

## Styles

Seven construction families, each with its own real mechanics — not one engine with seven labels:

| Style | What it is | Chart? |
| --- | --- | --- |
| **Diagonal knots** | Candy stripes, chevrons, arrowheads, diamonds. Every knot is one of four; the picture emerges from which strand crosses which. | Knot chart |
| **Pixel grid** (alpha) | One knot per pixel. The only way to put a word or a picture on a bracelet. | Grid chart |
| **Daisy chain** | Real knotted flowers — five petals round a bright centre — strung along a twisted stem. | — |
| **Braid** | No knots at all: 3, 4, 5 or 7 strands crossing over each other. | — |
| **Spiral** | One strand wrapping a core in the same direction until it corkscrews. The classic Chinese staircase. | — |
| **Macramé** | Square-knot sinnets and lattices — the knots on plant hangers. | — |
| **Kumihimo** | A Japanese round braid on a foam disk. Needs the disk, makes a perfect rope. | — |

Diagonal and pixel-grid patterns are generated from 14 built-in geometries (chevron, zigzag, diamond, arrowhead, Greek key, wave, gradient, …) and a 35-motif library (heart, watermelon, cactus, mushroom, star, wave, cherry, bee, …), plus a full A–Z/0–9 alphabet with a handful of glyphs.

You can include or exclude any style before generating, so if you never want to see macramé you never will.

---

## Sizes

Eleven presets — child S/L, teen, adult, adult L, adult XL, anklet, long anklet, bookmark, keychain, custom — plus a snug/standard/loose fit adjustment. The size drives every cut length, and every length is shown with its working:

```
Finished band 7.0 in
+ 2 × 2.5 in for the ties       = 12.0 in
× 4.0 (a knotting strand is used up about four times over)  = 48.0 in
+ 4 in spare                    = 52 in  (4 ft 4 in, 132 cm)
```

If a single cut comes out longer than 150 in the pattern tells you to cut it in pieces and how to join a new strand mid-band, because nobody wants a 43-foot tail.

---

## Adding an AI key

Click **AI key** in the header. Your key is stored in your browser's `localStorage` only — it is never sent anywhere except directly to the provider you chose, from your own browser. There is no backend to send it to.

All four providers were checked from a browser at `https://daniel-beachy.github.io` and all four return permissive CORS headers, so they work from a static page with no proxy.

| Provider | Free tier | Images? | Get a key |
| --- | --- | --- | --- |
| **Google Gemini** ← recommended | Free forever, no card. ~1,500 requests/day and 10–15/min on Flash models — far more than this app can use. | ✅ | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq** | Free, no card. ~30 req/min, 1,000–14,400/day depending on model. Very fast. | ❌ | [console.groq.com/keys](https://console.groq.com/keys) |
| **OpenRouter** | Models marked `:free`. 20 req/min and 50/day, or 1,000/day once you've ever put $10 on the account. | ✅ | [openrouter.ai/keys](https://openrouter.ai/keys) |
| **Anthropic** | No permanent free tier — new accounts get a small starting credit. Included because it writes the nicest designs. | ✅ | [console.anthropic.com](https://console.anthropic.com/settings/keys) |

**Gemini is the default recommendation**: the daily limit is high enough that you will not hit it, it's free without a card, and it does vision.

Model IDs drift, so each provider has a **Refresh** button that lists the models your key can actually see and lets you pick one.

### Images

With Gemini, OpenRouter or Anthropic you can attach a photo of a bracelet, a drawing, or a reference image. It's downscaled in-browser before sending. The model reads it as design intent — colours, motif, layout — not as a literal pixel source.

---

## Reproducibility and sharing

Every generation is **seeded**. The seed is shown, you can edit it, and re-running with the same prompt, seed, size and style filter gives you the same five candidates in the same order (the offline designer is fully deterministic; a language model has its own sampling, so the seed pins everything on *our* side — candidate ordering, colour assignment, tile placement, repeat maths).

**Copy link** on any pattern encodes the entire design in the URL fragment. Nothing is stored server-side; the link is the design. Send it to someone and they see the exact pattern, no key required.

---

## Running it locally

No install, no build.

```bash
git clone https://github.com/daniel-beachy/flossforge
cd flossforge
node tools/serve.js 8099      # or python -m http.server, or any static server
```

Then open `http://127.0.0.1:8099/`.

Tests (Node 18+, no dependencies):

```bash
npm test
```

90 tests across six files. Every fixture in `tests/fixtures/` was **derived by hand**, not copied from a generator — see `tests/fixtures/README.md` for how each one was worked out. The most important is `candy-stripe-4.json`: a four-strand candy stripe simulated on paper for eight rows, recording the strand order after every single knot, and the engine reproduces it exactly including the closure back to the starting order.

The LLM path is tested too, with the network stubbed (`tests/llm.test.js`): a fenced-JSON reply wrapped in chatter, a style name that's close but not exact, colours given as words instead of DMC codes, a design that can't be tied, a 429, and a model that replies with prose instead of JSON. All of them have to end with five finished patterns.

There's also a guard test that scans every `.js` file under `src/` for anything that looks like a DMC code and fails if it isn't in the stocked palette. It has caught eleven real bugs.

---

## How the engine works

**Four knots, and only four.** Every knot in a diagonal-knot bracelet is two half-hitches made by one strand around another. The strand that does the knotting is the one whose colour shows; the other is hidden.

| Knot | Symbol | Who knots | Colour shown | Positions after |
| --- | --- | --- | --- | --- |
| Forward | `/` | left | left | **swap** |
| Backward | `\` | right | right | **swap** |
| Forward-backward | `>` | left | left | unchanged |
| Backward-forward | `<` | right | right | unchanged |

Which gives the one insight the whole engine rests on: **a knot is two independent choices** — which side's colour shows, and whether the strands swap. And crucially, *the colour shown must be one of the two strands currently hanging in those positions.* You cannot knot a colour that isn't there.

That constraint is why generating a diagonal pattern is a search problem, not a drawing problem. The engine renders your motif into a target grid, then runs a beam search row by row: for each row it considers the knot sequences reachable from the current strand order, scores them against the target, keeps the best few, and requires the final row to close back to the starting order so the pattern can repeat seamlessly.

Pixel-grid (alpha) bracelets work completely differently: a single "weft" strand walks across a row of base strands, one knot per base strand, and which knot you use decides whether that pixel shows the weft colour or the base colour. Two colours per column, maximum — the engine enforces that and repairs designs that ask for more.

---

## What I could not verify

This section is the honest one. The craft has almost no primary sources — it's a folk tradition documented mostly by hobbyist sites that copy each other — so several things below are best-effort and I'd rather say so than pretend.

**Fidelity of diagonal patterns is physically bounded, and I measured it.**
Chevron, hearts, XO, lightning, diagonal, triangles, dots and stripes reproduce at **100%**. Greek key, diamond, zigzag and checker sit at **79–96%**, and get *worse* as the band gets wider. I suspected my beam search was giving up too early, so I added a mode that branches on both colour choices at every knot instead of greedily taking the closer one. Runtime roughly doubled and **not a single fidelity number changed.** That's the proof: the limit isn't the search, it's the physics — a row can only show colours already hanging in the current strand order. The app shows the fidelity figure on every pattern and warns you when it drops below 80%.

**No canonical Greek-key algorithm exists.** I found no authoritative normal-knot Greek key. Mine is a drawn tile put through the fitter, which is why it lands in the 79–96% band.

**Alpha chart mirroring is unconfirmed.** Different communities disagree about whether an alpha chart is read as-worn or as-worked, i.e. whether it should be mirrored horizontally. I picked one convention and stuck to it consistently. If your finished bracelet comes out mirrored, that's why — an optional mirror toggle is the obvious fix and I didn't get to it.

**The daisy chain construction is a labelled synthesis.** I could not find one authoritative daisy-chain method; the sources vary in petal count and in how the centre is locked. Mine (5 petals, centre strand up through the ring, one lock knot each side) is consistent and tie-able, and I've labelled the stem step as "any spiral works here".

**The arrowhead FB/BF sequence is unverified.** It closes correctly and simulates cleanly, but I couldn't find a source to check the exact knot order against.

**Two numbers come from secondary sources only.** Chinese staircase "8–12 half-hitches per full twist" and macramé "4 half knots per twist" are widely repeated by hobbyist sites but I found no primary measurement. They affect length estimates, not tie-ability.

**DMC publishes no official hex values.** Every hex in the palette is a third-party approximation, so screen colours are indicative. Related: DMC codes don't encode hue, so if a model asks for a code we don't stock we cannot "snap to the nearest" — the engine substitutes a stocked colour deterministically and tells you it did. Also, DMC Mouliné has no true neons; ask for neon and you'll get the brightest real thread.

**The chevron fixture is property-based.** It asserts mirror symmetry, correct knot types at the turn, and closure — rather than a literal row-by-row chart. A literal chart would have been *copied* from somewhere, which proves nothing. The candy stripe and alpha fixtures *are* literal, because those I could derive from first principles myself.

**I never ran it against a real API key.** Every provider was checked for CORS from a browser, and the whole LLM path is tested with the network stubbed — but the actual quality of the designs a given model returns, and whether the free-tier limits hold up in practice, I could not verify without keys for all four.

**Float-carry length.** When a colour has to travel behind the work, there's a practical maximum before it snags. I found no primary source for it, so the engine uses a conservative limit.

---

## Layout

```
index.html            entry point
assets/app.css        all styling, light + dark
src/engine/
  knots.js            the four knots, the simulator, the beam search
  design.js           the LLM contract: validate, repair, or reject
  compile.js          design → finished pattern (single entry point)
  palette.js          61 stocked DMC colours, Lab-space matching
  sizing.js           sizes, fit, cut-length arithmetic
  instructions.js     numbered steps
  render.js           every SVG
  offline.js          the no-key designer
  styles/             per-family mechanics (alpha, braid, spiral, …)
  data/               motifs, alphabet, geometries
src/llm/
  providers.js        the four providers, key handling, model listing
  prompt.js           the prompt, generated from engine data
  generate.js         retry, dedupe, offline top-up
src/ui/               app.js, views.js
tests/                90 tests + hand-derived fixtures
tools/                static server, screenshot verification loop
```

No dependencies. No bundler. The same ES modules run in the browser and under `node --test`.

---

## Licence

MIT.
