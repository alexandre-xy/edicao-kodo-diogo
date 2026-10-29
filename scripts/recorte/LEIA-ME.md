# Recortes (testados na nuvem em 18/10/2026, só Node)

- `matte.mjs`: recorte da **pessoa em vídeo** (Robust Video Matting, ONNX). Gera um vídeo de máscara (branco = pessoa)
  para compor texto/imagem **atrás** do expert. ~0,3 s/quadro em 4 CPUs (38 s para 4 s de vídeo); contorno do cabelo limpo.
  `node matte.mjs <entrada.mp4> <saida_matte.mp4> --ss 15 --t 4 --fps 30`
  Precisa de `npm i onnxruntime-node` nesta pasta e do modelo `rvm.onnx` ao lado do script
  (RobustVideoMatting, release v1.0.0, `rvm_mobilenetv3_fp32.onnx` renomeado para `rvm.onnx`; conferir o arquivo antes de usar).
  Mãos rápidas a 60 fps borram: preferir trechos com pouco gesto. Se o contorno falhar: Magic Mask do DaVinci.
- `rmbg.mjs`: recorte de **produto/foto** sem fundo (PNG com alpha). Ficou limpo até em taça de vidro.
  `node rmbg.mjs <foto.jpg> <saida.png>` — precisa de `npm i @imgly/background-removal-node`.
- Composição usada no teste: ffmpeg em camadas (fundo → grafismo MOV alpha → pessoa recortada pela máscara).
