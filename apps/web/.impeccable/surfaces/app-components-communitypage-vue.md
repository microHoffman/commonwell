---
version: 1
slug: "app-components-communitypage-vue"
primary_target: "app/components/CommunityPage.vue"
related_targets: ["app/pages/index.vue","app/pages/me.vue","app/pages/new.vue","app/app.vue"]
---

# Community page and the app shell

Scope: the whole web app (community page first, then directory, My deposits, create, dialogs). Mode: Operate. Audience: depositors (newcomers via social login and crypto-native supporters), plus owners and curators. Job: understand where the money goes, then deposit or withdraw with exact amounts. Constraints: PRODUCT.md and AGENTS.md amount rules; units from the vault type and network.

Chosen direction: Seed Library with the Wellspring flow, Version A of the final round (labels on the picture, no padding around the dark card, no "Pay out now" in the diagram). The decision sketches were deleted after the build at the owner's request; the shipped page and DESIGN.md are now the reference.

## Direction contract

THESIS: Every community is a packet in one shared seed library, and its page shows the money moving: deposits rest in a basin that stays the depositors', and only the yield flows on to the community. It refuses the category's grid of stat tiles.

OWN-WORLD: A pale paper ground (#f6f1e7, which the owner accepted, named "Paper Ground"), white cards with large soft corners, bottle green for the primary action and the diagram field, leaf green and sage for deposits and yield, ochre for the community and for "you". One modern sans (Onest) throughout, pill segmented tabs, and a geometric band of circles and half circles generated per community.

STORY: A newcomer sees who the community is, sees that their deposit stays theirs and only the yield is given, types an amount and watches their share appear in the basin, then deposits.

FIRST VIEWPORT: Left column: the packet header (band, seal overlapping it, name, Reviewed, facts), then the dark "Where the yield goes" card: the basin labelled "Deposited" with the amount and an APR pill (moving above the left rim when the slices are wide), a waving sage surface with rising bubbles, droplets down the stream to the enlarged ochre circle labelled "Generated" (paid out plus waiting, with an info tip), your deposit as a to-scale ochre slice, the amount being typed as a hatched slice, a share bar and a key with amounts. Right: the deposit card (the primary action), How it works, then Payouts: the waiting amount as a plain first row with a small "Pay out" pill (only when something is waiting), then the payouts sent. Below the left column: questions, technical details, other communities as small packets.

FORM: Seed Library, candidate 7 of the grounded list (the roll's assignment on re-roll 2), merged with Wellspring's flow at the user's direction; seed:043df0fa1074a453. Signature interaction: typing in the deposit field grows the dashed slice in the basin live; it eases in 200ms and snaps under reduced motion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved

- Owner decisions after the contract: the "Generated" wording (over Donated, shared, earned); no pause button (off-screen pausing and reduced motion remain); "Ready to pay out" only in the Payouts card; the deposit button keeps 8px corners.
- Dark mode values are derived from the light palette during the build.
