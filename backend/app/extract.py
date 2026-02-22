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
      "notes": "string or null (e.g. 'finely chopped', 'at room temperature')"
    }
  ],
  "steps": [
    {
      "order": number,
      "instruction": "string",
      "duration_minutes": number or null
    }
  ],
  "tags": ["string"],
  "equipment": ["string"],
  "notes": "string or null"
}

Rules:
- If information is not mentioned in the transcript, use null for optional fields
- Normalize ingredient amounts to numbers (e.g. "half" -> 0.5, "a dozen" -> 12)
- Normalize units to standard abbreviations (e.g. "tablespoons" -> "tbsp", "teaspoons" -> "tsp", "grams" -> "g")
- Split compound steps into individual, atomic steps
- Infer reasonable tags from context (e.g. "vegetarian", "gluten-free", "dessert", "quick")
- List any cooking tools or equipment mentioned
- Capture any tips, variations, or serving suggestions in the notes field
"""


def extract_recipe(
    transcript: str,
    api_key: str,
    caption: str | None = None,
    model: str = "claude-sonnet-4-20250514",
) -> dict:
    client = anthropic.Anthropic(api_key=api_key)

    user_parts = []
    if caption:
        user_parts.append(f"Video caption:\n\n{caption}")
    user_parts.append(f"Transcript:\n\n{transcript}")
    user_content = "\n\n---\n\n".join(user_parts)

    response = client.messages.create(
        model=model,
        max_tokens=4096,
        system=RECIPE_EXTRACTION_PROMPT,
        messages=[
            {"role": "user", "content": user_content},
        ],
    )

    text = response.content[0].text
    return json.loads(text)
