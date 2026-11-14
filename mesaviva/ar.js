/* Mesa Viva — realidade aumentada própria (WebXR + âncoras do ARCore).
 *
 * Por que existe: o modo WebXR do model-viewer não usa âncoras, então o prato
 * "desliza" quando o ARCore reajusta o mapa do ambiente. Aqui o cliente toca na
 * mesa, criamos uma XRAnchor naquele ponto e o prato fica preso nela.
 * Funciona no Chrome para Android (ARCore). iPhone continua no AR Quick Look
 * via model-viewer.
 */
// "three" e "three/addons/" vêm do importmap do index.html (os addons importam "three" pelo nome)

let libs = null;          // { THREE, GLTFLoader, RoomEnvironment }
let libsPromise = null;
let supported = false;
let running = null;       // estado da sessão atual

function loadLibs() {
  if (!libsPromise) {
    libsPromise = Promise.all([
      import("three"),
      import("three/addons/loaders/GLTFLoader.js"),
      import("three/addons/environments/RoomEnvironment.js"),
    ]).then(([THREE, g, r]) => (libs = { THREE, GLTFLoader: g.GLTFLoader, RoomEnvironment: r.RoomEnvironment }));
  }
  return libsPromise;
}

const ready = (async () => {
  try {
    if (!navigator.xr || !window.isSecureContext) return false;
    supported = await navigator.xr.isSessionSupported("immersive-ar");
    if (supported) loadLibs().catch(() => { supported = false; });
    return supported;
  } catch {
    return false;
  }
})();

const modelCache = new Map();
function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, loadLibs().then(({ GLTFLoader }) => new GLTFLoader().loadAsync(url)));
  }
  return modelCache.get(url);
}

/* ---------- interface sobreposta à câmera (DOM overlay) ---------- */
function overlay() {
  let el = document.getElementById("xr-overlay");
  if (el) return el;
  el = document.createElement("div");
  el.id = "xr-overlay";
  el.innerHTML =
    '<div class="xr-top"><div class="xr-title"><strong></strong><small>Tamanho real</small></div>' +
    '<button type="button" class="xr-close" aria-label="Sair da realidade aumentada">×</button></div>' +
    '<div class="xr-msg"><span></span></div>';
  document.body.appendChild(el);
  return el;
}
function say(text) {
  const s = document.querySelector("#xr-overlay .xr-msg span");
  if (s) s.textContent = text;
}

/* ---------- sessão ---------- */
function start(item) {
  if (!supported || running) return false;
  const root = overlay();
  root.querySelector(".xr-title strong").textContent = item.name;
  root.classList.add("on");
  say("Mova o celular devagar, apontando para a mesa");
  // requestSession precisa acontecer já, dentro do toque do usuário
  const req = navigator.xr.requestSession("immersive-ar", {
    requiredFeatures: ["hit-test"],
    optionalFeatures: ["anchors", "dom-overlay", "local-floor"],
    domOverlay: { root },
  });
  const modelP = loadModel(item.model);
  running = { item };
  req.then(session => run(session, item, modelP, root)).catch(err => {
    console.warn("AR não iniciou", err);
    root.classList.remove("on");
    running = null;
    window.dispatchEvent(new CustomEvent("mesaviva-ar-failed"));
  });
  return true;
}

