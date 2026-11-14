# Mesa Viva — cardápio em realidade aumentada

Demonstração de cardápio digital em que cada prato abre em 3D e pode ser colocado **em tamanho real na mesa do cliente**, direto pelo navegador do celular, sem aplicativo.

Restaurante, pratos e preços são fictícios.

## Como funciona

- `<model-viewer>` (Google) carregado por CDN. No Android abre o **Scene Viewer**/WebXR; no iPhone/iPad abre o **AR Quick Look** (o `.usdz` é gerado na hora a partir do `.glb`).
- `ar-scale="fixed"`: o modelo aparece com as medidas reais, em metros.
- No computador, o botão de realidade aumentada some e aparece um **QR code** que abre o mesmo prato no celular (`?prato=<id>&ar=1`).
- Sacola com número da mesa e pedido montado no WhatsApp, como nas outras demonstrações.

## Arquivos

- `index.html`, `style.css`, `app.js`: página e lógica.
- `data.js`: cardápio. Cada item aponta para `models/<id>.glb` e `img/<id>.webp`.
- `models/`: modelos 3D (glTF binário) em tamanho real.
- `img/`: imagens dos cards, renderizadas a partir dos próprios modelos.
- `tools/`: gerador dos modelos. Execute `python3 build_models.py` dentro de `tools/` para gerar de novo (requer numpy e Pillow).

## Para um cliente real

Troque os modelos de `models/` pelos pratos de verdade, digitalizados por fotogrametria (Polycam, Luma, RealityScan…) ou feitos por um modelador 3D. Mantenha cada `.glb` entre 2 e 5 MB e na escala real (1 unidade = 1 metro), depois atualize o `data.js`.
