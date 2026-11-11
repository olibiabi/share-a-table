"""Generate Share a Table assets through the class Replicate proxy (google/nano-banana-2).
Usage: python gen.py OUT_RAW_DIR [name ...]   (no names = all)"""
import json, sys, os, urllib.request
from concurrent.futures import ThreadPoolExecutor

PROXY = "https://itp-ima-replicate-proxy.web.app/api/create_n_get"
STYLE = ("Naive hand-painted gouache and colored pencil illustration in a contemporary picture-book style, "
         "like painted paper cut out with scissors. Simple flat shapes, saturated warm colors "
         "(tomato red, orange, sunny yellow, leafy green), visible crayon and pencil texture strokes inside the shapes, "
         "slightly wonky hand-cut edges, no black outlines. Single object, centered, filling most of the frame, "
         "isolated on a plain pure white background, no cast shadow, no text, no letters, no border.")

A = {
  "plate0": "An empty round ceramic dinner plate seen from directly above, cream center, tomato-red rim with small white dots.",
  "plate1": "An empty round ceramic dinner plate seen from directly above, cream center, leafy green scalloped rim.",
  "plate2": "An empty round ceramic dinner plate seen from directly above, cream center, sunny yellow rim with thin white stripes.",
  "plate3": "An empty round ceramic dinner plate seen from directly above, pale pink center, deep plum purple rim.",
  "plate4": "An empty round ceramic dinner plate seen from directly above, off-white center, cornflower blue rim with tiny painted flowers.",
  "soup": "A round bowl of noodle soup seen from directly above: golden broth, wavy noodles, a few orange carrot slices, a blue and white bowl. No herbs, no green garnish.",
  "cilantro": "One small sprig of fresh cilantro (coriander): a thin green stem with three or four flat, rounded, lobed leaves. Only green, no flowers, no other colors.",
  "pizza": "A whole round cheese and pepperoni pizza seen from directly above. No other toppings.",
  "pineapple": "One bite-sized wedge of fresh yellow pineapple, a simple chunky shape with a darker yellow core edge, bold saturated yellow.",
  "pineapplebowl": "A small green ceramic bowl full of yellow pineapple chunks, seen from directly above.",
  "bread": "One slice of plain white sandwich bread, untoasted, pale, seen from the front.",
  "toaster": "A cute retro pastel green two-slot toaster, side view, empty slots on top.",
  "cerealbox": "A yellow cereal box with a big red circle and orange cereal rings printed on the front, front view, no words.",
  "milk": "A white milk carton with a blue stripe and a gable top, front view, no words.",
  "bowlempty": "An empty red ceramic bowl with white polka dots, side view from slightly above, you can see the empty inside.",
  "bowlfull": "A red ceramic bowl with white polka dots filled with milk and orange and yellow ring cereal, side view from slightly above.",
  "egg": "One fried egg, sunny side up, seen from directly above.",
  "hotsauce": "A red hot sauce bottle with a green cap and a small chili pepper on the label, no words.",
  "flame": "A small cartoon flame, orange and yellow.",
  "chili": "One red chili pepper with a green stem.",
  "cake": "A slice of layered vanilla sponge cake with white cream and red jam layers and cream frosting on top, side view. Nothing on top.",
  "strawberry": "One ripe red strawberry with green leaves.",
  "hull": "Only the green leafy cap of a strawberry with a tiny bit of red fruit left, after someone ate the strawberry.",
  "pizzabox": "An open empty brown cardboard pizza box seen from directly above, a few grease spots and crumbs inside.",
  "slice": "One triangular slice of pepperoni pizza seen from directly above, crust at the top, tip pointing down.",
  "tomato": "One ripe red tomato with a green star-shaped stem.",
  "tablecloth": "A large round tablecloth seen from directly above, cream colored with a red and white gingham border.",
  "susan": "An empty round pale green glass lazy susan turntable seen from directly above.",
  "napkin": "A folded white paper napkin with a small red sauce stain.",
}

def gen(name, out):
    body = {"model": "google/nano-banana-2",
            "input": {"prompt": f"{A[name]} {STYLE}", "aspect_ratio": "1:1", "resolution": "1K", "output_format": "png"}}
    for attempt in range(3):
        try:
            req = urllib.request.Request(PROXY, json.dumps(body).encode(), {"Content-Type": "application/json"})
            res = json.load(urllib.request.urlopen(req, timeout=240))
            url = res["output"][0] if isinstance(res["output"], list) else res["output"]
            urllib.request.urlretrieve(url, os.path.join(out, name + ".png"))
            return f"ok   {name}"
        except Exception as e:
            err = e
    return f"FAIL {name}: {err}"

if __name__ == "__main__":
    out = sys.argv[1]; os.makedirs(out, exist_ok=True)
    names = sys.argv[2:] or list(A)
    with ThreadPoolExecutor(6) as ex:
        for line in ex.map(lambda n: gen(n, out), names):
            print(line, flush=True)
