import whisper

_model_cache: dict[str, whisper.Whisper] = {}


def transcribe_video(video_path: str, model_name: str = "base") -> str:
    if model_name not in _model_cache:
        _model_cache[model_name] = whisper.load_model(model_name)

    model = _model_cache[model_name]
    result = model.transcribe(video_path)
    return result["text"]
