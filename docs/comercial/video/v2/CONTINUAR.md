# CRM PLUS STORE — comercial v2

A montagem visual tem 22 segundos, formato vertical 1080 × 1920, com gancho, movimentos de aproximação, transições em arco, páginas reais do template e chamada para demonstração. O arquivo base ainda NÃO contém áudio.

O usuário pediu vídeo comercial com locução em português brasileiro e trilha instrumental. Não tratar a base visual como entrega final. Falta gerar a locução, mixar e validar o MP4 final.

A configuração publicada já permite `speech.platform.bing.com`, mas a tarefa anterior ainda estava ligada à versão antiga, com a lista de domínios personalizados vazia. A tentativa de síntese de voz retornou 403 do proxy. Use a nova versão publicada do ambiente e verifique a política efetivamente aplicada antes de tentar novamente. Não contorne o proxy e não desative TLS.

## Concluir

Neste diretório:

1. Se edge_tts estiver ausente, instale em caminho gravável: `python -m pip install --target /workspace/.video-tools edge-tts`.
2. Gere voz: `PYTHONPATH=/workspace/.video-tools python gerar-locucao.py`.
3. Escute a voz e confirme que o texto termina em “Peça uma demonstração”, que a pronúncia da marca está compreensível e que a leitura é natural.
4. Execute `python finalizar.py`. A trilha é original, criada localmente. A mixagem reduz a música durante a fala. Se a voz exceder 22 segundos, a assinatura visual final é prolongada.
5. Verifique duração, resolução, presença de áudio, inteligibilidade e sincronia comercial. Os tempos das cenas são: 0–3 gancho; 3–7 personalização; 7–11 equipe/tratamentos; 11–14 3D; 14–18 WhatsApp; 18–22 assinatura e convite. Ajuste o tempo da voz ou a montagem se necessário; não acelere de forma artificial para encaixar.
6. Salve o MP4 final com locução no GitHub e forneça ao usuário o link de download. O chat anterior não conseguiu entregar anexos por links locais.

Locução: “Sua clínica merece uma presença digital à altura. Com a CRM Plus Store, personalize cores, logo, textos e fotos. Apresente sua equipe, tratamentos e convênios. Escolha as seções e receba solicitações pelo WhatsApp. Seu site. Sua marca. Peça uma demonstração.”
