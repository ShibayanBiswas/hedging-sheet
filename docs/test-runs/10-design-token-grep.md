# Design Token Grep · a898e8a

Fresh counts of values written outside `app/tokens.css`, taken 03-Nov-2026 10:10 IST with the commands below, run from the repo root in Git Bash. They are counts, not a pass or fail. `tests/unit/design-tokens.test.ts` is the gate, and it passes: font sizes come only from the type scale, spacing stays on the 4 px scale with at most 10 values off it, icons use tokens, and full-height areas use dvh rather than vh.

| # | What | Count |
|---|---|---|
| 1 | Arbitrary Tailwind px or rem values in .tsx | 11 |
| 2 | Hex colours in .tsx | 8 |
| 3 | rgb() or rgba() in .tsx | 1 |
| 4 | Inline style objects with px in .tsx | 0 |
| 5 | Tailwind palette colour classes (stone, rose, amber, emerald, slate, gray, red, green) in .tsx | 48 |
| 6 | Declarations in globals.css with a raw px or rem value | 121 |
| 7 | of which font-size | 0 |
| 8 | of which padding, margin or gap | 8 |
| 9 | of which border radius | 0 |
| 10 | box-shadow in globals.css not from a token | 6 |
| 11 | Hex colours in globals.css | 39 |
| 12 | var(--…) uses in globals.css, for scale | 350 |

Reading: font sizes and radii are fully on tokens, and most spacing is. Colours and some sizes are not: mainly hex and rgba values in `globals.css`, Tailwind palette classes for status colours, and a few arbitrary sizes. This is why the tokens row is Partly Done.

## Commands

```sh
grep -rEo '\b[a-z-]+-\[[^]]*[0-9](px|rem)[^]]*\]' app components --include=*.tsx | wc -l           # 1
grep -rEn '#[0-9a-fA-F]{3,8}\b' app components --include=*.tsx | wc -l                            # 2
grep -rEn 'rgba?\(' app components --include=*.tsx | wc -l                                        # 3
grep -rEn 'style=\{\{[^}]*[0-9]px' app components --include=*.tsx | wc -l                         # 4
grep -rEo '\b(text|bg|border)-(stone|rose|amber|emerald|slate|gray|red|green)-[0-9]{2,3}' app components --include=*.tsx | wc -l   # 5
grep -E '^\s+[a-z-]+:.*[0-9.]+(px|rem)' app/globals.css | wc -l                                   # 6
grep -E '^\s+font-size:.*[0-9.]+(px|rem)' app/globals.css | wc -l                                 # 7
grep -E '^\s+(padding|margin|gap|row-gap|column-gap)[a-z-]*:.*[0-9.]+(px|rem)' app/globals.css | wc -l   # 8
grep -E '^\s+border-[a-z-]*radius:.*[0-9.]+(px|rem)' app/globals.css | wc -l                      # 9
grep -E '^\s+box-shadow:' app/globals.css | grep -v 'var(--\|none' | wc -l                        # 10
grep -En '#[0-9a-fA-F]{3,8}\b' app/globals.css | wc -l                                            # 11
grep -o 'var(--' app/globals.css | wc -l                                                          # 12
```
