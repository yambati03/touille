import json

import anthropic

RECIPE_EXTRACTION_PROMPT = """\
You are a recipe extraction assistant. Your task is to extract recipe information from a transcript and return it as a structured JSON object.

You may receive a video caption and/or an audio transcript. Use ALL available context to extract the recipe. The caption often contains ingredient lists, quantities, or other details not spoken aloud.

Return ONLY a valid JSON object with no additional text, explanation, or markdown formatting.

Use this exact JSON structure:

{
  "title": "string",
  "description": "string or null",
  "servings": {
    "amount": number,
    "unit": "string (e.g. 'servings', 'pieces', 'portions')"
  },
  "times": {
    "prep_minutes": number or null,
    "cook_minutes": number or null,
    "total_minutes": number or null
  },
  "ingredients": [
    {
      "name": "string",
      "amount": number or null,
      "unit": "string or null",
      "notes": "string or null (sentence-style capitalization only, e.g. 'finely chopped', 'at room temperature')"
    }
  ],
  "steps": [
    {
      "order": number,
      "instruction": "string",
      "duration_minutes": number or null,
      "require_timer": boolean
    }
  ],
  "tags": ["string"],
  "equipment": ["string"],
  "notes": "string or null",
  "modifications": [{"what": "string", "why": "string"}]
}

When the user has dietary or preference settings, you may adapt the recipe. If you make any changes, you MUST include "modifications": an array of objects with "what" (brief description of the change) and "why" (reason tied to the user's preference). If you make no changes, use "modifications": [].

Rules:
- If information is not mentioned in the transcript, use null for optional fields
- Normalize ingredient amounts to numbers (e.g. "half" -> 0.5, "a dozen" -> 12)
- Normalize units to standard abbreviations (e.g. "tablespoons" -> "tbsp", "teaspoons" -> "tsp", "grams" -> "g")
- IMPORTANT: If specific amounts are not explicitly stated for ingredients, you MUST infer reasonable amounts based on the recipe context, the number of servings, the type of dish, and standard cooking ratios. Every ingredient should have an amount and unit. For ingredients used "to taste" (e.g. salt, pepper), set unit to "to taste" and leave amount and notes null so it displays as an amount.
- Split compound steps into individual, atomic steps
- For each step, always infer duration_minutes when the step involves a timed action (e.g. bake 20 min, boil 10 min, rest 30 min). Use null only when the step has no meaningful duration. Set require_timer to true only for steps where the user would benefit from a timer (e.g. baking, boiling, simmering, resting, chilling). Set require_timer to false for steps that do not need a timer (e.g. chop onions, add salt, mix ingredients).
- Infer reasonable tags from context (e.g. "vegetarian", "gluten-free", "dessert", "quick")
- List any cooking tools or equipment mentioned
- Capture any tips, variations, or serving suggestions in the notes field
- For ingredient notes, use sentence-style capitalization: only capitalize the first letter of the first word (and proper nouns if any). Do not title-case every word (e.g. "finely chopped" not "Finely Chopped", "at room temperature" not "At Room Temperature").
"""


def _settings_prompt_block(user_settings: dict) -> str:
    parts = []
    if user_settings.get("dietary_restrictions"):
        parts.append(f"Dietary restrictions or allergies: {user_settings['dietary_restrictions']}")
    spice = user_settings.get("spice_tolerance", 2)
    spice_labels = ["0 = none", "1 = low", "2 = medium", "3 = medium-high", "4 = high", "5 = very high"]
    parts.append(f"Spice tolerance: {spice} ({spice_labels[min(spice, 5)]}). Reduce or increase chili/hot spices in the recipe accordingly.")
    if user_settings.get("custom_rules"):
        parts.append(f"Additional rules: {user_settings['custom_rules']}")
    if not parts:
        return ""
    return (
        "\n\nUser preferences (adapt the recipe to these when possible; list any changes in 'modifications'):\n"
        + "\n".join(f"- {p}" for p in parts)
    )


def extract_recipe(
    transcript: str,
    api_key: str,
    caption: str | None = None,
    user_settings: dict | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> dict:
    client = anthropic.Anthropic(api_key=api_key)

    system = RECIPE_EXTRACTION_PROMPT
    if user_settings:
        system += _settings_prompt_block(user_settings)

    user_parts = []
    if caption:
        user_parts.append(f"Video caption:\n\n{caption}")
    user_parts.append(f"Transcript:\n\n{transcript}")
    user_content = "\n\n---\n\n".join(user_parts)

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=system,
        messages=[
            {"role": "user", "content": user_content},
        ],
    )

    text = response.content[0].text
    out = json.loads(text)
    if "modifications" not in out:
        out["modifications"] = []
    return out
