"""Mini biblioteca de geometria procedural + texturas + exportador GLB (glTF 2.0).

Sem dependências além de numpy e Pillow. Unidades em metros, eixo Y para cima,
para que o modelo apareça em tamanho real na realidade aumentada.
"""
import io
import json
import math
import struct

import numpy as np
from PIL import Image, ImageFilter

TAU = 2 * math.pi


# ----------------------------------------------------------------- ruído
class Noise3:
    """Ruído 3D suave (soma de senoides em direções aleatórias), média 0, desvio ~1."""

    def __init__(self, seed, freq=1.0, n=28):
        r = np.random.default_rng(seed)
        self.w = r.normal(size=(n, 3)) * freq
        self.p = r.uniform(0, TAU, n)
        self.a = math.sqrt(2.0 / n)

    def __call__(self, P):
        return np.sin(P @ self.w.T + self.p).sum(-1) * self.a


def fbm3(seed, base_freq, octaves=3):
    ns = [Noise3(seed + k, base_freq * 2 ** k) for k in range(octaves)]

    def f(P):
        return sum(n(P) * 0.5 ** k for k, n in enumerate(ns)) / sum(0.5 ** k for k in range(octaves))

    return f


def tile_noise(h, w, cy, cx, seed):
    r = np.random.default_rng(seed)
    a = r.random((cy, cx))
    big = np.tile(a, (3, 3))
    im = Image.fromarray((big * 255).astype(np.uint8)).resize((3 * w, 3 * h), Image.BICUBIC)
    return np.asarray(im, float)[h:2 * h, w:2 * w] / 255.0


def fbm2(h, w, seed, cells=(4, 8, 16, 32, 64), gain=0.55):
    tot = np.zeros((h, w))
    ws = 0
    for k, c in enumerate(cells):
        g = gain ** k
        cy = max(2, int(round(c * h / max(h, w))))
        cx = max(2, int(round(c * w / max(h, w))))
        tot += g * tile_noise(h, w, cy, cx, seed + 31 * k)
        ws += g
    return tot / ws


def srgb(hexstr):
    hexstr = hexstr.lstrip('#')
    return np.array([int(hexstr[i:i + 2], 16) for i in (0, 2, 4)], float) / 255.0


def to_linear(c):
    c = np.asarray(c, float)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def gradient_rows(h, w, stops):
    """Imagem (h,w,3) com gradiente vertical; stops = [(v, '#hex'), ...]. v=0 é a 1ª linha."""
    vs = np.linspace(0, 1, h)
    sv = np.array([s[0] for s in stops])
    cols = np.array([srgb(s[1]) for s in stops])
    out = np.stack([np.interp(vs, sv, cols[:, k]) for k in range(3)], -1)
    return np.repeat(out[:, None, :], w, axis=1)


def to_image(arr):
    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))


# ----------------------------------------------------------------- geometria
def grid_indices(nr, nc):
    i = np.arange(nr - 1)[:, None]
    j = np.arange(nc - 1)[None, :]
    a = i * nc + j
    b = (i + 1) * nc + j
    c = i * nc + j + 1
    d = (i + 1) * nc + j + 1
    t1 = np.stack([a, b, c], -1).reshape(-1, 3)
    t2 = np.stack([c, b, d], -1).reshape(-1, 3)
    return np.concatenate([t1, t2]).astype(np.int64)


