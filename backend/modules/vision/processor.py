# Image preprocessing (resize, normalize)

import io

from PIL import Image


def process_image(image_bytes: bytes) -> bytes:
    """Resize image to max 1024px on longest side, convert to JPEG, and compress."""
    img = Image.open(io.BytesIO(image_bytes))

    # Convert RGBA/palette to RGB for JPEG compatibility
    if img.mode in ("RGBA", "P", "LA"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    # Resize so longest side is at most 1024px
    max_side = 1024
    width, height = img.size
    if max(width, height) > max_side:
        if width >= height:
            new_width = max_side
            new_height = int(height * (max_side / width))
        else:
            new_height = max_side
            new_width = int(width * (max_side / height))
        img = img.resize((new_width, new_height), Image.LANCZOS)

    # Save as compressed JPEG
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    return buf.getvalue()
