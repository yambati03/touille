import argparse
import json
import os
import subprocess
import tempfile

import whisper
from ollama import Client as OllamaClient

RECIPE_EXTRACTION_PROMPT = """\
You are a recipe extraction assistant. Your task is to extract recipe information from a transcript and return it as a structured JSON object.

Given the following transcript, extract all recipe details and return ONLY a valid JSON object with no additional text, explanation, or markdown formatting.

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


def download_tiktok(url: str, output_path: str) -> str:
    """Download a TikTok video using yt-dlp and return the output file path."""
    result = subprocess.run(
        [
            "yt-dlp",
            "--no-playlist",
            "-f", "mp4",
            "-o", output_path,
            url,
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stderr)
        raise RuntimeError(f"yt-dlp failed: {result.stderr}")
    return output_path


def transcribe_video(video_path: str, model_name: str) -> str:
    """Run Whisper on a video file and return the transcript text."""
    model = whisper.load_model(model_name)
    result = model.transcribe(video_path)
    return result["text"]


def extract_recipe(
    transcript: str,
    llm_model: str = "llama3.2",
    ollama_host: str = "http://ollama:11434",
) -> dict:
    """Send the transcript to Ollama and return structured recipe JSON."""
    client = OllamaClient(host=ollama_host)
    response = client.chat(
        model=llm_model,
        format="json",
        messages=[
            {"role": "system", "content": RECIPE_EXTRACTION_PROMPT},
            {"role": "user", "content": f"Transcript:\n\n{transcript}"},
        ],
    )
    return json.loads(response.message.content)


def main():
    parser = argparse.ArgumentParser(
        description="Download a TikTok video, transcribe it with Whisper, and extract a recipe as JSON."
    )
    parser.add_argument("url", help="TikTok video URL")
    parser.add_argument(
        "--model",
        default="base",
        choices=["tiny", "base", "small", "medium", "large"],
        help="Whisper model size (default: base)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Path to save the recipe JSON to a file (default: print to stdout)",
    )
    parser.add_argument(
        "--keep-video",
        default=None,
        help="Path to save the downloaded video (default: discard after transcription)",
    )
    parser.add_argument(
        "--llm-model",
        default="llama3.2",
        help="Ollama model to use for recipe extraction (default: llama3.2)",
    )
    parser.add_argument(
        "--ollama-host",
        default=os.environ.get("OLLAMA_HOST", "http://ollama:11434"),
        help="Ollama server URL (default: http://ollama:11434 or OLLAMA_HOST env var)",
    )
    parser.add_argument(
        "--transcript-only",
        action="store_true",
        help="Only transcribe, skip recipe extraction",
    )
    args = parser.parse_args()

    if args.keep_video:
        video_path = args.keep_video
    else:
        video_path = os.path.join(tempfile.mkdtemp(), "video.mp4")

    print(f"Downloading TikTok video: {args.url}")
    download_tiktok(args.url, video_path)
    print(f"Downloaded video to {video_path}")

    try:
        print(f"Transcribing with Whisper ({args.model} model)...")
        transcript = transcribe_video(video_path, args.model)

        print("\n--- Transcript ---")
        print(transcript)

        if args.transcript_only:
            if args.output:
                with open(args.output, "w") as f:
                    f.write(transcript)
                print(f"\nTranscript saved to {args.output}")
            return

        print(f"\nExtracting recipe from transcript using Ollama ({args.llm_model})...")
        recipe = extract_recipe(transcript, args.llm_model, args.ollama_host)
        recipe_json = json.dumps(recipe, indent=2)

        if args.output:
            with open(args.output, "w") as f:
                f.write(recipe_json)
            print(f"Recipe JSON saved to {args.output}")
        else:
            print("\n--- Recipe JSON ---")
            print(recipe_json)
    finally:
        if not args.keep_video and os.path.exists(video_path):
            os.unlink(video_path)


if __name__ == "__main__":
    main()
