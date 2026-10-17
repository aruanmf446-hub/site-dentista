import asyncio,os
from pathlib import Path
import edge_tts
P=Path(__file__).resolve().parent
TEXTO='Sua clínica merece uma presença digital à altura. Com a CRM Plus Store, personalize cores, logo, textos e fotos. Apresente sua equipe, tratamentos e convênios. Escolha as seções e receba solicitações pelo WhatsApp. Seu site. Sua marca. Peça uma demonstração.'
async def main():
 c=edge_tts.Communicate(TEXTO,'pt-BR-FranciscaNeural',rate='+5%',proxy=os.environ.get('HTTPS_PROXY'))
 await c.save(str(P/'locucao.mp3'))
asyncio.run(main())
