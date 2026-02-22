import json
import subprocess
import tempfile
import os
from dataclasses import dataclass


@dataclass
class DownloadResult:
    video_path: str
    caption: str | None


def download_tiktok(url: str, output_path: str | None = None) -> DownloadResult:
    if output_path is None:
        output_path = os.path.join(tempfile.mkdtemp(), "video.mp4")

    meta_result = subprocess.run(
        ["yt-dlp", "--no-playlist", "--dump-json", url],
        capture_output=True,
        text=True,
    )
    caption = None
    if meta_result.returncode == 0:
        try:
            info = json.loads(meta_result.stdout)
            caption = info.get("description")
        except json.JSONDecodeError:
            pass

    dl_result = subprocess.run(
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
    if dl_result.returncode != 0:
        raise RuntimeError(f"yt-dlp failed: {dl_result.stderr}")

    return DownloadResult(video_path=output_path, caption=caption)
