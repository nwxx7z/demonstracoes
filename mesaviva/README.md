# Mesa Viva — cardápio em realidade aumentada

Demonstração de cardápio digital em que cada prato abre em 3D e pode ser colocado **em tamanho real na mesa do cliente**, direto pelo navegador do celular, sem aplicativo.

Restaurante, pratos e preços são fictícios.

## Como funciona

- **Android (Chrome):** realidade aumentada própria em `ar.js` (WebXR + three.js). O cliente toca na mesa e o prato fica preso numa **âncora do ARCore** (não desliza), com sombra sobre a mesa e giro com um dedo.
- **iPhone/iPad:** `<model-viewer>` abre o **AR Quick Look** (o `.usdz` é gerado na hora a partir do `.glb`). Em navegadores sem WebXR, o model-viewer tenta o Scene Viewer do Google.
- `ar-scale="fixed"`: o modelo aparece com as medidas reais, em metros.
- No computador, o botão de realidade aumentada some e aparece um **QR code** que abre o mesmo prato no celular (`?prato=<id>&ar=1`).
- Sacola com número da mesa e pedido montado no WhatsApp, como nas outras demonstrações.

## Arquivos

- `index.html`, `style.css`, `app.js`: página e lógica.
- `ar.js`: realidade aumentada com âncora (Chrome/Android).
- `data.js`: cardápio. Cada item aponta para `models/<id>.glb` e `img/<id>.webp`.
- `models/`: modelos 3D (glTF binário) em tamanho real.
- `img/`: imagens dos cards, renderizadas a partir dos próprios modelos.
- `tools/`: gerador dos modelos. Execute `python3 build_models.py` dentro de `tools/` para gerar de novo (requer numpy e Pillow).

## Para um cliente real

Troque os modelos de `models/` pelos pratos de verdade, digitalizados por fotogrametria (Polycam, Luma, RealityScan…) ou feitos por um modelador 3D. Mantenha cada `.glb` com até ~2 MB e ~60 mil triângulos, sem triângulos degenerados, e na escala real (1 unidade = 1 metro), depois atualize o `data.js`.