async function run(session, item, modelP, root) {
  const { THREE, RoomEnvironment } = await loadLibs();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType("local");
  renderer.domElement.style.display = "none";
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 20);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a66, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -0.45;
  sun.shadow.camera.right = sun.shadow.camera.top = 0.45;
  sun.shadow.camera.near = 0.05;
  sun.shadow.camera.far = 3;
  sun.shadow.bias = -0.0005;
  sun.shadow.radius = 4;

  // grupo do prato: a âncora controla a posição; o giro fica em "spin"
  const holder = new THREE.Group();
  holder.visible = false;
  const spin = new THREE.Group();
  holder.add(spin);
  holder.add(sun);
  sun.position.set(0.35, 1.0, 0.45);
  sun.target = spin;
  // sombra sobre a mesa real
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.ShadowMaterial({ opacity: 0.32 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.y = 0.0005;
  catcher.receiveShadow = true;
  holder.add(catcher);
  scene.add(holder);

  // retícula (círculo no ponto da mesa)
  const reticle = new THREE.Group();
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.09, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 }));
  const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff5a36 }));
  reticle.add(ring, dot);
  scene.add(reticle);

  let model = null;
  modelP.then(gltf => {
    model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    spin.add(model);
  }).catch(() => say("Não foi possível carregar o prato. Verifique a internet."));

  await renderer.xr.setSession(session);
  const refSpace = renderer.xr.getReferenceSpace();
  const viewerSpace = await session.requestReferenceSpace("viewer");
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });

  let lastHit = null;
  let anchor = null;
  let placedMatrix = null;   // usado se o aparelho não tiver âncoras
  let placed = false;
  let found = false;
  let ignoreSelectUntil = 0;
  const tmpM = new THREE.Matrix4();
  const up = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const p = new THREE.Vector3();

  // não posiciona o prato ao tocar nos botões da interface
  root.querySelectorAll("button").forEach(b => b.addEventListener("beforexrselect", e => e.preventDefault()));
  const closeBtn = root.querySelector(".xr-close");
  const onClose = () => session.end();
  closeBtn.addEventListener("click", onClose);

  // girar com um dedo (arrastar na horizontal)
  let touchX = null, moved = 0;
  const onTouchStart = e => { if (e.touches.length === 1) { touchX = e.touches[0].clientX; moved = 0; } };
  const onTouchMove = e => {
    if (touchX === null || !placed || e.touches.length !== 1) return;
    const x = e.touches[0].clientX;
    const dx = x - touchX;
    touchX = x;
    moved += Math.abs(dx);
    spin.rotation.y += dx * 0.012;
  };
  const onTouchEnd = () => { if (moved > 12) ignoreSelectUntil = performance.now() + 400; touchX = null; };
  root.addEventListener("touchstart", onTouchStart, { passive: true });
  root.addEventListener("touchmove", onTouchMove, { passive: true });
  root.addEventListener("touchend", onTouchEnd, { passive: true });

  session.addEventListener("select", async () => {
    if (performance.now() < ignoreSelectUntil || !lastHit) return;
    const hit = lastHit;
    const pose = hit.getPose(refSpace);
    if (!pose) return;
    // prato de frente para quem está olhando
    p.setFromMatrixPosition(tmpM.fromArray(pose.transform.matrix));
    camPos.setFromMatrixPosition(renderer.xr.getCamera().matrixWorld);
    spin.rotation.y = Math.atan2(camPos.x - p.x, camPos.z - p.z);
    placedMatrix = pose.transform.matrix.slice();
    if (anchor) { try { anchor.delete(); } catch {} anchor = null; }
    if (hit.createAnchor) {
      try { anchor = await hit.createAnchor(); } catch { anchor = null; }
    }
    placed = true;
    say(model ? "Arraste para girar • toque na mesa para mudar de lugar" : "Carregando o prato…");
    if (navigator.vibrate) navigator.vibrate(12);
  });

  function cleanup() {
    renderer.setAnimationLoop(null);
    hitSource.cancel?.();
    closeBtn.removeEventListener("click", onClose);
    root.removeEventListener("touchstart", onTouchStart);
    root.removeEventListener("touchmove", onTouchMove);
    root.removeEventListener("touchend", onTouchEnd);
    root.classList.remove("on");
    spin.clear();
    renderer.dispose();
    pmrem.dispose();
    renderer.domElement.remove();
    running = null;
  }
  session.addEventListener("end", cleanup);

  renderer.setAnimationLoop((t, frame) => {
    if (!frame) return;
    // retícula: só superfícies horizontais (mesa, chão)
    const hits = frame.getHitTestResults(hitSource);
    lastHit = null;
    if (hits.length) {
      const pose = hits[0].getPose(refSpace);
      if (pose) {
        tmpM.fromArray(pose.transform.matrix);
        up.set(0, 1, 0).applyMatrix4(tmpM.clone().setPosition(0, 0, 0));
        if (up.y > 0.85) {
          lastHit = hits[0];
          reticle.matrix.copy(tmpM);
        }
      }
    }
    reticle.visible = !!lastHit;
    if (lastHit && !found) {
      found = true;
      if (!placed) say("Toque na tela para colocar o prato aqui");
    }
    // posição do prato vem da âncora a cada quadro (não desliza)
    if (placed) {
      let m = null;
      if (anchor && frame.trackedAnchors && frame.trackedAnchors.has(anchor)) {
        const ap = frame.getPose(anchor.anchorSpace, refSpace);
        if (ap) m = ap.transform.matrix;
      }
      if (!m) m = placedMatrix;
      tmpM.fromArray(m);
      holder.position.setFromMatrixPosition(tmpM);
      holder.visible = !!model;
      if (model && document.querySelector("#xr-overlay .xr-msg span").textContent === "Carregando o prato…") {
        say("Arraste para girar • toque na mesa para mudar de lugar");
      }
    }
    renderer.render(scene, camera);
  });
}

window.MesaVivaAR = {
  ready,
  get supported() { return supported; },
  preload(url) { if (supported) loadModel(url).catch(() => {}); },
  start,
};
