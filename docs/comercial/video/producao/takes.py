import json, difflib, unicodedata, re, sherpa_onnx, soundfile as sf
V="tts/vits-piper-pt_BR-cadu-medium"
tts = sherpa_onnx.OfflineTts(sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=f"{V}/pt_BR-cadu-medium.onnx", tokens=f"{V}/tokens.txt", data_dir=f"{V}/espeak-ng-data"), num_threads=4)))
d="tts/sherpa-onnx-whisper-small"
asr = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f"{d}/small-encoder.int8.onnx", decoder=f"{d}/small-decoder.int8.onnx", tokens=f"{d}/small-tokens.txt", language="pt", task="transcribe", num_threads=4)
def norm(s):
    s = unicodedata.normalize('NFKD', s.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9 ]', ' ', s.replace('+',' plus ')).split()
falas = json.load(open("work/falas.json")); alvos = json.load(open("work/alvos.json"))
for i,(f,a) in enumerate(zip(falas, alvos)):
    best=None
    for k in range(10):
        au = tts.generate(f, sid=0, speed=1.0)
        s = asr.create_stream(); s.accept_waveform(au.sample_rate, au.samples); asr.decode_stream(s)
        sc = difflib.SequenceMatcher(None, norm(s.result.text), norm(a)).ratio()
        if not best or sc > best[0]: best=(sc, au, s.result.text)
        if sc >= 0.999: break
    sf.write(f"vo/fala{i+1}.wav", best[1].samples, best[1].sample_rate)
    print(i+1, round(best[0],3), k+1, best[2], flush=True)
