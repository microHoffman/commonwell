---
name: Yield Forward
description: Fund a community with the yield on money you keep, shown as money moving from a basin to the community.
colors:
  bottle-green: "#1f4d3a"
  bottle-green-deep: "#183d2e"
  bottle-green-night: "#0e2519"
  pale-moss: "#8ab79c"
  mint-wash: "#eef5f0"
  community-ochre: "#c98a3d"
  ochre-light: "#e0ab5f"
  ochre-dusk: "#d4964a"
  leaf: "#4f7a36"
  sage: "#9db88a"
  stream-text: "#d5e6cd"
  band-mint: "#e3eee6"
  paper-ground: "#f6f1e7"
  paper-light: "#fbf9f4"
  card-white: "#ffffff"
  hairline: "#e6dfd0"
  ink-dimmed: "#77715f"
  ink-muted: "#5a574b"
  ink: "#2e2d27"
  ink-strong: "#1e1f1b"
  night-ground: "#121814"
  night-card: "#1a211d"
  night-raised: "#26302a"
  night-hairline: "#2e3832"
  night-ink: "#e6e1d4"
  foam: "#b9d3a8"
  spray: "#e8f2df"
typography:
  display:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.11
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  amount-input:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
    fontFeature: "\"tnum\" 1"
  title:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "\"tnum\" 1"
  body-small:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Onest, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  swatch: "3px"
  control: "0.5rem"
  chip: "0.75rem"
  inset: "1rem"
  packet-small: "1.125rem"
  card: "1.5rem"
  pill: "9999px"
spacing:
  gutter-phone: "16px"
  gutter: "24px"
  stack: "16px"
  card-x-phone: "20px"
  card-x: "28px"
  column-gap: "32px"
  side-column: "24rem"
  page-max: "76rem"
components:
  button-primary:
    backgroundColor: "{colors.bottle-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.control}"
    height: "48px"
  button-header:
    backgroundColor: "{colors.bottle-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.pill}"
    padding: "8px 20px"
  card:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "16px 20px"
  flow-card:
    backgroundColor: "{colors.bottle-green}"
    textColor: "{colors.card-white}"
    rounded: "{rounded.card}"
    padding: "28px"
  packet-small:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.packet-small}"
    padding: "12px 16px"
  input-amount:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-strong}"
    typography: "{typography.amount-input}"
    rounded: "{rounded.control}"
    height: "56px"
  tabs-pill:
    backgroundColor: "{colors.paper-ground}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.pill}"
  tabs-pill-active:
    backgroundColor: "{colors.card-white}"
    textColor: "{colors.ink-strong}"
    rounded: "{rounded.pill}"
  summary-inset:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.inset}"
    padding: "0 16px"
  badge-reviewed:
    backgroundColor: "{colors.mint-wash}"
    textColor: "{colors.bottle-green}"
    rounded: "{rounded.pill}"
---

# Design System: Yield Forward

## Overview

**Creative North Star: "The Seed Library"**

Every community is a packet in one shared seed library, and each packet's page shows its money moving. Deposits rest in a basin that stays the depositors'; only the yield on top flows along a stream to the community's ochre circle. The system is calm, warm and exact: pale paper ground, white cards with large soft corners, one bottle-green field for the money picture and the primary action, and ochre reserved for the community and for "you".

Density is moderate. The community page is a two-column operating surface (packet header and money diagram on the left, a sticky deposit column on the right) rather than a marketing page, and it refuses the category's grid of stat tiles: the figures that matter sit on the part of the picture they describe. Proof (addresses, roles, records) stays one click away in Questions and Technical details, set in quieter type.

Identity comes from geometry, not imagery. Each community gets a seeded band of circles and half circles drawn from the palette's inks, so communities tell apart without uploads, and the same circle vocabulary carries into the diagram (the community is a circle; the stream ends in it).

