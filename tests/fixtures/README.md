# Fixtures

Everything in this folder was worked out **by hand from the craft rules**, on
paper, before being compared to anything the engine produces. That is the whole
point: a fixture generated from the code under test proves only that the code is
self-consistent.

Where a fixture is a *property* rather than a literal grid (chevron, for
example), it is because the property is the thing the craft actually defines and
a literal chart would have been copied from a source rather than derived. Those
cases are called out in `../*.test.js` and in the README's honesty section.

## `knot-truth.json`

The four half-hitch pairs. Derived from the physical action, not from a chart:

| knot | worker | colour that shows | strand order after |
| ---- | ------ | ----------------- | ------------------ |
| F  `/` | left  | left  | swapped |
| B  `\` | right | right | swapped |
| FB `>` | left  | left  | unchanged |
| BF `<` | right | right | unchanged |

A forward knot is two forward half-hitches, so the working strand ends up on the
far side — hence the swap. A forward-backward knot is one of each, so the strand
comes back to where it started.

## `candy-stripe-4.json`

Four strands `A B C D`, every knot forward, worked in the staggered
normal-pattern layout (even rows knot pairs 0-1 and 2-3, odd rows knot pair
1-2). Simulated by hand for eight rows; the strand order returns to `A B C D` at
the end of row 8, and each colour traces one diagonal down-and-right. That
diagonal *is* the candy stripe, which is how the fixture was checked for
plausibility independently of the arithmetic.

## `alpha-rows.json`

Three base strands and one weft. In a left-to-right row the weft is the left
member of every pair, so a forward knot shows the weft (background) and a
backward knot shows the base strand (design); right-to-left rows are the mirror.
Both knots swap, which is what walks the weft along the row.

## `cut-length.json`

Recomputed from the published formula rather than from `sizing.js`:

```
raw   = band travel + knots x 0.38 in + 4 in setup + 2 x 5 in tails
cut   = ceil(raw x 1.15)
```
