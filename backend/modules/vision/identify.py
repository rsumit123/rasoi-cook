# Ingredient image recognition using Google Vision API

import base64
import logging

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

# Mapping of common Indian cooking ingredients: English (lowercase) -> Hindi
INGREDIENT_HINDI_MAP: dict[str, str] = {
    "tomato": "\u091f\u092e\u093e\u091f\u0930",
    "onion": "\u092a\u094d\u092f\u093e\u091c\u093c",
    "potato": "\u0906\u0932\u0942",
    "garlic": "\u0932\u0939\u0938\u0941\u0928",
    "ginger": "\u0905\u0926\u0930\u0915",
    "chili": "\u092e\u093f\u0930\u094d\u091a",
    "chilli": "\u092e\u093f\u0930\u094d\u091a",
    "pepper": "\u092e\u093f\u0930\u094d\u091a",
    "green chili": "\u0939\u0930\u0940 \u092e\u093f\u0930\u094d\u091a",
    "cumin": "\u091c\u0940\u0930\u093e",
    "turmeric": "\u0939\u0932\u094d\u0926\u0940",
    "coriander": "\u0927\u0928\u093f\u092f\u093e",
    "cilantro": "\u0927\u0928\u093f\u092f\u093e",
    "mustard": "\u0930\u093e\u0908",
    "fenugreek": "\u092e\u0947\u0925\u0940",
    "cardamom": "\u0907\u0932\u093e\u092f\u091a\u0940",
    "cinnamon": "\u0926\u093e\u0932\u091a\u0940\u0928\u0940",
    "clove": "\u0932\u094c\u0902\u0917",
    "bay leaf": "\u0924\u0947\u091c\u092a\u0924\u094d\u0924\u093e",
    "rice": "\u091a\u093e\u0935\u0932",
    "lentil": "\u0926\u093e\u0932",
    "chickpea": "\u091b\u094b\u0932\u0947",
    "paneer": "\u092a\u0928\u0940\u0930",
    "yogurt": "\u0926\u0939\u0940",
    "butter": "\u092e\u0915\u094d\u0916\u0928",
    "ghee": "\u0918\u0940",
    "coconut": "\u0928\u093e\u0930\u093f\u092f\u0932",
    "spinach": "\u092a\u093e\u0932\u0915",
    "cauliflower": "\u092b\u0942\u0932\u0917\u094b\u092d\u0940",
    "eggplant": "\u092c\u0948\u0902\u0917\u0928",
    "okra": "\u092d\u093f\u0902\u0921\u0940",
    "pea": "\u092e\u091f\u0930",
    "carrot": "\u0917\u093e\u091c\u0930",
    "lemon": "\u0928\u0940\u092c\u0942",
    "mango": "\u0906\u092e",
    "saffron": "\u0915\u0947\u0938\u0930",
    "asafoetida": "\u0939\u0940\u0902\u0917",
    "tamarind": "\u0907\u092e\u0932\u0940",
    "jaggery": "\u0917\u0941\u0921\u093c",
    "cashew": "\u0915\u093e\u091c\u0942",
    "almond": "\u092c\u093e\u0926\u093e\u092e",
}

# Labels from Google Vision that indicate food / ingredients
FOOD_CATEGORIES = {
    "food",
    "fruit",
    "vegetable",
    "produce",
    "ingredient",
    "spice",
    "herb",
    "natural foods",
    "plant",
    "legume",
    "grain",
    "dairy",
    "meat",
    "seafood",
    "nut",
    "seed",
    "leaf vegetable",
    "root vegetable",
    "citrus",
    "berry",
}


def get_hindi_name(ingredient: str) -> str | None:
    """Look up Hindi name for an ingredient."""
    key = ingredient.lower().strip()
    if key in INGREDIENT_HINDI_MAP:
        return INGREDIENT_HINDI_MAP[key]
    # Try partial match
    for eng, hindi in INGREDIENT_HINDI_MAP.items():
        if eng in key or key in eng:
            return hindi
    return None


async def identify_ingredient(image_bytes: bytes) -> dict:
    """Send image to Google Vision API and identify the ingredient.

    Returns dict with keys: ingredient, ingredient_hi, confidence, all_labels, error
    """
    api_key = settings.GOOGLE_VISION_API_KEY
    if not api_key:
        return {
            "ingredient": None,
            "ingredient_hi": None,
            "confidence": 0.0,
            "all_labels": [],
            "error": "Google Vision API key is not configured. Set GOOGLE_VISION_API_KEY in .env",
        }

    b64_image = base64.b64encode(image_bytes).decode("utf-8")

    payload = {
        "requests": [
            {
                "image": {"content": b64_image},
                "features": [{"type": "LABEL_DETECTION", "maxResults": 10}],
            }
        ]
    }

    url = f"https://vision.googleapis.com/v1/images:annotate?key={api_key}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Google Vision API HTTP error: %s", exc.response.text)
        return {
            "ingredient": None,
            "ingredient_hi": None,
            "confidence": 0.0,
            "all_labels": [],
            "error": f"Google Vision API error: {exc.response.status_code}",
        }
    except httpx.RequestError as exc:
        logger.error("Google Vision API request error: %s", exc)
        return {
            "ingredient": None,
            "ingredient_hi": None,
            "confidence": 0.0,
            "all_labels": [],
            "error": "Failed to connect to Google Vision API",
        }

    data = resp.json()
    annotations = (
        data.get("responses", [{}])[0].get("labelAnnotations", [])
    )

    all_labels = [
        {"description": a["description"], "score": a["score"]}
        for a in annotations
    ]

    # Find the most specific food-related label
    best_ingredient: str | None = None
    best_confidence: float = 0.0

    for label in annotations:
        desc_lower = label["description"].lower()
        # Skip generic category labels
        if desc_lower in FOOD_CATEGORIES:
            continue
        # Prefer labels that match our known ingredient list
        if desc_lower in INGREDIENT_HINDI_MAP:
            best_ingredient = label["description"]
            best_confidence = label["score"]
            break
        # Otherwise take first non-category label as candidate
        if best_ingredient is None:
            best_ingredient = label["description"]
            best_confidence = label["score"]

    if best_ingredient is None and annotations:
        best_ingredient = annotations[0]["description"]
        best_confidence = annotations[0]["score"]

    hindi = get_hindi_name(best_ingredient) if best_ingredient else None

    return {
        "ingredient": best_ingredient,
        "ingredient_hi": hindi,
        "confidence": round(best_confidence, 4),
        "all_labels": all_labels,
        "error": None,
    }