class Geo:
    def __init__(self, P, I, UV=None):
        self.P = np.asarray(P, float).reshape(-1, 3)
        self.I = np.asarray(I, np.int64).reshape(-1, 3)
        self.UV = np.zeros((len(self.P), 2)) if UV is None else np.asarray(UV, float).reshape(-1, 2)
        self.N = None

    def copy(self):
        g = Geo(self.P.copy(), self.I.copy(), self.UV.copy())
        g.N = None if self.N is None else self.N.copy()
        return g

    # --- transformações
    def apply(self, M=None, t=(0, 0, 0)):
        if M is not None:
            self.P = self.P @ np.asarray(M).T
            if self.N is not None:
                Ninv = np.linalg.inv(np.asarray(M)).T
                n = self.N @ Ninv.T
                self.N = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
        self.P = self.P + np.asarray(t, float)
        return self

    def scale(self, s):
        s = np.broadcast_to(np.asarray(s, float), (3,))
        return self.apply(np.diag(s))

    def move(self, *t):
        return self.apply(None, t)

    def flip(self):
        self.I = self.I[:, [0, 2, 1]]
        if self.N is not None:
            self.N = -self.N
        return self

    def normals(self, weld=True):
        P, I = self.P, self.I
        fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
        if weld:
            key = np.round(P / 2e-6).astype(np.int64)
            _, inv = np.unique(key, axis=0, return_inverse=True)
            inv = inv.ravel()
            acc = np.zeros((inv.max() + 1, 3))
            for k in range(3):
                np.add.at(acc, inv[I[:, k]], fn)
            N = acc[inv]
        else:
            N = np.zeros_like(P)
            for k in range(3):
                np.add.at(N, I[:, k], fn)
        ln = np.linalg.norm(N, axis=1, keepdims=True)
        N = np.where(ln > 1e-14, N / np.maximum(ln, 1e-14), np.array([0, 1, 0.0]))
        self.N = N
        return self

    def orient(self, hint):
        """Garante que as faces apontem para `hint` (vetor) na média."""
        P, I = self.P, self.I
        fn = np.cross(P[I[:, 1]] - P[I[:, 0]], P[I[:, 2]] - P[I[:, 0]])
        if (fn @ np.asarray(hint, float)).sum() < 0:
            self.flip()
        return self

    def displace(self, fn, along=None):
        """Desloca vértices: fn(P)->escalar; along=None usa as normais."""
        if self.N is None:
            self.normals()
        d = fn(self.P)[:, None]
        if along is None:
            self.P = self.P + self.N * d
        else:
            self.P = self.P + np.asarray(along, float) * d
        self.N = None
        return self

    def double(self):
        """Duplica com faces invertidas (dupla face real, compatível com AR Quick Look)."""
        if self.N is None:
            self.normals()
        back = self.copy().flip()
        return merge([self, back])


def merge(geos):
    Ps, Is, UVs, Ns = [], [], [], []
    off = 0
    need_n = all(g.N is not None for g in geos)
    for g in geos:
        Ps.append(g.P)
        Is.append(g.I + off)
        UVs.append(g.UV)
        if need_n:
            Ns.append(g.N)
        off += len(g.P)
    out = Geo(np.concatenate(Ps), np.concatenate(Is), np.concatenate(UVs))
    if need_n:
        out.N = np.concatenate(Ns)
    return out


def spline(pts, n_per=8):
    """Catmull-Rom passando por todos os pontos (2D ou 3D)."""
    pts = np.asarray(pts, float)
    P = np.vstack([pts[0], pts, pts[-1]])
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for t in np.linspace(0, 1, n_per, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-1])
    return np.array(out)


def lathe(profile, seg=96, v_range=(0.0, 1.0), u_rep=1.0, theta0=0.0):
    """Superfície de revolução. profile = [(r, y), ...]; percorrer a parede externa de baixo p/ cima."""
    prof = np.asarray(profile, float)
    seglen = np.linalg.norm(np.diff(prof, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(seglen)])
    t = s / max(s[-1], 1e-12)
    th = np.linspace(0, TAU, seg + 1) + theta0
    T, Th = np.meshgrid(t, th, indexing='ij')
    R = np.repeat(prof[:, 0][:, None], seg + 1, 1)
    Y = np.repeat(prof[:, 1][:, None], seg + 1, 1)
    X = R * np.cos(Th)
    Z = R * np.sin(Th)
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    U = ((Th - theta0) / TAU * u_rep).reshape(-1)
    V = (v_range[0] + T * (v_range[1] - v_range[0])).reshape(-1)
    g = Geo(P, grid_indices(len(prof), seg + 1), np.stack([U, V], -1))
    g.rows, g.cols = len(prof), seg + 1
    return g


