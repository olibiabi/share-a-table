# Share a Table

*Same table, different plates.* A food mini-game for Shared Minds (ITP).

Instead of answering questions, you eat: pick the cilantro out of your soup, flick pineapple off a pizza, hold the toaster as long as you like, pour cereal or milk first, shake the hot sauce, bite the cake (or the strawberry), take the last slice (or close the lid), and write on a napkin about a dish someone made for you.

Your choices become your plate — a little self-portrait — and a position in a space of everyone who has played. At the table you don't walk around to find people: you spin the lazy Susan. Tap a dish and the table re-seats itself around you, pulling the seven people closest to you on that dish into the chairs and folding everyone else into the middle.

- **Matching:** each plate is a vector (cilantro, pineapple, toast, milk-first, spice, strawberry-last, last-slice). Shared dislikes count extra — hating cilantro together bonds people more than liking it together. Napkins are grouped by the feeling they describe.
- **Shared data:** Firebase Realtime Database (`/shareATable/plates/{anonymous uid}`), anonymous sign-in, one plate per person.
- **Illustrations:** generated once with `google/nano-banana-2` through the ITP Replicate proxy (`tools/generate_assets.py`, `tools/generate_with_reference.py`), backgrounds removed with `tools/cutout.py`.

Plain HTML, CSS and JavaScript — open `index.html` through any static server.
