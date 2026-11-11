"""Generate assets that must match an existing one (same bowl, same box) by passing it as a reference image.
Usage: python generate_with_reference.py OUT_RAW_DIR REF_DIR [name ...]"""
import base64, io, json, os, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
from generate_assets import PROXY, STYLE

# name: (reference asset, prompt)
A = {
  "bowlcereal": ("bowlempty", "The exact same red ceramic bowl with white polka dots from the reference image, same angle and size, now filled with only dry orange and yellow ring cereal heaped up. No milk at all."),
  "bowlmilk": ("bowlempty", "The exact same red ceramic bowl with white polka dots from the reference image, same angle and size, now filled with only plain white milk. No cereal, nothing floating."),
  "bowlfull": ("bowlempty", "The exact same red ceramic bowl with white polka dots from the reference image, same angle and size, now filled with white milk with orange and yellow ring cereal floating on top."),
  "cerealpour": ("cerealbox", "The exact same yellow cereal box from the reference image, tilted about 120 degrees to the right so its open top points down and to the right, with a short stream of orange and yellow ring cereal falling straight down out of it."),
  "milkpour": ("milk", "The exact same white milk carton with a blue stripe from the reference image, tilted about 120 degrees to the left so its open spout points down and to the left, with a smooth stream of white milk pouring straight down from the spout. The background must be plain pure white, no colored shapes or patches behind it."),
}

def data_uri(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((512, 512))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=88)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()

def gen(name, out, refdir):
    ref, prompt = A[name]
    body = {"model": "google/nano-banana-2",
            "input": {"prompt": f"{prompt} {STYLE}", "image_input": [data_uri(os.path.join(refdir, ref + '.png'))],
                      "aspect_ratio": "1:1", "resolution": "1K", "output_format": "png"}}
    err = None
    for _ in range(3):
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
    out, refdir = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(A)
    with ThreadPoolExecutor(4) as ex:
        for line in ex.map(lambda n: gen(n, out, refdir), names):
            print(line, flush=True)