**Key Characteristics:**
- Pale paper ground (#f6f1e7) with white cards on it; the token scale is named "kraft" but the ground reads as light paper, not brown kraft.
- One loud element per view: the bottle-green primary button or the bottle-green money diagram.
- Four semantic inks for money: leaf (deposited), sage (yield), solid ochre (community and you), hatched ochre with a dashed outline (what you are adding).
- One sans (Onest) throughout, semibold and tightly tracked for figures and headings, tabular numerals everywhere.
- Large soft corners (24px) on every top-level container; pills for tabs, badges and the header sign-in.
- Soft, green-tinted diffuse shadows only on hover and scroll; flat at rest.
- Slow, eased, forward-only motion in the money diagram, and only while there is money in the basin.

## Colors

A warm paper-and-garden palette: bottle green carries action and the money field, leaf and sage are the money itself, ochre marks the community and the visitor.

### Primary
- **Bottle Green** (bottle-green): the primary button, the "Where the yield goes" field, the Reviewed badge text, the community-avatar initials, the hover fill of a packet's open cue. In dark mode the primary role moves to **Pale Moss** (pale-moss) with Bottle Green Night (bottle-green-night) as the text on it, and the diagram field deepens to **Bottle Green Deep** (bottle-green-deep).
- **Mint Wash** (mint-wash): the fallback tile behind community initials; the palest step of the green scale.

### Secondary
- **Community Ochre** (community-ochre): the community circle in the diagram, the visitor's own deposit slice, the amount-field focus ring, the global focus outline, and swatches that key "you" in summaries. Dark mode uses **Ochre Dusk** (ochre-dusk) for the secondary role.
- **Ochre Light** (ochre-light): slice edges on the dark field, the diagonal stripes of the "adding" hatch and its dashed outline, and the particles that rise from your slice (solid) and from the adding slice (dashed ring); text selection is this ochre at 55% mix.

### Tertiary
- **Leaf** (leaf): the basin of deposits, the chip behind the basin's figure while the slices leave room for it, the ground of the share bar, and the ground under the "adding" hatch.
- **Sage** (sage): the yield layer on top of the basin and the stream to the community; keys "to the community" in the deposit summary.
- **Stream Text** (stream-text): secondary text on the dark diagram field (labels, key entries).
- **Foam** (foam): the back layer of the moving surface and the bubbles rising through the basin.
- **Spray** (spray): the droplets carried over the rim and the ripples where bubbles open; brighter than sage so they read as moving yield on the sage stream.
- **Band Mint** (band-mint): the small dots and light shapes in community bands.

### Neutral
- **Paper Ground** (paper-ground): the page and the sticky header; also the elevated surface inside cards (the pill tab track). Warm neutrals from the kraft scale sit on it without turning grey.
- **Paper Light** (paper-light): muted insets inside cards (the deposit summary, card footers).
- **Card White** (card-white): every card, input and packet body.
- **Hairline** (hairline): borders and dividers.
- **Ink Strong / Ink / Ink Muted / Ink Dimmed** (ink-strong, ink, ink-muted, ink-dimmed): highlighted text, body text, secondary text, and separators such as the dot between facts.
- **Night Ground / Night Card / Night Raised / Night Hairline / Night Ink**: the dark-mode page, card, raised surface, border and body text; green-tinted, never neutral grey.

### Named Rules
**The Four Inks Rule.** Money has exactly four inks: leaf is what everyone deposited, sage is yield, solid ochre is the community or your deposit, and what you are about to add is hatched: diagonal ochre-light stripes over leaf with a dashed ochre-light outline, so it reads as not there yet. Any summary that talks about the same money uses the same swatch (a small 3px-radius square, round for the community; the adding swatch is a small hatched square), so text and picture key to each other. Foam and spray are the yield in motion, not further inks.

**The Ochre Means Someone Rule.** Ochre marks a who (the community, you) or focus; it never decorates. A screen with ochre on something that is neither a party nor a focus state is off-system.

**The Paper Not Kraft Rule.** The ground is pale paper (paper-ground). Never darken the page to a brown kraft tone because the token scale is called kraft.

## Typography

**Display Font:** Onest (with ui-sans-serif, system-ui, sans-serif)
**Body Font:** Onest
**Label/Mono Font:** system monospace, only for addresses and hashes in Technical details and the account menu.

**Character:** One modern geometric-humanist sans in four weights (400, 500, 600, 700 loaded; 400/500/600 used). Headings and every figure are semibold with tight tracking (-0.025em); body text stays regular. Tabular numerals are on for the whole body so figures align.

### Hierarchy
- **Display** (600, 1.875rem on phones to 2.25rem from sm, 1.11): the directory's page heading only.
- **Headline** (600, 1.5rem on phones to 1.875rem from sm, 1.2): a community's name and the My deposits heading; also the headline figures on the wide money diagram.
- **Amount Input** (600, 1.5rem, -0.025em): the typed amount; the placeholder drops to regular weight.
- **Title** (600, 1.25rem, 1.4): packet names in the directory; section headings such as "More communities" step down to 1.125rem.
- **Body** (400, 1rem, 1.5): descriptions and FAQ answers, capped at a prose measure (65ch).
- **Body Small** (400, 0.9375rem): packet descriptions and packet figures.
- **Label** (500 or 400, 0.875rem): fact lines, card headings like "Payouts", diagram labels, key entries, the share line, summary rows. Sentence case, no tracking change.
- **Caption** (400, 0.75rem): term labels over figures (including the small labels above the narrow diagram's figures), step lists, the rate note under a yearly yield, the APR pill (600).

### Named Rules
**The Figures Lead Rule.** A figure is always heavier than its label: label at 0.875rem regular in a muted ink, value semibold in the strong ink beneath or beside it.

**The No Uppercase Rule.** Labels stay sentence case at normal tracking. There are no uppercase kickers or eyebrow lines above headings.

## Layout

A centred column capped at 76rem with 16px gutters on phones and 24px from sm (40rem). The community page is a two-column grid from lg (64rem): a flexible left column and a fixed 24rem right column with a 32px gap. The right column (deposit card, How it works, Recent payouts) is sticky under the header and scrolls on its own when taller than the viewport. On phones everything stacks in reading order: who the community is, where the yield goes, How it works (moved above the deposit card, so what withdrawals pay out is read before the deposit button), then the deposit card and Recent payouts.

The directory is a one-, two- or three-column grid of packets (20px gap). "More communities" under a community page uses smaller packets in the same grid rhythm.

Vertical rhythm: 16px between stacked cards in a column, 24px between page sections, 32px between directory sections. Cards pad 20px on phones and 28px from sm.

The header is sticky on every width. Its height is carried as a variable (--yf-header: 4rem on phones, 4.25rem from sm); anchor scrolling and the sticky deposit column offset by that height plus 16px, and the column caps its own height at the viewport minus the header. On phones the nav links sit on their own row under the header and scroll away, so only the top row stays pinned.

The money diagram is a container-query component: below a 36rem container it shows only the three amounts, scaled with the picture (never below 0.9375rem), and the key underneath names them; any figure sitting above the picture carries its own small label. At 36rem and wider every figure sits on its part of the picture with its own label.

## Elevation & Depth

Flat at rest. Depth comes from the white-on-paper contrast and hairline borders. Shadows are soft, offset downward, negatively spread, and tinted with bottle green (rgb 31 77 58) rather than black, so lift reads as a cast on paper. They appear in response to state: hovering a packet, scrolling under the header. One small black-tinted shadow exists for an element that floats on colour: the packet's round open button sitting on its band. The money diagram is shadowless; its labels sit on leaf or directly on the field.

### Shadow Vocabulary
- **Packet lift** (`box-shadow: 0 14px 32px -22px rgb(31 77 58 / 0.55)`): directory packet on hover, with the border darkening.
- **Small packet lift** (`box-shadow: 0 10px 24px -18px rgb(31 77 58 / 0.6)`): small packets on hover.
- **Header edge** (`box-shadow: 0 1px 0 var(--ui-border), 0 8px 20px -16px rgb(31 77 58 / 0.35)`): the sticky header once the page scrolls beneath it.
- **Cue on band** (`box-shadow: 0 4px 12px -6px rgb(0 0 0 / 0.45)`): the round open button on a packet's band.

### Named Rules
**The Lift On Response Rule.** Nothing casts a shadow at rest except an element floating on a coloured field. Cards lift only on hover; the header gains its edge only when content passes under it.

## Shapes

Every top-level container (cards, the packet header, the money diagram, FAQ, Technical details, skeletons standing in for them) uses large soft corners (24px). Smaller nested surfaces step down: small packets (18px), insets like the deposit summary (16px), the leaf label chip on the wide diagram (12px), controls such as buttons and inputs and the narrow diagram's label chip (8px, the Nuxt UI base radius), legend swatches (3px). Pills (fully round) are reserved for segmented tabs, badges, the header sign-in and account buttons, the phone nav links, the packet's open button, the diagram's APR pill, pause button and share bar.

The signature geometry is the circle and half circle: community bands are seeded arrangements of three large circles, two half circles and three small dots on a ground of bottle green, leaf or ochre; the diagram's community is a circle; the basin is a rectangle with rounded bottom corners. Community avatars are rounded squares (logo, not person), overlapping the band with a 4px ring in the card colour.

## Components

### Buttons
Quiet everywhere except the one action that moves money.
- **Shape:** gently rounded (8px) for the full-width primary action in the deposit card; fully round for the header sign-in and account button. The difference is intended (confirmed by the user): the money-moving action is a control, the header account entry is a pill like the other header controls.
- **Primary:** bottle green with white text, 48px tall, full width in the deposit card. Dark mode: pale moss with near-black green text.
- **Hover / Focus:** Nuxt UI's darker primary on hover; focus outline is community ochre.
- **Secondary / Ghost:** neutral outline or ghost buttons for Sign in inside the withdraw empty state, Edit, and nav links (muted text, strong text when current). Inline links like "See all" are small, muted text links. The Payouts card's "Pay out" is an extra-small outline pill beside the amount, never louder than the deposit button.

### Chips
- **Badges:** pill, subtle variant. Reviewed is primary (mint wash, bottle-green text, check icon); Unreviewed is the warning colour with an alert icon.
- **Diagram chips:** the basin's figure sits on a leaf chip (12px wide, 8px narrow) until the slices crowd it, then it drops the chip. The rate is a translucent white pill (white at 15%, caption semibold) beside the deposited figure, with an info icon whose tooltip carries the vault type's full rate name and its source. There is no white chip on the field.

### Cards / Containers
- **Corner Style:** 24px (rounded.card); Nuxt UI cards are overridden to the same radius.
- **Background:** card white on paper ground; dark mode night card on night ground.
- **Shadow Strategy:** flat at rest; see Elevation & Depth.
- **Border:** 1px hairline.
- **Internal Padding:** 20px on phones, 28px from sm; compact cards (Payouts) 20px by 16px.

### Inputs / Fields
- **Style:** display-size amount field, 56px tall, 1.5rem semibold figures, unit symbol as a muted trailing label, 8px radius, white.
- **Focus:** a 2px community-ochre ring.
- **Balance hint:** above the field on the right ("Balance" and the amount, rounded through TokenAmount with the exact value on hover), with a link-style Max. Max fills the exact value, so the field always carries what will be sent.
- **Error:** Nuxt UI's error text under the field (minimum, more than your balance, too many decimals).

### Navigation
- **Header:** sticky, paper-ground background, logo tile (25% radius) and wordmark at 1.05rem semibold; ghost links in muted ink, strong ink when current; pill Sign in in bottle green at the end.
- **Phones:** links move to a second row of small pill links that scrolls away; the current one sits on a white pill.
- **Segmented tabs:** pill track. In the deposit card the track is paper ground and the active segment is a white pill with a light shadow; on the page (vault tabs, directory filter) the track is white with a ring and the active segment is paper ground.

### The Money Diagram (signature)
A dark bottle-green card titled "Where the yield goes". An 800 by 280 drawing: the leaf basin (everyone's deposits, which stay theirs), a wavy sage surface of yield on top, a sage stream from the rim to the ochre community circle. With no deposits the basin dims to 40% and nothing moves.

- **Figures:** "Deposited" and its amount with the APR pill sit in the basin's open leaf area; when the slices take more than about 70 of the basin's 406 diagram units, the figure moves above the basin's left rim as a plain label, and the picture gains top space only then. Everything generated for the community (paid out plus waiting) sits inside the enlarged community circle in dark green, labelled "Generated" with an info tip explaining it (generated by everyone's deposits, paid out or waiting; the deposits stay with their owners). On narrow cards the figures stand alone and the key names them ("Deposited · 1.9% APR", "Generated for {community}").
- **Slices:** the visitor's own deposit is a solid ochre slice at the basin's right edge, to scale (never thinner than a sliver); the amount being typed is the hatched adding slice beside it and grows live. Slice edges are redrawn above the labels so a label never hides where a slice begins.
- **Share line and bar:** under the picture while you hold or are adding: "You'd hold X% of this vault · Y% now, +Z% with this deposit" while typing (no "now" part when you hold nothing; "+<0.1%" for tiny additions), "You hold Y% of this vault" otherwise. Beneath it a 10px pill bar on leaf repeats the slices: solid ochre for yours, the hatch (stripes plus an inset ochre-light outline) for adding.
- **Key:** names only the inks currently shown, each with its amount: "Your deposit ≈ …", "Adding …", and "Yield on all deposits ≈ … a year to {community}", the whole vault's yearly yield including the typed amount, so it moves as you type ("Yield, sent on to {community}" until a rate is known).
- **Kept out:** the amount ready to pay out and the action that sends it are deliberately not part of the diagram. They live in the Payouts card: one list whose first row is the waiting amount, a muted "waiting" with an info tip, and a small "Pay out" button, followed by the payouts already sent.

The labels are copy, not system. The vocabulary: deposits *generate* yield; "Generated" is everything produced for the community (paid out plus waiting); what is waiting is "Ready to pay out", shown only in the Payouts card. "Generated" was chosen over "Donated", "shared" and "earned" because nobody is cast as giving, sharing or working for it.

**The Forward Flow Rule.** The diagram's motion shows yield leaving the deposits and nothing else, so it obeys one grammar:
- the surface is two layers of waves sliding slowly in opposite directions (7s sage front, 11s foam back), a seamless constant-speed loop under a clip so the basin never changes shape;
- foam bubbles rise from the deposits (about 4.8 to 6.2s, eased in and out) and open into spray ripples at the surface;
- three spray droplets leave the rim along the stream to the community (3.6s, eased in and out, growing in, shrinking out);
- a solid ochre-light particle rises from your slice, and a dashed ochre-light ring from the adding slice, over the rim and down the stream (6s, eased in and out);
- every travelling motion eases in and out and only moves forward: x never decreases along a path;
- nothing moves when the vault has no deposits; under reduced motion all of it is removed and a still surface replaces the wave;
- the animation pauses while the diagram is off-screen; there is no pause button (the owner chose to leave it out, so reduced motion is the way to stop it);
- slices and the share bar ease their width in 200ms on cubic-bezier(0.16, 1, 0.3, 1) and snap under reduced motion.

### Deposit Summary
A paper-light inset (16px radius) under the amount field with two rows keyed to the diagram: a small hatched swatch for what you keep, a sage swatch for what the community receives a year at the current rate (with the rate and the type's rate name in caption beneath). It appears only once a valid amount is typed. The form carries no note about what withdrawals pay out; the vault type's How it works step says it.

### Community Packet
Directory card: an 80px band, a 56px seal (the avatar) overlapping it with a 4px ring in the card colour, a round white arrow button (36px, arrow up-right) in the band's top-right as the open cue that fills bottle green on hover and nudges its arrow, the name as a title, a two-line description, and a two-figure row (Deposited, Generated with the same info tip: paid out plus waiting, matching the circle) above a hairline. The whole card is the link. Small packets keep only a 32px band, the name and the deposited figure.

### Amounts
Every amount is a `bigint` in base units carried with its unit (symbol and decimals) from the vault type or the network, never an assumed 18 decimals. It renders through the TokenAmount component: rounded for reading (headline figures use the approximate form, dust reads "< 0.0001"), with a faint dotted underline that softens into a paper highlight on hover and reveals the exact value, selectable in one click. Balances beside a field are amounts like any other: rounded through TokenAmount, exact on hover. Inputs and Max use the exact value. Only button labels and toasts may print a formatted amount directly.

### Signed-in states
My deposits rows, the Withdraw tab with a position, the "Your deposit" card footer, the "yours" slice and its particle, and the "You hold …%" share line are built on the same tokens; they were checked by the product owner signed in, but have no captures in the review set.

## Do's and Don'ts

### Do:
- **Do** set the page on paper ground (#f6f1e7) and put content on white cards with 24px corners and a hairline border.
- **Do** keep one loud element per view: the bottle-green primary action or the bottle-green money field.
- **Do** key every mention of deposits, yield, community and your amount to the four inks, with the same swatch shapes as the diagram key.
- **Do** render every amount through TokenAmount with its unit from the vault type or network, exact on hover, and use exact values in inputs and Max.
- **Do** set headings and figures in Onest semibold with -0.025em tracking and tabular numerals.
- **Do** give each community its seeded circle band instead of an uploaded banner.
- **Do** use pills for segmented tabs, badges and header account controls.
- **Do** write labels in plain second-person sentences that say what happens and what doesn't, per PRODUCT.md's voice; button wording is still under discussion, so treat current labels as copy, not system.
- **Do** ease the live slice and the share bar in 200ms and drop the transition under reduced motion.
- **Do** keep diagram motion slow, eased in and out and forward-only, stopped when the vault is empty, pausable, and replaced by a still surface under reduced motion.
- **Do** draw what you are adding as the hatch (ochre-light stripes over leaf, dashed outline) everywhere it appears: slice, bar, key and summary swatch.

### Don't:
- **Don't** lay out key figures as a grid of stat tiles; put each figure on the part of the picture or packet it describes.
- **Don't** use ochre for decoration; it marks the community, you, or focus.
- **Don't** show a rounded amount with no exact value behind it, or assume 18 decimals.
- **Don't** put "Pay out now" or other housekeeping actions in the money diagram.
- **Don't** move anything in the diagram backwards, or animate it when there is nothing in the basin.
- **Don't** cast shadows on cards at rest, and don't use black or hard offset shadows on paper.
- **Don't** add uppercase kickers or eyebrow lines above headings.
- **Don't** turn the ground brown or grey; neutrals stay warm, and dark mode stays green-tinted.
- **Don't** use words like "guaranteed", "safe" or "verified identity" in any label.
