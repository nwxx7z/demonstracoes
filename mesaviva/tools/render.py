"""Renderizador por software (numpy) que lê um .glb e gera um poster PNG/WebP com
fundo transparente, sombra projetada e iluminação de estúdio.

Serve para conferir os modelos e para gerar as imagens dos cards do cardápio.
"""
import io
import json
import math
import struct
import sys

import numpy as np
from PIL import Image


def load_glb(path):
    data = open(path, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67 and ver == 2 and total == len(data), 'cabeçalho GLB inválido'
    jl, jt = struct.unpack_from('<II', data, 12)
    assert jt == 0x4E4F534A
    gltf = json.loads(data[20:20 + jl])
    bl, bt = struct.unpack_from('<II', data, 20 + jl)
    assert bt == 0x004E4942
    binbuf = data[28 + jl:28 + jl + bl]
    assert len(binbuf) == gltf['buffers'][0]['byteLength']
    CT = {5126: np.float32, 5123: np.uint16, 5125: np.uint32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}

    def acc(i):
        a = gltf['accessors'][i]
        v = gltf['bufferViews'][a['bufferView']]
        dt = CT[a['componentType']]
        n = a['count'] * NC[a['type']]
        arr = np.frombuffer(binbuf, dt, n, v.get('byteOffset', 0) + a.get('byteOffset', 0))
        assert v['byteOffset'] + v['byteLength'] <= len(binbuf)
        return arr.reshape(a['count'], NC[a['type']]) if NC[a['type']] > 1 else arr

    texcache = {}

    def tex(i):
        if i not in texcache:
            img = gltf['images'][gltf['textures'][i]['source']]
            v = gltf['bufferViews'][img['bufferView']]
            raw = binbuf[v['byteOffset']:v['byteOffset'] + v['byteLength']]
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            a = np.asarray(im, np.float32) / 255
            texcache[i] = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
        return texcache[i]

    prims = []
    for p in gltf['meshes'][0]['primitives']:
        m = gltf['materials'][p['material']]
        pbr = m['pbrMetallicRoughness']
        P = acc(p['attributes']['POSITION']).astype(np.float64)
        N = acc(p['attributes']['NORMAL']).astype(np.float64)
        UV = acc(p['attributes']['TEXCOORD_0']).astype(np.float64)
        I = acc(p['indices']).astype(np.int64).reshape(-1, 3)
        assert I.max() < len(P)
        a = gltf['accessors'][p['attributes']['POSITION']]
        assert np.allclose(a['min'], P.min(0), atol=1e-5) and np.allclose(a['max'], P.max(0), atol=1e-5)
        prims.append(dict(P=P, N=N, UV=UV, I=I, name=m['name'],
                          color=np.array(pbr.get('baseColorFactor', [1, 1, 1, 1]), float),
                          rough=pbr.get('roughnessFactor', 1.0), metal=pbr.get('metallicFactor', 1.0),
                          tex=tex(pbr['baseColorTexture']['index']) if 'baseColorTexture' in pbr else None,
                          blend=m.get('alphaMode') == 'BLEND'))
    return gltf, prims


def look_at(eye, target):
    f = target - eye
    f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    return np.stack([r, u, -f]), eye


def raster(tris_screen, W, H, zbuf, idbuf, bary, ids, persp_w=None):
    """tris_screen: (n,3,3) x,y,z (z menor = mais perto). Escreve no zbuf/ids/bary."""
    for k in range(len(tris_screen)):
        t = tris_screen[k]
        x0 = max(int(math.floor(t[:, 0].min())), 0)
        x1 = min(int(math.ceil(t[:, 0].max())), W - 1)
        y0 = max(int(math.floor(t[:, 1].min())), 0)
        y1 = min(int(math.ceil(t[:, 1].max())), H - 1)
        if x0 > x1 or y0 > y1:
            continue
        (ax, ay, az), (bx, by, bz), (cx, cy, cz) = t
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        xs = np.arange(x0, x1 + 1) + 0.5
        ys = np.arange(y0, y1 + 1) + 0.5
        X, Y = np.meshgrid(xs, ys)
        w0 = ((by - cy) * (X - cx) + (cx - bx) * (Y - cy)) / den
        w1 = ((cy - ay) * (X - cx) + (ax - cx) * (Y - cy)) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        if not inside.any():
            continue
        z = w0 * az + w1 * bz + w2 * cz
        sub = zbuf[y0:y1 + 1, x0:x1 + 1]
        m = inside & (z < sub)
        if not m.any():
            continue
        sub[m] = z[m]
        if idbuf is not None:
            idbuf[y0:y1 + 1, x0:x1 + 1][m] = ids[k]
            if persp_w is not None:
                iw = persp_w[k]
                b0, b1, b2 = w0 * iw[0], w1 * iw[1], w2 * iw[2]
                s = b0 + b1 + b2
                b0, b1, b2 = b0 / s, b1 / s, b2 / s
            else:
                b0, b1, b2 = w0, w1, w2
            bb = bary[y0:y1 + 1, x0:x1 + 1]
            bb[m, 0] = b0[m]
            bb[m, 1] = b1[m]
            bb[m, 2] = b2[m]


def sample(tex, uv):
    h, w, _ = tex.shape
    u = (uv[:, 0] % 1.0) * w - 0.5
    v = (uv[:, 1] % 1.0) * h - 0.5
    x0 = np.floor(u).astype(int)
    y0 = np.floor(v).astype(int)
    fx = (u - x0)[:, None]
    fy = (v - y0)[:, None]
    x0 %= w
    y0 %= h
    x1 = (x0 + 1) % w
    y1 = (y0 + 1) % h
    return (tex[y0, x0] * (1 - fx) * (1 - fy) + tex[y0, x1] * fx * (1 - fy)
            + tex[y1, x0] * (1 - fx) * fy + tex[y1, x1] * fx * fy)


def render(path, out, size=900, az=35, el=28, ss=2, fov=26, pad=1.12, shadow_alpha=0.42):
    gltf, prims = load_glb(path)
    allP = np.concatenate([p['P'] for p in prims])
    lo, hi = allP.min(0), allP.max(0)
    center = (lo + hi) / 2
    radius = np.linalg.norm(hi - lo) / 2
    W = H = size * ss
    dist = radius * pad / math.sin(math.radians(fov / 2))
    a, e = math.radians(az), math.radians(el)
    eye = center + dist * np.array([math.sin(a) * math.cos(e), math.sin(e), math.cos(a) * math.cos(e)])
    R, eyep = look_at(eye, center)
    fpx = (W / 2) / math.tan(math.radians(fov / 2))

    def project(P):
        V = (P - eyep) @ R.T
        zc = -V[:, 2]
        x = W / 2 + fpx * V[:, 0] / zc
        y = H / 2 - fpx * V[:, 1] / zc
        return np.stack([x, y, zc], -1)

    # luz principal (sombra) — ortográfica
    Ld = np.array([-0.45, 1.0, 0.55])
    Ld /= np.linalg.norm(Ld)
    LR, _ = look_at(center + Ld * radius * 4, center)
    SM = 1400
    span = radius * 2.6

    def lproj(P):
        V = (P - (center + Ld * radius * 4)) @ LR.T
        x = SM / 2 + V[:, 0] / span * SM
        y = SM / 2 - V[:, 1] / span * SM
        return np.stack([x, y, -V[:, 2]], -1)

    sz = np.full((SM, SM), np.inf)
    for p in prims:
        if p['blend']:
            continue
        S = lproj(p['P'])[p['I']]
        raster(S, SM, SM, sz, None, None, None)

    layers = []
    for blend_pass in (False, True):
        zb = np.full((H, W), np.inf)
        if blend_pass:
            zb[:] = opaque_z
        idb = np.full((H, W), -1, np.int64)
        bary = np.zeros((H, W, 3))
        tri_owner = []
        for pi, p in enumerate(prims):
            if p['blend'] != blend_pass:
                continue
            S = project(p['P'])
            T = S[p['I']]
            # culling de faces de trás (modelos são de face única por padrão)
            e1 = T[:, 1, :2] - T[:, 0, :2]
            e2 = T[:, 2, :2] - T[:, 0, :2]
            cr = e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]
            keep = (cr < 0) & (T[:, :, 2].min(1) > 0)
            idx = np.nonzero(keep)[0]
            base = len(tri_owner)
            tri_owner += [(pi, t) for t in idx]
            iw = 1.0 / T[idx, :, 2]
            raster(T[idx], W, H, zb, idb, bary, np.arange(base, base + len(idx)), iw)
        if not blend_pass:
            opaque_z = zb.copy()
        layers.append((idb, bary, tri_owner))

    def shade(idb, bary, tri_owner):
        mask = idb >= 0
        out = np.zeros((H, W, 4))
        if not mask.any():
            return out
        ids = idb[mask]
        bw = bary[mask]
        owner = np.array(tri_owner)
        pis = owner[ids, 0]
        tis = owner[ids, 1]
        col = np.zeros((len(ids), 3))
        alpha = np.ones(len(ids))
        Pw = np.zeros((len(ids), 3))
        Nw = np.zeros((len(ids), 3))
        rough = np.zeros(len(ids))
        for pi, p in enumerate(prims):
            sel = pis == pi
            if not sel.any():
                continue
            tri = p['I'][tis[sel]]
            b = bw[sel]
            Pw[sel] = (p['P'][tri] * b[:, :, None]).sum(1)
            n = (p['N'][tri] * b[:, :, None]).sum(1)
            Nw[sel] = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
            c = np.broadcast_to(p['color'][:3], (sel.sum(), 3)).copy()
            if p['tex'] is not None:
                uv = (p['UV'][tri] * b[:, :, None]).sum(1)
                c = c * sample(p['tex'], uv)
            col[sel] = c
            alpha[sel] = p['color'][3]
            rough[sel] = p['rough']
        Vd = eyep - Pw
        Vd /= np.linalg.norm(Vd, axis=1, keepdims=True)
        flipn = (Nw * Vd).sum(1) < 0
        Nw[flipn] *= -1
        # sombra
        Lp = lproj(Pw)
        lit = np.zeros(len(ids))
        bias = radius * 0.012
        for dx, dy in [(0, 0), (1.2, 0), (-1.2, 0), (0, 1.2), (0, -1.2), (0.9, 0.9), (-0.9, -0.9), (0.9, -0.9), (-0.9, 0.9)]:
            xi = np.clip((Lp[:, 0] + dx).astype(int), 0, SM - 1)
            yi = np.clip((Lp[:, 1] + dy).astype(int), 0, SM - 1)
            lit += (Lp[:, 2] - bias <= sz[yi, xi])
        lit /= 9
        ndl = np.clip((Nw @ Ld), 0, 1)
        fill = np.array([0.75, 0.35, -0.55])
        fill /= np.linalg.norm(fill)
        rim = np.array([0.2, 0.5, -1.0])
        rim /= np.linalg.norm(rim)
        hemi = 0.5 + 0.5 * Nw[:, 1]
        amb = (0.30 * hemi + 0.12 * (1 - hemi))[:, None] * np.array([1.0, 0.98, 0.96])
        diff = (ndl * lit)[:, None] * np.array([1.0, 0.95, 0.86]) * 1.25
        diff += np.clip(Nw @ fill, 0, 1)[:, None] * np.array([0.75, 0.82, 1.0]) * 0.28
        Hh = Ld + Vd
        Hh /= np.linalg.norm(Hh, axis=1, keepdims=True)
        r = np.clip(rough, 0.05, 1)
        shin = np.clip(2 / r ** 4 - 2, 2, 4000)
        f0 = 0.04
        fres = f0 + (1 - f0) * (1 - np.clip((Nw * Vd).sum(1), 0, 1)) ** 5
        spec = ((np.clip((Nw * Hh).sum(1), 0, 1) ** shin) * (shin + 8) / (8 * math.pi)) * fres * lit * 0.9
        Hr = rim + Vd
        Hr /= np.linalg.norm(Hr, axis=1, keepdims=True)
        spec += ((np.clip((Nw * Hr).sum(1), 0, 1) ** shin) * (shin + 8) / (8 * math.pi)) * fres * 0.35
        spec = np.minimum(spec, 6)
        c = col * (amb + diff) + spec[:, None]
        a = alpha.copy()
        blend = alpha < 1
        a[blend] = np.clip(alpha[blend] + fres[blend] * 0.6 + spec[blend] * 0.2, 0, 1)
        out[mask, :3] = c
        out[mask, 3] = a
        return out

    base = shade(*layers[0])
    glass = shade(*layers[1])
    # sombra no chão (y = mínimo do modelo)
    gy = lo[1]
    ys, xs = np.mgrid[0:H, 0:W] + 0.5
    dirs = np.stack([(xs - W / 2) / fpx, -(ys - H / 2) / fpx, -np.ones_like(xs)], -1) @ R
    t = (gy - eyep[1]) / np.where(np.abs(dirs[..., 1]) < 1e-9, -1e-9, dirs[..., 1])
    G = eyep + dirs * t[..., None]
    Gp = lproj(G.reshape(-1, 3))
    sh = np.zeros(len(Gp))
    for dx, dy in [(0, 0), (3, 0), (-3, 0), (0, 3), (0, -3), (2, 2), (-2, -2), (2, -2), (-2, 2)]:
        xi = np.clip((Gp[:, 0] + dx).astype(int), 0, SM - 1)
        yi = np.clip((Gp[:, 1] + dy).astype(int), 0, SM - 1)
        sh += (Gp[:, 2] - radius * 0.01 > sz[yi, xi])
    sh = (sh / 9).reshape(H, W) * (t > 0)
    dist_c = np.linalg.norm((G - center)[..., [0, 2]], axis=-1) / radius
    contact = np.clip(1 - dist_c / 0.95, 0, 1) ** 2 * 0.35
    ground_a = np.clip(sh * shadow_alpha * np.clip(1.6 - dist_c, 0, 1) + contact, 0, 0.6)
    ground_a = np.asarray(Image.fromarray((ground_a * 255).astype(np.uint8)).filter(
        __import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(ss * 3)), float) / 255

    def tonemap(c):
        c = np.clip(c * 1.05, 0, None)
        a_, b_, c_, d_, e_ = 2.51, 0.03, 2.43, 0.59, 0.14
        m = np.clip((c * (a_ * c + b_)) / (c * (c_ * c + d_) + e_), 0, 1)
        return np.where(m <= 0.0031308, m * 12.92, 1.055 * m ** (1 / 2.4) - 0.055)

    rgb = np.zeros((H, W, 3))
    A = ground_a.copy()
    obj = base[..., 3] > 0
    rgb[obj] = tonemap(base[obj, :3])
    A[obj] = 1
    ga = glass[..., 3]
    gm = ga > 0
    rgb[gm] = tonemap(glass[gm, :3]) * ga[gm, None] + rgb[gm] * (1 - ga[gm, None]) * (A[gm, None] > 0)
    rgb[gm & ~obj] = tonemap(glass[gm & ~obj, :3])
    A[gm] = np.maximum(A[gm], ga[gm])
    img = np.concatenate([rgb, A[..., None]], -1)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), 'RGBA')
    if ss > 1:
        im = im.resize((size, size), Image.LANCZOS)
    if out.endswith('.webp'):
        im.save(out, 'WEBP', quality=86, method=6)
    else:
        im.save(out)
    return im


if __name__ == '__main__':
    render(sys.argv[1], sys.argv[2], size=int(sys.argv[3]) if len(sys.argv) > 3 else 700)