def disc(radius, y=0.0, seg=96, rings=12, up=True, uv_radius=None, r0=0.0):
    rr = np.linspace(r0, radius, rings + 1)
    th = np.linspace(0, TAU, seg + 1)
    Rg, Th = np.meshgrid(rr, th, indexing='ij')
    X = Rg * np.cos(Th)
    Z = Rg * np.sin(Th)
    P = np.stack([X, np.full_like(X, y), Z], -1).reshape(-1, 3)
    ur = uv_radius or radius
    UV = np.stack([0.5 + X.reshape(-1) / (2 * ur), 0.5 + Z.reshape(-1) / (2 * ur)], -1)
    g = Geo(P, grid_indices(rings + 1, seg + 1), UV)
    g.orient((0, 1 if up else -1, 0))
    return g


def ellipsoid(a, b, c, seg=24, rings=14):
    phi = np.linspace(0, math.pi, rings + 1)
    prof = np.stack([np.sin(phi), -np.cos(phi)], -1)
    g = lathe(prof, seg=seg)
    g.scale((a, b, c))
    return g


def surface(fn, nu, nv, hint=(0, 1, 0)):
    """Superfície paramétrica fn(u,v)->(x,y,z) com u,v em [0,1]."""
    u = np.linspace(0, 1, nu)
    v = np.linspace(0, 1, nv)
    V, U = np.meshgrid(v, u, indexing='ij')
    X, Y, Z = fn(U, V)
    P = np.stack([X, Y, Z], -1).reshape(-1, 3)
    g = Geo(P, grid_indices(nv, nu), np.stack([U.reshape(-1), V.reshape(-1)], -1))
    g.orient(hint)
    return g


def tube(path, radius, ring=10, uv_v_scale=1.0):
    """Tubo ao longo de um caminho 3D. radius: escalar ou array (len(path))."""
    path = np.asarray(path, float)
    n = len(path)
    rad = np.broadcast_to(np.asarray(radius, float), (n,))
    T = np.gradient(path, axis=0)
    T /= np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-12)
    ref = np.array([0, 1, 0.0]) if abs(T[0][1]) < 0.9 else np.array([1, 0, 0.0])
    Nv = np.cross(T[0], ref)
    Nv /= np.linalg.norm(Nv)
    Ns, Bs = [], []
    for i in range(n):
        if i > 0:
            Nv = Nv - T[i] * (Nv @ T[i])
            Nv /= max(np.linalg.norm(Nv), 1e-12)
        Ns.append(Nv.copy())
        Bs.append(np.cross(T[i], Nv))
    Ns, Bs = np.array(Ns), np.array(Bs)
    ph = np.linspace(0, TAU, ring + 1)
    d = np.cos(ph)[None, :, None] * Ns[:, None, :] - np.sin(ph)[None, :, None] * Bs[:, None, :]
    P = path[:, None, :] + d * rad[:, None, None]
    seglen = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(path, axis=0), axis=1))])
    V = np.repeat(seglen[:, None] * uv_v_scale, ring + 1, 1)
    U = np.repeat((ph / TAU)[None, :], n, 0)
    g = Geo(P.reshape(-1, 3), grid_indices(n, ring + 1), np.stack([U.reshape(-1), V.reshape(-1)], -1))
    return g


