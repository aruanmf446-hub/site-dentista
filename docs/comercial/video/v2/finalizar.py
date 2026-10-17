from pathlib import Path
import subprocess,json
P=Path(__file__).resolve().parent;voice=P/'locucao.mp3';visual=P/'montagem-visual-22s.mp4';music=P/'trilha-instrumental.wav'
if not voice.exists() or voice.stat().st_size<1000:raise SystemExit('Locução ainda indisponível. Não exportar versão final sem voz.')
def probe(p):return json.loads(subprocess.check_output(['ffprobe','-v','error','-show_format','-show_streams','-of','json',str(p)]))
v=probe(voice);assert any(s['codec_type']=='audio' for s in v['streams']);duration=max(22,float(v['format']['duration'])+.65)
# Leave the voice intelligible; lower instrumental beneath it and resolve on the final brand card.
graph='[1:a]aresample=48000,loudnorm=I=-16:TP=-1.5:LRA=7,adelay=250|250,asplit=2[voz][controle];[2:a]aresample=48000,volume=0.26[musica];[musica][controle]sidechaincompress=threshold=0.025:ratio=8:attack=12:release=300[duck];[voz][duck]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.94[audio]'
cmd=['ffmpeg','-hide_banner','-y','-i',str(visual),'-i',str(voice),'-stream_loop','-1','-i',str(music),'-filter_complex',graph,'-map','0:v:0','-map','[audio]','-vf',f'tpad=stop_mode=clone:stop_duration={max(0,duration-22):.3f}','-c:v','libx264','-preset','fast','-crf','18','-c:a','aac','-b:a','192k','-ar','48000','-t',f'{duration:.3f}','-movflags','+faststart',str(P/'CRM-Plus-Store-Comercial-Com-Locucao.mp4')]
subprocess.run(cmd,check=True)
print('EXPORTADO COM LOCUCAO',duration)