def box(sx, sy, sz):
    """Caixa com arestas vivas (vértices separados por face), base em y=0."""
    hx, hz = sx / 2, sz / 2
    faces = [
        ((1, 0, 0), [(hx, 0, -hz), (hx, sy, -hz), (hx, sy, hz), (hx, 0, hz)]),
        ((-1, 0, 0), [(-hx, 0, hz), (-hx, sy, hz), (-hx, sy, -hz), (-hx, 0, -hz)]),
        ((0, 0, 1), [(hx, 0, hz), (hx, sy, hz), (-hx, sy, hz), (-hx, 0, hz)]),
        ((0, 0, -1), [(-hx, 0, -hz), (-hx, sy, -hz), (hx, sy, -hz), (hx, 0, -hz)]),
        ((0, 1, 0), [(-hx, sy, -hz), (-hx, sy, hz), (hx, sy, hz), (hx, sy, -hz)]),
        ((0, -1, 0), [(-hx, 0, hz), (-hx, 0, -hz), (hx, 0, -hz), (hx, 0, hz)]),
    ]
    P, I, UV, N = [], [], [], []
    for k, (n, q) in enumerate(faces):
        base = len(P)
        P += q
        N += [n] * 4
        UV += [(0, 0), (0, 1), (1, 1), (1, 0)]
        tri = [(base, base + 1, base + 2), (base, base + 2, base + 3)]
        a, b, c = np.array(q[0]), np.array(q[1]), np.array(q[2])
        if np.cross(b - a, c - a) @ np.array(n) < 0:
            tri = [(t[0], t[2], t[1]) for t in tri]
        I += tri
    g = Geo(P, I, UV)
    g.N = np.array(N, float)
    return g


def rot_y(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])


def rot_x(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])


def rot_z(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def rot_to(n, spin=0.0):
    """Rotação que leva o eixo Y até o vetor n (com giro `spin` em torno de Y antes)."""
    n = np.asarray(n, float)
    n = n / np.linalg.norm(n)
    y = np.array([0, 1, 0.0])
    v = np.cross(y, n)
    c = y @ n
    if np.linalg.norm(v) < 1e-9:
        R = np.eye(3) if c > 0 else np.diag([1, -1, -1.0])
    else:
        vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
        R = np.eye(3) + vx + vx @ vx * (1 / (1 + c))
    return R @ rot_y(spin)


# ----------------------------------------------------------------- cena e GLB
class Material:
    def __init__(self, name, color='#ffffff', rough=0.6, metal=0.0, tex=None, alpha=1.0,
                 tex_quality=88, png=False):
        self.name = name
        self.color = color
        self.rough = rough
        self.metal = metal
        self.tex = tex  # PIL.Image (sRGB) ou None
        self.alpha = alpha
        self.tex_quality = tex_quality
        self.png = png


class Scene:
    def __init__(self, name):
        self.name = name
        self.parts = {}  # nome do material -> [Geo]
        self.mats = {}

    def add(self, mat, geo):
        if mat.name not in self.mats:
            self.mats[mat.name] = mat
        if geo.N is None:
            geo.normals()
        self.parts.setdefault(mat.name, []).append(geo)

    def bounds(self):
        P = np.concatenate([g.P for gs in self.parts.values() for g in gs])
        return P.min(0), P.max(0)

    def stats(self):
        v = sum(len(g.P) for gs in self.parts.values() for g in gs)
        t = sum(len(g.I) for gs in self.parts.values() for g in gs)
        return v, t

    def write_glb(self, path):
        buf = bytearray()
        views, accessors, images, textures, materials, prims = [], [], [], [], [], []

        def add_view(data, target=None):
            while len(buf) % 4:
                buf.append(0)
            off = len(buf)
            buf.extend(data)
            v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
            if target:
                v['target'] = target
            views.append(v)
            return len(views) - 1

        def add_acc(arr, ctype, typ, target, minmax=False):
            arr = np.ascontiguousarray(arr)
            vi = add_view(arr.tobytes(), target)
            a = {'bufferView': vi, 'componentType': ctype, 'count': int(arr.shape[0]), 'type': typ}
            if minmax:
                a['min'] = [float(x) for x in arr.min(0)]
                a['max'] = [float(x) for x in arr.max(0)]
            accessors.append(a)
            return len(accessors) - 1

        mat_index = {}
        for name, m in self.mats.items():
            pbr = {'metallicFactor': m.metal, 'roughnessFactor': m.rough}
            if m.tex is not None:
                bio = io.BytesIO()
                if m.png:
                    m.tex.save(bio, 'PNG', optimize=True)
                    mime = 'image/png'
                else:
                    m.tex.convert('RGB').save(bio, 'JPEG', quality=m.tex_quality, optimize=True)
                    mime = 'image/jpeg'
                vi = add_view(bio.getvalue())
                images.append({'bufferView': vi, 'mimeType': mime, 'name': name})
                textures.append({'source': len(images) - 1, 'sampler': 0})
                pbr['baseColorTexture'] = {'index': len(textures) - 1}
                pbr['baseColorFactor'] = [1, 1, 1, m.alpha]
            else:
                c = to_linear(srgb(m.color))
                pbr['baseColorFactor'] = [float(c[0]), float(c[1]), float(c[2]), m.alpha]
            md = {'name': name, 'pbrMetallicRoughness': pbr}
            if m.alpha < 1:
                md['alphaMode'] = 'BLEND'
            materials.append(md)
            mat_index[name] = len(materials) - 1

        for name, geos in self.parts.items():
            g = merge(geos)
            # remove triângulos degenerados (área zero / índices repetidos) — alguns visualizadores AR travam com eles
            I3 = g.I
            Pf = g.P.astype(np.float32).astype(np.float64)
            area = np.linalg.norm(np.cross(Pf[I3[:, 1]] - Pf[I3[:, 0]], Pf[I3[:, 2]] - Pf[I3[:, 0]]), axis=1)
            ok = (area > 1e-13) & (I3[:, 0] != I3[:, 1]) & (I3[:, 1] != I3[:, 2]) & (I3[:, 0] != I3[:, 2])
            I3 = I3[ok]
            used = np.unique(I3)
            remap = np.full(len(g.P), -1, np.int64)
            remap[used] = np.arange(len(used))
            Nm = g.N
            g = Geo(g.P[used], remap[I3], g.UV[used])
            g.N = Nm[used]
            P = g.P.astype(np.float32)
            N = g.N.astype(np.float32)
            UV = g.UV.astype(np.float32)
            I = g.I.reshape(-1)
            if len(P) < 65536:
                I = I.astype(np.uint16)
                ict = 5123
            else:
                I = I.astype(np.uint32)
                ict = 5125
            prim = {
                'attributes': {
                    'POSITION': add_acc(P, 5126, 'VEC3', 34962, True),
                    'NORMAL': add_acc(N, 5126, 'VEC3', 34962),
                    'TEXCOORD_0': add_acc(UV, 5126, 'VEC2', 34962),
                },
                'indices': None,
                'material': mat_index[name],
            }
            ia = np.ascontiguousarray(I)
            vi = add_view(ia.tobytes(), 34963)
            accessors.append({'bufferView': vi, 'componentType': ict, 'count': int(ia.shape[0]), 'type': 'SCALAR'})
            prim['indices'] = len(accessors) - 1
            prims.append(prim)

        while len(buf) % 4:
            buf.append(0)
        gltf = {
            'asset': {'version': '2.0', 'generator': 'Mesa Viva - build_models.py (Gunter Bauer Developer)'},
            'scene': 0,
            'scenes': [{'name': self.name, 'nodes': [0]}],
            'nodes': [{'name': self.name, 'mesh': 0}],
            'meshes': [{'name': self.name, 'primitives': prims}],
            'materials': materials,
            'buffers': [{'byteLength': len(buf)}],
            'bufferViews': views,
            'accessors': accessors,
        }
        if images:
            gltf['images'] = images
            gltf['textures'] = textures
            gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
        js = json.dumps(gltf, separators=(',', ':')).encode()
        while len(js) % 4:
            js += b' '
        total = 12 + 8 + len(js) + 8 + len(buf)
        with open(path, 'wb') as f:
            f.write(struct.pack('<III', 0x46546C67, 2, total))
            f.write(struct.pack('<II', len(js), 0x4E4F534A))
            f.write(js)
            f.write(struct.pack('<II', len(buf), 0x004E4942))
            f.write(bytes(buf))
        return total


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r))
