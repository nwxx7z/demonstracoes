#!/usr/bin/env python3
"""Gera os modelos 3D (GLB) do cardápio Mesa Viva, em tamanho real (metros).

Uso:  python3 build_models.py [nome ...]      (sem argumentos gera todos)
Saída: ../models/<nome>.glb e ../img/<nome>.webp (poster renderizado)
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from geo import (TAU, Geo, Material, Noise3, Scene, disc, ellipsoid, fbm2, fbm3, gradient_rows, lathe,
                 merge, rot_to, rot_x, rot_y, rot_z, smoothstep, spline, srgb, surface, to_image, tube, box)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_MODELS = os.path.join(HERE, '..', 'models')
OUT_IMG = os.path.join(HERE, '..', 'img')


# ============================================================ texturas
def tex_wood(seed=1, light='#b98654', dark='#7a4e2c', S=512):
    h = w = S
    n = fbm2(h, w, seed, cells=(3, 6, 12, 24))
    fine = fbm2(h, w, seed + 5, cells=(64, 128))
    ys = np.linspace(0, 1, h)[:, None]
    rings = np.sin((ys * 17 + n * 0.8) * TAU) * 0.5 + 0.5
    rings = rings ** 3
    streak = fbm2(h, w, seed + 9, cells=(2, 128))
    t = np.clip(rings * 0.55 + streak * 0.35 + fine * 0.25 - 0.1, 0, 1)
    c = srgb(light)[None, None] * (1 - t[..., None]) + srgb(dark)[None, None] * t[..., None]
    c *= (0.92 + 0.16 * fine)[..., None]
    return to_image(c)


def noisy(base, seed, amp=0.18, cells=(8, 16, 32, 64, 128)):
    h, w, _ = base.shape
    n = fbm2(h, w, seed, cells=cells)
    return base * (1 + amp * (n - 0.5) * 2)[..., None]


def speckle(img, seed, density, color, size=1, jitter=0.25):
    h, w, _ = img.shape
    r = np.random.default_rng(seed)
    cnt = int(h * w * density)
    ys = r.integers(0, h, cnt)
    xs = r.integers(0, w, cnt)
    c = srgb(color)
    for dy in range(size):
        for dx in range(size):
            yy = (ys + dy) % h
            xx = (xs + dx) % w
            img[yy, xx] = c * (1 - jitter / 2 + jitter * r.random((cnt, 1)))
    return img


def blotches(img, seed, color, thresh, cells=(10, 20, 40), soft=0.06, mask=None):
    h, w, _ = img.shape
    n = fbm2(h, w, seed, cells=cells)
    t = smoothstep(thresh, thresh + soft, n)
    if mask is not None:
        t = t * mask
    return img * (1 - t[..., None]) + srgb(color)[None, None] * t[..., None]


def vmask(h, w, a, b, fade=0.03):
    v = np.linspace(0, 1, h)[:, None]
    m = smoothstep(a - fade, a + fade, v) * (1 - smoothstep(b - fade, b + fade, v))
    return np.repeat(m, w, 1)


def arc_fracs(prof, n_per):
    """Fração do comprimento de arco em cada ponto de controle de um perfil gerado por spline()."""
    prof = np.asarray(prof, float)
    L = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(prof, axis=0), axis=1))])
    L /= L[-1]
    return L[::n_per]


# ============================================================ peças comuns
def wood_board(scene, R, thick, seed=1, name='madeira', handle=False):
    mat = Material(name, rough=0.62, tex=tex_wood(seed))
    prof = [(R - 0.006, 0), (R - 0.002, 0.0015), (R, 0.005), (R, thick - 0.005), (R - 0.002, thick - 0.0015),
            (R - 0.006, thick)]
    side = lathe(spline(prof, 3), seg=80, u_rep=4)
    top = disc(R - 0.006, thick, seg=80, rings=4, up=True, uv_radius=R * 0.9)
    bot = disc(R - 0.006, 0.0, seg=80, rings=1, up=False, uv_radius=R * 0.9)
    g = merge([side, top, bot])
    if handle:
        L = R * 0.55
        hb = box(L, thick, 0.045)
        hb.UV = hb.UV * 0.4
        hb.move(R + L / 2 - 0.01, 0, 0)
        # alça arredondada: furo simulado não; ponta arredondada com disco
        tip = lathe(spline([(0, 0), (0.0225, 0), (0.0225, thick), (0, thick)], 2), seg=48)
        tip.move(R + L - 0.01, 0, 0)
        scene.add(mat, hb)
        scene.add(mat, tip)
    scene.add(mat, g)
    return thick


def ceramic_plate(scene, R, name='prato', color='#f6f4ef', seed=3, rim_h=0.016):
    mat = Material(name, color=color, rough=0.18)
    prof = spline([
        (0.0, 0.0005), (R * 0.42, 0.0005), (R * 0.45, 0.0), (R * 0.5, 0.0005), (R * 0.56, 0.004), (R * 0.60, 0.006),
        (R * 0.85, rim_h * 0.7), (R * 0.98, rim_h), (R, rim_h + 0.0025), (R * 0.985, rim_h + 0.004),
        (R * 0.86, rim_h * 0.7 + 0.0042), (R * 0.6, 0.0103), (R * 0.56, 0.0085), (R * 0.3, 0.0085), (0.0, 0.0085)
    ], 6)
    # percorre por baixo (de dentro p/ fora), sobe pela borda e volta por cima: normais para fora
    g = lathe(prof, seg=80)
    scene.add(mat, g)
    return 0.0085


def scatter_on(fn_surface, count, seed, rmin, rmax, avoid=None):
    r = np.random.default_rng(seed)
    pts = []
    tries = 0
    while len(pts) < count and tries < count * 200:
        tries += 1
        rad = math.sqrt(r.uniform(rmin ** 2, rmax ** 2))
        th = r.uniform(0, TAU)
        p = (rad * math.cos(th), rad * math.sin(th))
        if avoid and any((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 < avoid ** 2 for q in pts):
            continue
        pts.append(p)
    return pts


def leaf(length, width, fold=0.25, curl=0.15, seed=0, tip_curve=0.0):
    """Folha (manjericão/hortelã), comprimento no eixo X, base na origem."""
    def fn(U, V):
        s = V
        wv = width * np.sin(np.pi * np.clip(s, 0, 1)) ** 0.75 * (1 - 0.25 * s)
        x = s * length
        z = (U - 0.5) * 2 * wv
        y = fold * np.abs(z) * 1.2 + curl * length * (s - 0.35) ** 2 - curl * length * 0.12
        z = z + tip_curve * length * s ** 2
        return x, y, z
    g = surface(fn, 9, 18, hint=(0, 1, 0))
    return g


def tex_leaf(dark, light, seed, S=256):
    h = w = S
    u = np.linspace(0, 1, w)[None, :]
    v = np.linspace(0, 1, h)[:, None]
    base = gradient_rows(h, w, [(0, light), (0.3, dark), (1, dark)])
    mid = np.exp(-((u - 0.5) / 0.025) ** 2)
    veins = np.exp(-((np.abs(u - 0.5) * 1.6 - (v * 0.9 - np.floor(v * 5) / 5 * 0.9) * 0.0 - ((v * 5) % 1) * 0.35) / 0.03) ** 2)
    veins *= (np.abs(u - 0.5) > 0.03)
    c = base * (1 + 0.35 * mid[..., None] + 0.12 * veins[..., None])
    c = noisy(c, seed, 0.08)
    return to_image(c)


# ============================================================ HAMBÚRGUER
def burger():
    sc = Scene('smash-duplo')
    y = wood_board(sc, 0.105, 0.02, seed=11)
    y += 0.0005

    # --- pão de baixo
    Rb = 0.056
    hb = 0.02
    prof = spline([(0.0, y), (Rb - 0.006, y), (Rb - 0.0015, y + 0.002), (Rb, y + 0.008), (Rb - 0.001, y + 0.014),
                   (Rb - 0.004, y + hb - 0.001), (Rb - 0.008, y + hb), (0.0, y + hb)], 6)
    f = arc_fracs(prof, 6)  # 0 eixo, 1 borda inf., 3 meio, 5 borda sup., 7 eixo topo
    H, W = 512, 256
    t = gradient_rows(H, W, [(0, '#a8662a'), (f[1], '#b8742f'), (f[2], '#c27d36'), (f[3], '#cd8c41'),
                             (f[4], '#d79b4d'), (f[5] - 0.02, '#e0ad66'), (f[5] + 0.03, '#f1dfb0'), (1, '#f4e5bf')])
    t = noisy(t, 21, 0.10)
    t = speckle(t, 22, 0.02, '#c9a46a', 1)
    bun_b = Material('pao-base', rough=0.7, tex=to_image(t))
    g = lathe(prof, seg=72)
    g.displace(lambda P: 0.0006 * Noise3(5, 160)(P))
    sc.add(bun_b, g)
    y += hb

    # --- carnes + cheddar
    patty_tex = np.zeros((256, 256, 3)) + srgb('#6e3d20')
    patty_tex = noisy(patty_tex, 31, 0.35, cells=(8, 16, 32, 64, 128))
    patty_tex = blotches(patty_tex, 32, '#3a1d0d', 0.64, cells=(16, 32, 64))
    patty_tex = blotches(patty_tex, 33, '#9a6237', 0.6, cells=(24, 48, 96))
    patty_tex = speckle(patty_tex, 34, 0.03, '#1c0e07', 1)
    patty = Material('carne', rough=0.55, tex=to_image(patty_tex))
    cheese = Material('cheddar', color='#f7a81b', rough=0.26)
    for k in range(2):
        Rp = 0.0585 + 0.001 * k
        hp = 0.0125
        prof = spline([(0.0, y), (Rp - 0.006, y), (Rp - 0.001, y + 0.002), (Rp + 0.0005, y + hp * 0.5),
                       (Rp - 0.001, y + hp - 0.002), (Rp - 0.006, y + hp), (0.0, y + hp)], 6)
        g = lathe(prof, seg=80, u_rep=3)
        n1 = Noise3(40 + k, 55)
        n2 = Noise3(50 + k, 260)

        def rad(P, n1=n1, n2=n2):
            return 0.0025 * n1(P) + 0.0007 * n2(P)
        r = np.linalg.norm(g.P[:, [0, 2]], axis=1)
        outward = np.zeros_like(g.P)
        outward[:, 0] = g.P[:, 0] / np.maximum(r, 1e-9)
        outward[:, 2] = g.P[:, 2] / np.maximum(r, 1e-9)
        g.P += outward * (rad(g.P) * np.clip(r / Rp, 0, 1) ** 3)[:, None]
        g.normals()
        g.displace(lambda P, n2=n2: 0.0004 * n2(P))
        sc.add(patty, g)
        y += hp
        # cheddar derretido escorrendo
        s = 0.098
        ang = 0.3 + k * 0.9
        nd = Noise3(60 + k, 70)

        def cfn(U, V, s=s, ang=ang, y0=y, nd=nd, Rp=Rp):
            x = (U - 0.5) * s
            z = (V - 0.5) * s
            xr = x * math.cos(ang) - z * math.sin(ang)
            zr = x * math.sin(ang) + z * math.cos(ang)
            r = np.sqrt(xr ** 2 + zr ** 2)
            edge = Rp - 0.003
            over = np.clip(r - edge, 0, None)
            P = np.stack([xr, np.zeros_like(xr), zr], -1)
            drip = 1 + 1.1 * np.clip(nd(P.reshape(-1, 3)).reshape(xr.shape), 0, None)
            rn = np.minimum(r, edge) + over * 0.3 + 0.0048 * smoothstep(0, 0.003, over)
            yy = y0 + 0.0012 - over * 0.95 * drip
            k = rn / np.maximum(r, 1e-9)
            return xr * k, yy, zr * k
        cg = surface(cfn, 32, 32)
        sc.add(cheese, cg.normals().double())
        y += 0.0018

    # --- alface
    lt = tex_lettuce()
    lettuce = Material('alface', rough=0.45, tex=lt)
    nl = Noise3(70, 40)

    def lfn(U, V, y0=y):
        th = U * TAU
        r = 0.030 + V * (0.033 + 0.006 * np.sin(th * 5 + 0.7))
        ruff = (0.004 + 0.003 * np.sin(th * 3 + 1)) * np.sin(th * 17 + 2.2 * np.sin(th * 3)) * V ** 1.3 + 0.0015 * np.sin(th * 41) * V ** 2
        x, z = r * np.cos(th), r * np.sin(th)
        P = np.stack([x, np.zeros_like(x), z], -1).reshape(-1, 3)
        wob = nl(P).reshape(x.shape) * 0.002 * V
        yy = y0 + 0.001 + ruff + wob - 0.006 * np.clip(V - 0.6, 0, None) ** 2 * 6
        return x, yy, z
    lg = surface(lfn, 170, 9)
    sc.add(lettuce, lg.normals().double())
    y += 0.0045

    # --- tomate
    tom_top = Material('tomate', rough=0.22, tex=tex_tomato())
    tom_side = Material('tomate-casca', color='#c8261a', rough=0.25)
    for (cx, cz, a) in [(-0.018, 0.012, 0.3), (0.02, -0.006, 1.7), (0.0, -0.026, 2.6)]:
        rt = 0.030
        ht = 0.0055
        side = lathe([(rt, 0), (rt, ht)], seg=64)
        top = disc(rt, ht, seg=64, rings=8, up=True)
        bottom = disc(rt, 0, seg=64, rings=2, up=False)
        for gg, m in ((side, tom_side), (top, tom_top), (bottom, tom_side)):
            gg.apply(rot_y(a)).move(cx, y, cz)
            sc.add(m, gg)
    y += 0.0055

    # --- pão de cima com gergelim
    Rt = 0.0575
    Ht = 0.042
    pts = [(0.0, y), (Rt - 0.008, y), (Rt - 0.002, y + 0.0025)]
    for tt in np.linspace(0.0, 1.0, 14):
        a = tt * math.pi / 2
        pts.append((Rt * math.cos(a) ** 0.62, y + 0.006 + (Ht - 0.006) * math.sin(a) ** 0.85))
    pts[-1] = (0.0, y + Ht)
    prof = spline(pts, 5)
    f = arc_fracs(prof, 5)  # f[1] borda inferior, f[3] início do domo
    H, W = 512, 256
    t = gradient_rows(H, W, [(0, '#f1dcab'), (f[1] - 0.02, '#ecd29a'), (f[2], '#d9a050'), (f[4], '#c98432'),
                             (f[8], '#b2661f'), (1, '#9c5419')])
    t = noisy(t, 81, 0.12)
    t = blotches(t, 82, '#8f4914', 0.76, cells=(12, 24, 48), mask=vmask(H, W, f[6], 1.05))
    top_tex = to_image(t)
    bun_t = Material('pao-topo', rough=0.38, tex=top_tex)
    g = lathe(prof, seg=84)
    g.displace(lambda P: 0.0008 * Noise3(85, 90)(P) + 0.0003 * Noise3(86, 300)(P))
    g.normals()
    sc.add(bun_t, g)
    # gergelim
    seed_m = Material('gergelim', color='#f2e6c2', rough=0.45)
    r = np.random.default_rng(90)
    seeds = []
    # amostra pontos da superfície do domo
    Pdome = g.P[(g.P[:, 1] > y + 0.012)]
    Ndome = g.N[(g.P[:, 1] > y + 0.012)]
    chosen = []
    idx = r.permutation(len(Pdome))
    for i in idx:
        p = Pdome[i]
        if all(np.sum((p - q) ** 2) > 0.0072 ** 2 for q in chosen):
            chosen.append(p)
            e = ellipsoid(0.0016, 0.0006, 0.0028, seg=7, rings=4)
            e.apply(rot_to(Ndome[i], r.uniform(0, TAU)), p + Ndome[i] * 0.0003)
            seeds.append(e)
        if len(chosen) >= 70:
            break
    sc.add(seed_m, merge(seeds).normals())
    return sc


def tex_lettuce(S=256):
    h, w = S, 512
    base = gradient_rows(h, w, [(0, '#dfe9a6'), (0.35, '#a9cc62'), (1, '#6aa03a')])
    u = np.linspace(0, 1, w)[None, :]
    veins = (np.abs(((u * 22) % 1) - 0.5) < 0.05).astype(float)
    v = np.linspace(0, 1, h)[:, None]
    c = base * (1 + (0.22 * veins * (1 - v * 0.7))[..., None])
    c = noisy(c, 77, 0.12)
    return to_image(c)


def tex_tomato(S=256):
    ys, xs = np.mgrid[0:S, 0:S] / (S - 1) * 2 - 1
    r = np.sqrt(xs ** 2 + ys ** 2)
    th = np.arctan2(ys, xs)
    c = np.zeros((S, S, 3)) + srgb('#e2412a')
    lob = (np.cos(th * 5) * 0.5 + 0.5)
    chamber = (r > 0.28) & (r < 0.78) & (lob > 0.35)
    gel = smoothstep(0.35, 0.6, lob) * smoothstep(0.26, 0.36, r) * (1 - smoothstep(0.7, 0.8, r))
    c = c * (1 - gel[..., None]) + srgb('#f08a63')[None, None] * gel[..., None]
    core = 1 - smoothstep(0.18, 0.3, r)
    c = c * (1 - core[..., None] * 0.6) + srgb('#f3b08f')[None, None] * core[..., None] * 0.6
    skin = smoothstep(0.88, 0.95, r)
    c = c * (1 - skin[..., None]) + srgb('#b81d12')[None, None] * skin[..., None]
    rng = np.random.default_rng(3)
    for k in range(5):
        a = k / 5 * TAU
        for j in range(6):
            rr = rng.uniform(0.42, 0.66)
            aa = a + rng.uniform(-0.25, 0.25)
            cx, cy = rr * math.cos(aa), rr * math.sin(aa)
            m = ((xs - cx) ** 2 / 0.0011 + (ys - cy) ** 2 / 0.0011) < 1
            c[m] = srgb('#f6dd8c')
    c = noisy(c, 4, 0.08)
    return to_image(c)


# ============================================================ PIZZA
def pizza():
    sc = Scene('pizza-margherita')
    y = wood_board(sc, 0.185, 0.018, seed=12, handle=True)
    Rz = 0.165
    nC = Noise3(100, 30)
    nC2 = Noise3(101, 110)
    prof = spline([(0.0, y), (Rz - 0.012, y), (Rz - 0.003, y + 0.002), (Rz, y + 0.009), (Rz - 0.003, y + 0.017),
                   (Rz - 0.011, y + 0.02), (Rz - 0.019, y + 0.015), (Rz - 0.025, y + 0.0075),
                   (Rz - 0.04, y + 0.006), (0.0, y + 0.0065)], 6)
    f = arc_fracs(prof, 6)
    H, W = 512, 512
    t = gradient_rows(H, W, [(0, '#e6c895'), (f[1] - 0.02, '#dcb57a'), (f[2], '#cf9a55'), (f[3], '#c8893f'),
                             (f[4], '#d39a4f'), (f[5], '#c98a43'), (f[6], '#dcae6a'), (f[7] - 0.004, '#e0b370'),
                             (f[7] + 0.012, '#a8251a'), (f[8], '#b02716'), (1, '#b8301b')])
    t = noisy(t, 102, 0.12)
    crust_m = vmask(H, W, f[1] + 0.01, f[7], 0.01)
    t = blotches(t, 103, '#3b1d0b', 0.72, cells=(24, 48, 96), soft=0.05, mask=crust_m)
    t = blotches(t, 104, '#9a5a24', 0.58, cells=(10, 20, 40), soft=0.1, mask=crust_m)
    sauce_m = vmask(H, W, f[7] + 0.01, 1.1, 0.01)
    t = blotches(t, 105, '#cf4026', 0.62, cells=(16, 32, 64), soft=0.08, mask=sauce_m)
    t = blotches(t, 106, '#8f1f10', 0.66, cells=(16, 32, 64), soft=0.08, mask=sauce_m)
    dough = Material('massa-molho', rough=0.5, tex=to_image(t))
    g = lathe(prof, seg=128, u_rep=2)
    r = np.linalg.norm(g.P[:, [0, 2]], axis=1)
    rim = smoothstep(Rz - 0.04, Rz - 0.02, r)
    g.P[:, 1] += (0.003 * nC(g.P) + 0.0012 * nC2(g.P)) * rim * (g.P[:, 1] > y + 0.004)
    out = np.zeros_like(g.P)
    out[:, 0] = g.P[:, 0] / np.maximum(r, 1e-9)
    out[:, 2] = g.P[:, 2] / np.maximum(r, 1e-9)
    g.P += out * (0.0035 * nC(g.P * 0.7))[:, None] * rim[:, None]
    g.normals()
    g.displace(lambda P: 0.00035 * Noise3(107, 400)(P) * (np.linalg.norm(P[:, [0, 2]], axis=1) < Rz - 0.03))
    sc.add(dough, g)
    ytop = y + 0.0065
    # mussarela de búfala
    mt = np.zeros((128, 256, 3)) + srgb('#f7f0dc')
    mt = blotches(mt, 110, '#e9c88a', 0.66, cells=(6, 12, 24), soft=0.1)
    mt = blotches(mt, 111, '#d29a52', 0.74, cells=(8, 16, 32), soft=0.06)
    mozz = Material('mussarela', rough=0.42, tex=to_image(noisy(mt, 112, 0.05)))
    pts = scatter_on(None, 12, 7, 0.0, Rz - 0.05, avoid=0.058)
    rng = np.random.default_rng(8)
    blobs = []
    for (x, z) in pts:
        a = rng.uniform(0.022, 0.03)
        e = ellipsoid(a, 0.006, a * rng.uniform(0.75, 1.0), seg=28, rings=10)
        e.apply(rot_y(rng.uniform(0, TAU)))
        nb = Noise3(int(rng.integers(1e6)), 90)
        e.P[:, 0] *= 1 + 0.18 * nb(e.P * 0.5)
        e.P[:, 2] *= 1 + 0.18 * nb(e.P * 0.5 + 3)
        e.P[:, 1] = np.where(e.P[:, 1] < 0, e.P[:, 1] * 0.2, e.P[:, 1] * (0.6 + 0.2 * nb(e.P)))
        e.move(x, ytop + 0.0005, z)
        blobs.append(e)
    sc.add(mozz, merge(blobs).normals())
    # manjericão
    basil = Material('manjericao', rough=0.32, tex=tex_leaf('#2c6a1f', '#4f9a35', 120))
    leaves = []
    lp = scatter_on(None, 9, 15, 0.01, Rz - 0.05, avoid=0.045)
    for i, (x, z) in enumerate(lp):
        L = rng.uniform(0.04, 0.055)
        lf = leaf(L, L * 0.36, fold=0.3, curl=0.22)
        lf.apply(rot_y(rng.uniform(0, TAU)))
        lf.move(x, ytop + 0.0075 + rng.uniform(0, 0.002), z)
        leaves.append(lf)
    sc.add(basil, merge(leaves).normals().double())
    # azeite (brilhos)
    oil = Material('azeite', color='#c9a227', rough=0.08, alpha=0.55)
    drops = []
    for (x, z) in scatter_on(None, 26, 33, 0.01, Rz - 0.04, avoid=0.02):
        d = ellipsoid(rng.uniform(0.002, 0.004), 0.0007, rng.uniform(0.002, 0.004), seg=12, rings=6)
        d.move(x, ytop + 0.0004, z)
        drops.append(d)
    sc.add(oil, merge(drops).normals())
    return sc


# ============================================================ BATATA FRITA
def tex_carton(W=1024, H=256):
    c = np.zeros((H, W, 3)) + srgb('#d32a22')
    u = np.linspace(0, 1, W)[None, :]
    v = np.linspace(0, 1, H)[:, None]
    wave = 0.62 + 0.06 * np.sin(u * TAU * 4)
    band = (v > wave) & (v < wave + 0.12)
    c[band] = srgb('#fff6e8')
    c = noisy(c, 200, 0.05)
    im = to_image(c)
    d = ImageDraw.Draw(im)
    try:
        f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 54)
    except OSError:
        f = ImageFont.load_default()
    for cx in (0.175 * W, 0.675 * W):
        d.text((cx, H * 0.36), 'MESA VIVA', fill=(255, 246, 232), font=f, anchor='mm')
    return im


def fries():
    sc = Scene('batata-frita')
    rng = np.random.default_rng(300)
    # caixinha (carton) aberta
    carton = Material('caixa', rough=0.55, tex=tex_carton())
    inside = Material('caixa-dentro', color='#f4ead8', rough=0.8)
    bw, bd = 0.072, 0.036   # base
    tw, td = 0.096, 0.052   # topo
    Hc = 0.088

    def wall(p0, p1, q0, q1, arch, u0, u1):
        def fn(U, V):
            b = p0[None, None] * (1 - U[..., None]) + p1[None, None] * U[..., None]
            t = q0[None, None] * (1 - U[..., None]) + q1[None, None] * U[..., None]
            tt = t.copy()
            tt[..., 1] += arch * (1 - (2 * U - 1) ** 2)
            P = b * (1 - V[..., None]) + tt * V[..., None]
            return P[..., 0], P[..., 1], P[..., 2]
        g = surface(fn, 24, 12, hint=(0, 0, 0))
        g.UV[:, 0] = u0 + g.UV[:, 0] * (u1 - u0)
        g.UV[:, 1] = 1 - g.UV[:, 1]
        return g

    B = [np.array(p, float) for p in [(-bw / 2, 0, bd / 2), (bw / 2, 0, bd / 2), (bw / 2, 0, -bd / 2), (-bw / 2, 0, -bd / 2)]]
    T = [np.array(p, float) for p in [(-tw / 2, Hc, td / 2), (tw / 2, Hc, td / 2), (tw / 2, Hc, -td / 2), (-tw / 2, Hc, -td / 2)]]
    walls = []
    arches = [0.016, -0.004, 0.016, -0.004]
    us = [(0, 0.35), (0.35, 0.5), (0.5, 0.85), (0.85, 1.0)]
    for k in range(4):
        j = (k + 1) % 4
        g = wall(B[k], B[j], T[k], T[j], arches[k], *us[k])
        mid = (B[k] + B[j] + T[k] + T[j]) / 4
        outward = np.array([mid[0], 0, mid[2]])
        g.orient(outward)
        walls.append(g)
    outer = merge(walls).normals(weld=False)
    sc.add(carton, outer)
    inner = merge([w.copy() for w in walls]).normals(weld=False)
    inner.flip()
    sc.add(inside, inner)
    base = Geo([B[0], B[1], B[2], B[3]], [[0, 1, 2], [0, 2, 3]], [[0, 0], [1, 0], [1, 1], [0, 1]])
    base.orient((0, 1, 0)).move(0, 0.002, 0)
    sc.add(inside, base.normals())
    # palitos de batata
    ft = np.zeros((256, 64, 3))
    ft[:] = gradient_rows(256, 64, [(0, '#b9782a'), (0.08, '#e3ad4c'), (0.5, '#f0c766'), (0.92, '#e3ad4c'), (1, '#b9782a')])
    ft = noisy(ft, 301, 0.12)
    ft = speckle(ft, 302, 0.01, '#c88a35', 2)
    fry_m = Material('batata', rough=0.5, tex=to_image(ft))
    sticks = []
    placed = 0
    while placed < 58:
        x = rng.uniform(-0.03, 0.03)
        z = rng.uniform(-0.013, 0.013)
        L = rng.uniform(0.075, 0.11)
        s = rng.uniform(0.0075, 0.0095)
        b = box(s, L, s)
        b.UV[:, 1] = np.where(b.P[:, 1] > L / 2, 1.0, 0.0)
        b.UV[:, 0] = rng.random()
        bend = rng.uniform(-0.12, 0.12)
        b.P[:, 0] += bend * (b.P[:, 1] / L) ** 2 * 0.02
        tilt_x = rng.uniform(-0.12, 0.12) + x * 4.0
        tilt_z = rng.uniform(-0.1, 0.1) - z * 4.0
        b.apply(rot_y(rng.uniform(0, TAU)))
        b.apply(rot_z(-tilt_x * 0.9) @ rot_x(tilt_z))
        b.move(x, 0.004 + rng.uniform(0, 0.03), z)
        sticks.append(b)
        placed += 1
    sc.add(fry_m, merge(sticks))
    # potinho de ketchup
    pot = Material('potinho', color='#fbfaf6', rough=0.2)
    kp = Material('ketchup', color='#a3140c', rough=0.12)
    pr = 0.026
    prof = spline([(0, 0), (pr - 0.004, 0), (pr - 0.001, 0.002), (pr, 0.02), (pr - 0.002, 0.022),
                   (pr - 0.003, 0.02), (pr - 0.004, 0.004), (0, 0.004)], 5)
    pg = lathe(prof, seg=64).move(0.085, 0, 0.03)
    sc.add(pot, pg)
    kt = disc(pr - 0.0032, 0.0165, seg=64, rings=6, up=True)
    kt.normals()
    kt.displace(lambda P: 0.0015 * np.exp(-((P[:, 0] - 0.0) ** 2 + P[:, 2] ** 2) / 0.00012), along=(0, 1, 0))
    kt.move(0.085, 0, 0.03)
    sc.add(kp, kt)
    return sc


# ============================================================ AÇAÍ
def acai():
    sc = Scene('acai-tigela')
    rng = np.random.default_rng(400)
    bowl_m = Material('tigela', rough=0.32, tex=tex_bowl())
    Rb = 0.078
    Hb = 0.066
    pts = [(0.0, 0.0), (0.034, 0.0), (0.036, 0.003), (0.035, 0.007)]
    for tt in np.linspace(0, 1, 10):
        a = tt * math.pi / 2
        pts.append((0.035 + (Rb - 0.035) * math.sin(a) ** 0.9, 0.007 + (Hb - 0.007) * (1 - math.cos(a)) ** 1.0))
    pts += [(Rb + 0.0005, Hb + 0.002), (Rb - 0.003, Hb + 0.0025), (Rb - 0.006, Hb - 0.006)]
    for tt in np.linspace(0, 1, 8)[1:]:
        a = tt * math.pi / 2
        pts.append(((Rb - 0.006) * math.cos(a) ** 0.6, Hb - 0.006 - (Hb - 0.016) * math.sin(a) ** 1.4))
    pts[-1] = (0.0, 0.012)
    bowl = lathe(spline(pts, 3), seg=80)
    sc.add(bowl_m, bowl)
    # creme de açaí
    ys = Hb - 0.007
    Ra = Rb - 0.0065
    na = fbm3(410, 60)

    def surf_h(x, z):
        r = np.sqrt(x ** 2 + z ** 2)
        P = np.stack([x, np.zeros_like(x), z], -1).reshape(-1, 3)
        return ys + 0.013 * (1 - (r / Ra) ** 2) + 0.0018 * na(P).reshape(np.shape(x))
    def afn(U, V):
        th = U * TAU
        r = V * Ra
        x, z = r * np.cos(th), r * np.sin(th)
        return x, surf_h(x, z), z
    ag = surface(afn, 110, 26)
    at = np.zeros((256, 256, 3)) + srgb('#3d0f37')
    at = noisy(at, 411, 0.3, cells=(6, 12, 24, 48))
    at = blotches(at, 412, '#5b1c4f', 0.62, cells=(8, 16, 32), soft=0.12)
    acai_m = Material('acai', rough=0.38, tex=to_image(at))
    ag.UV = ag.UV * np.array([4, 1])
    sc.add(acai_m, ag)

    def place(x, z):
        return float(surf_h(np.array(x), np.array(z)))
    # banana em rodelas (lado esquerdo)
    bt = tex_banana()
    ban = Material('banana', rough=0.45, tex=bt)
    ban_side = Material('banana-borda', color='#efdca2', rough=0.5)
    for k in range(6):
        a = 2.2 + k * 0.32
        rr = 0.03 + (k % 2) * 0.016
        x, z = rr * math.cos(a), rr * math.sin(a)
        rad = 0.0145
        side = lathe([(rad, 0), (rad, 0.005)], seg=40)
        top = disc(rad, 0.005, seg=40, rings=6, up=True)
        tilt = rot_x(rng.uniform(-0.35, 0.35)) @ rot_z(rng.uniform(-0.35, 0.35))
        yy = place(x, z) - 0.001
        for gg, m in ((side, ban_side), (top, ban)):
            gg.apply(tilt).move(x, yy, z)
            sc.add(m, gg)
    # morangos
    st_m = Material('morango', rough=0.25, tex=tex_strawberry())
    cal_m = Material('folhinha', color='#3f8a2a', rough=0.5)
    for k, (a, rr) in enumerate([(5.2, 0.03), (5.75, 0.045), (4.65, 0.044)]):
        x, z = rr * math.cos(a), rr * math.sin(a)
        sg = strawberry(0.0175 + 0.002 * k)
        cal = calyx(0.014)
        M = rot_z(rng.uniform(1.1, 1.5)) @ rot_y(rng.uniform(0, TAU))
        M = rot_y(rng.uniform(0, TAU)) @ rot_x(rng.uniform(1.0, 1.4))
        yy = place(x, z) + 0.008
        sg.apply(M).move(x, yy, z)
        cal.apply(M).move(x, yy, z)
        sc.add(st_m, sg)
        sc.add(cal_m, cal.normals().double())
    # granola numa faixa
    gt = np.zeros((128, 128, 3)) + srgb('#b9793a')
    gt = noisy(gt, 420, 0.35)
    gt = blotches(gt, 421, '#e2b36d', 0.62, soft=0.1)
    gran = Material('granola', rough=0.75, tex=to_image(gt))
    gb = []
    for k in range(70):
        a = rng.uniform(0.15, 1.85)
        rr = rng.uniform(0.012, Ra - 0.008)
        x, z = rr * math.cos(a), rr * math.sin(a)
        s = rng.uniform(0.0028, 0.0055)
        e = ellipsoid(s, s * rng.uniform(0.5, 0.8), s * rng.uniform(0.7, 1.1), seg=9, rings=6)
        nn = Noise3(int(rng.integers(1e6)), 900)
        e.P *= (1 + 0.35 * nn(e.P))[:, None]
        e.apply(rot_y(rng.uniform(0, TAU)) @ rot_x(rng.uniform(-0.6, 0.6)))
        e.move(x, place(x, z) + s * 0.4, z)
        gb.append(e)
    sc.add(gran, merge(gb).normals(weld=False))
    # leite condensado
    milk = Material('leite-condensado', color='#fbf4e2', rough=0.12)
    path = []
    for t in np.linspace(0, 1, 160):
        a = -0.6 + t * 4.2
        rr = 0.012 + 0.045 * (0.5 + 0.5 * math.sin(t * 9.0))
        x, z = rr * math.cos(a), rr * math.sin(a)
        path.append((x, place(x, z) + 0.0045, z))
    path = spline(path, 2)
    radius = 0.0016 * np.sin(np.linspace(0.05, math.pi - 0.05, len(path))) ** 0.25
    sc.add(milk, tube(path, radius, ring=10))
    # hortelã
    mint = Material('hortela', rough=0.4, tex=tex_leaf('#2f7d2c', '#5fae4a', 430))
    ms = []
    for (a, L) in [(3.6, 0.03), (3.95, 0.026)]:
        lf = leaf(L, L * 0.38, fold=0.2, curl=0.35)
        lf.apply(rot_y(a + 1.6))
        x, z = 0.006 * math.cos(a), 0.006 * math.sin(a)
        lf.move(x, place(x, z) + 0.006, z)
        ms.append(lf)
    sc.add(mint, merge(ms).normals().double())
    return sc


def tex_bowl(H=256, W=256):
    c = gradient_rows(H, W, [(0, '#c8b9a2'), (0.08, '#ebe3d6'), (0.5, '#f1ebe1'), (0.62, '#a8774c'),
                             (0.66, '#efe8dc'), (1, '#efe8dc')])
    c = speckle(c, 440, 0.006, '#6b5a48', 1)
    return to_image(noisy(c, 441, 0.04))


def tex_banana(S=128):
    ys, xs = np.mgrid[0:S, 0:S] / (S - 1) * 2 - 1
    r = np.sqrt(xs ** 2 + ys ** 2)
    th = np.arctan2(ys, xs)
    c = np.zeros((S, S, 3)) + srgb('#f6e8b8')
    ring = np.exp(-((r - 0.28) / 0.06) ** 2) * (0.5 + 0.5 * np.cos(th * 3))
    c = c * (1 - 0.25 * ring[..., None]) + srgb('#c9a768') * 0.25 * ring[..., None]
    dots = (np.abs(r - 0.18) < 0.04) & ((np.cos(th * 7) > 0.85))
    c[dots] = srgb('#6b4b2a')
    c = c * (1 - smoothstep(0.9, 1.0, r) * 0.15)[..., None]
    return to_image(noisy(c, 450, 0.06))


def strawberry(R):
    prof = []
    for t in np.linspace(0, 1, 18):
        a = t * math.pi
        rr = R * math.sin(a) ** 0.8 * (0.42 + 0.68 * t)
        yy = -math.cos(a) * R * 1.15
        prof.append((rr, yy))
    g = lathe(prof, seg=40)
    g.UV = g.UV * np.array([3, 1])
    g.displace(lambda P: 0.0004 * Noise3(460, 900)(P))
    return g


def tex_strawberry(S=256):
    c = gradient_rows(S, S, [(0, '#c4161f'), (0.6, '#d8222b'), (0.9, '#e84a3d'), (1, '#f2d2a0')])
    r = np.random.default_rng(5)
    h, w, _ = c.shape
    for i in range(14):
        for j in range(9):
            y = int((i + 0.5 * (j % 2)) / 14 * h) % h
            x = int(j / 9 * w + r.integers(-3, 3)) % w
            c[max(0, y - 2):y + 2, max(0, x - 1):x + 2] = srgb('#f3d36b')
            c[max(0, y - 4):max(0, y - 2), max(0, x - 1):x + 2] *= 0.75
    return to_image(noisy(c, 461, 0.08))


def calyx(R):
    gs = []
    for k in range(6):
        lf = leaf(R, R * 0.3, fold=0.1, curl=-0.4)
        lf.apply(rot_z(-0.5) if False else np.eye(3))
        lf.apply(rot_y(k / 6 * TAU))
        gs.append(lf)
    g = merge(gs)
    return g


# ============================================================ MILKSHAKE
def milkshake():
    sc = Scene('milkshake-morango')
    rng = np.random.default_rng(500)
    glass_m = Material('vidro', color='#eef6ff', rough=0.04, alpha=0.16)
    Hg = 0.15
    # copo: perfil externo (pé), parede, borda e parede interna
    outer = [(0.0, 0.0), (0.036, 0.0), (0.038, 0.003), (0.037, 0.012), (0.033, 0.02), (0.032, 0.03),
             (0.036, 0.06), (0.043, 0.11), (0.0455, Hg - 0.002), (0.0458, Hg), (0.0445, Hg + 0.0008),
             (0.0435, Hg - 0.002), (0.0412, 0.11), (0.0345, 0.062), (0.0305, 0.034), (0.0, 0.031)]
    glass = lathe(spline(outer, 4), seg=72)
    sc.add(glass_m, glass)
    # milkshake dentro (opaco)
    shake = Material('milkshake', rough=0.6, tex=tex_shake())
    fill = 0.138
    inner = [(0.0, 0.0325), (0.0300, 0.0345), (0.0340, 0.062), (0.0406, 0.11), (0.0428, fill), (0.0, fill)]
    sg = lathe(spline(inner, 5), seg=96)
    sc.add(shake, sg)
    # chantilly em espiral
    cream = Material('chantilly', color='#fffaf3', rough=0.62)
    prof = []
    levels = 26
    for k in range(levels + 1):
        t = k / levels
        rr = 0.0405 * (1 - t) ** 0.85 + 0.002
        yy = fill + 0.052 * t ** 0.95
        prof.append((rr, yy))
    prof[-1] = (0.0, fill + 0.056)
    cg = lathe(spline(prof, 3), seg=112)
    th = np.arctan2(cg.P[:, 2], cg.P[:, 0])
    hgt = (cg.P[:, 1] - fill) / 0.056
    ridge = 0.5 + 0.5 * np.cos(th * 7 + hgt * 9.0)
    scale = 1 + 0.16 * ridge * np.clip(1 - hgt, 0, 1) ** 0.5 * smoothstep(0.0, 0.12, hgt)
    cg.P[:, 0] *= scale
    cg.P[:, 2] *= scale
    cg.P[:, 1] += 0.004 * np.sin(hgt * math.pi * 3 + th) * (1 - hgt)
    cg.normals()
    sc.add(cream, cg)
    # cereja
    cherry = Material('cereja', color='#a80d1b', rough=0.14)
    stem = Material('cabinho', color='#5b3a17', rough=0.6)
    ch = ellipsoid(0.0105, 0.0098, 0.0105, seg=32, rings=18)
    ch.P[:, 1] -= 0.0025 * np.exp(-(ch.P[:, 0] ** 2 + ch.P[:, 2] ** 2) / 0.00002) * (ch.P[:, 1] > 0)
    ch.move(0.002, fill + 0.064, 0.0)
    sc.add(cherry, ch)
    sp = spline([(0.002, fill + 0.072, 0), (0.004, fill + 0.08, 0.002), (0.009, fill + 0.088, 0.004),
                 (0.015, fill + 0.093, 0.004)], 6)
    sc.add(stem, tube(sp, 0.0009, ring=8))
    # canudo listrado
    straw_m = Material('canudo', rough=0.3, tex=tex_straw())
    sp = np.array([(0.0, 0.05, 0.0), (0.0, Hg + 0.07, 0.0)])
    st = tube(np.linspace(sp[0], sp[1], 30), 0.0035, ring=16, uv_v_scale=8)
    st.apply(rot_z(-0.32) @ rot_y(0.4)).move(-0.012, 0, -0.006)
    sc.add(straw_m, st.normals().double())
    # confeitos
    colors = ['#ff5a8a', '#ffd23f', '#4fc3f7', '#7bd389', '#ffffff']
    groups = {c: [] for c in colors}
    for k in range(70):
        th0 = rng.uniform(0, TAU)
        t = rng.uniform(0.05, 0.85)
        idx = np.argmin(np.abs(hgt - t) + 0.0 * th)
        sel = np.where(np.abs(hgt - t) < 0.03)[0]
        if len(sel) == 0:
            continue
        i = sel[np.argmin(np.abs(((th[sel] - th0 + math.pi) % TAU) - math.pi))]
        p, n = cg.P[i], cg.N[i]
        cap = tube(np.linspace([-0.0026, 0, 0], [0.0026, 0, 0], 4), np.array([0.0006, 0.0011, 0.0011, 0.0006]), ring=6)
        cap.apply(rot_to(n, rng.uniform(0, TAU)), p + n * 0.0008)
        groups[colors[k % len(colors)]].append(cap)
    for c, gs in groups.items():
        if gs:
            sc.add(Material('confeito-' + c.strip('#'), color=c, rough=0.35), merge(gs).normals())
    return sc


def tex_shake(S=256):
    c = gradient_rows(S, S, [(0, '#e58aa3'), (0.6, '#f2a6b9'), (1, '#f6b9c7')])
    c = blotches(c, 510, '#d0607e', 0.64, cells=(4, 8, 16), soft=0.1)
    return to_image(noisy(c, 511, 0.06))


def tex_straw(S=256):
    u = np.linspace(0, 1, S)[None, :]
    v = np.linspace(0, 1, S)[:, None]
    stripe = ((u + v * 2) % 0.5) < 0.22
    c = np.zeros((S, S, 3)) + srgb('#fdf8f0')
    c[stripe] = srgb('#e8303b')
    return to_image(c)


# ============================================================ PETIT GÂTEAU
def petit():
    sc = Scene('petit-gateau')
    rng = np.random.default_rng(600)
    y = ceramic_plate(sc, 0.11)
    # bolinho
    Rc = 0.036
    Hc = 0.046
    prof = spline([(0.0, y), (Rc - 0.003, y), (Rc, y + 0.003), (Rc - 0.0015, y + Hc * 0.6), (Rc - 0.004, y + Hc - 0.004),
                   (Rc - 0.01, y + Hc), (0.0, y + Hc + 0.002)], 6)
    H, W = 256, 256
    t = gradient_rows(H, W, [(0, '#2b160c'), (0.5, '#3b2013'), (0.8, '#46271a'), (1, '#4a2a1b')])
    t = noisy(t, 601, 0.22)
    t = blotches(t, 602, '#22110a', 0.64, soft=0.08)
    sugar = vmask(H, W, 0.78, 1.1, 0.06)
    t = speckle(t, 603, 0.0, '#ffffff', 1)
    nsug = fbm2(H, W, 604, cells=(32, 64, 128))
    s_m = (nsug > 0.56) * sugar * 0.7
    t = t * (1 - s_m[..., None] * 0.85) + srgb('#f3efe9')[None, None] * s_m[..., None] * 0.85
    cake = Material('bolo', rough=0.7, tex=to_image(t))
    cg = lathe(prof, seg=96)
    cg.displace(lambda P: 0.0006 * Noise3(605, 150)(P))
    sc.add(cake, cg)
    # calda escorrendo (fenda + poça)
    lava = Material('chocolate', color='#2a1309', rough=0.1)
    nl = Noise3(610, 60)

    def pfn(U, V):
        th = U * TAU
        base_r = Rc + 0.002
        lobe = np.exp(-((((th - 0.35) + math.pi) % TAU - math.pi) / 0.7) ** 2)
        r = base_r + V * (0.004 + 0.05 * lobe) * (1 + 0.15 * np.sin(th * 5))
        x, z = r * np.cos(th), r * np.sin(th)
        P = np.stack([x, np.zeros_like(x), z], -1).reshape(-1, 3)
        yy = y + 0.0015 + 0.0012 * (1 - V) + 0.0004 * nl(P).reshape(x.shape)
        return x, yy, z
    pg = surface(pfn, 140, 10)
    pg = merge([pg, disc(Rc + 0.002, y + 0.0026, seg=140, rings=2, up=True)])
    sc.add(lava, pg.normals())
    # escorrido na lateral do bolo
    drips = []
    for k in range(5):
        a = 0.35 + (k - 2) * 0.22
        h0 = y + Hc + 0.001
        L = rng.uniform(0.018, 0.034)
        path = []
        for s in np.linspace(0, 1, 18):
            yy = h0 - s * L
            rad_wall = Rc - 0.004 + 0.003 * s
            if s < 0.15:
                rad_wall = (Rc - 0.012) + s / 0.15 * 0.009
            path.append(((rad_wall + 0.0016) * math.cos(a), yy, (rad_wall + 0.0016) * math.sin(a)))
        rr = 0.0032 * (1 - np.linspace(0, 1, 18) * 0.35)
        rr[-1] *= 0.6
        drips.append(tube(np.array(path), rr, ring=10))
    top = disc(Rc - 0.009, y + Hc + 0.0026, seg=60, rings=5, up=True)
    top.normals()
    top.displace(lambda P: 0.0009 * Noise3(615, 200)(P), along=(0, 1, 0))
    top.apply(None, (0.003, 0, 0.001))
    drips.append(top)
    sc.add(lava, merge(drips).normals())
    # sorvete de creme
    ice = Material('sorvete', rough=0.62, tex=tex_icecream())
    ic = ellipsoid(0.029, 0.026, 0.029, seg=64, rings=32)
    hgt = ic.P[:, 1]
    th = np.arctan2(ic.P[:, 2], ic.P[:, 0])
    band = smoothstep(-0.006, -0.002, hgt) * (1 - smoothstep(0.002, 0.006, hgt))
    ic.P[:, [0, 2]] *= (1 + 0.1 * band + 0.03 * np.sin(th * 18) * band)[:, None]
    ic.P[:, 1] = np.where(hgt < -0.004, -0.004 + (hgt + 0.004) * 0.35, hgt)
    ic.normals()
    ic.displace(lambda P: 0.0011 * Noise3(620, 180)(P) + 0.0005 * Noise3(621, 500)(P))
    ic.move(-0.047, y + 0.011, -0.03)
    sc.add(ice, ic)
    # risco de calda no prato
    zz = []
    for t in np.linspace(0, 1, 120):
        x = -0.07 + t * 0.12
        z = 0.06 + 0.012 * math.sin(t * 11)
        zz.append((x, y + 0.0012, z))
    rr = 0.0018 * np.sin(np.linspace(0.08, math.pi - 0.08, 120)) ** 0.3
    st = tube(np.array(zz), rr, ring=8)
    st.P[:, 1] = np.maximum(st.P[:, 1], y + 0.0002)
    sc.add(lava, st.normals())
    # morango + hortelã
    st_m = Material('morango', rough=0.25, tex=tex_strawberry())
    cal_m = Material('folhinha', color='#3f8a2a', rough=0.5)
    sg = strawberry(0.016)
    cal = calyx(0.01)
    M = rot_y(0.6) @ rot_x(1.45)
    sg.apply(M).move(0.045, y + 0.013, -0.04)
    cal.apply(M).move(0.045, y + 0.013, -0.04)
    sc.add(st_m, sg)
    sc.add(cal_m, cal.normals().double())
    mint = Material('hortela', rough=0.4, tex=tex_leaf('#2f7d2c', '#5fae4a', 630))
    ms = []
    for (a, L, dy) in [(0.4, 0.028, 0.0), (1.2, 0.024, 0.002)]:
        lf = leaf(L, L * 0.38, fold=0.2, curl=0.3)
        lf.apply(rot_y(a))
        lf.move(-0.042, y + 0.011 + 0.026 + dy, -0.03)
        ms.append(lf)
    sc.add(mint, merge(ms).normals().double())
    return sc


def tex_icecream(S=256):
    c = np.zeros((S, S, 3)) + srgb('#f7edd2')
    c = noisy(c, 640, 0.06)
    c = speckle(c, 641, 0.004, '#3a2414', 1)
    return to_image(c)


DISHES = {
    'hamburguer': burger,
    'pizza': pizza,
    'batata': fries,
    'acai': acai,
    'milkshake': milkshake,
    'petit-gateau': petit,
}

VIEWS = {  # ângulo do poster
    'hamburguer': (30, 20), 'pizza': (25, 42), 'batata': (28, 20), 'acai': (25, 40),
    'milkshake': (28, 14), 'petit-gateau': (32, 30),
}

if __name__ == '__main__':
    from render import render
    os.makedirs(OUT_MODELS, exist_ok=True)
    os.makedirs(OUT_IMG, exist_ok=True)
    names = sys.argv[1:] or list(DISHES)
    for n in names:
        sc = DISHES[n]()
        p = os.path.join(OUT_MODELS, n + '.glb')
        size = sc.write_glb(p)
        lo, hi = sc.bounds()
        v, t = sc.stats()
        dims = (hi - lo) * 100
        print(f'{n}: {size / 1024:.0f} KB, {v} vértices, {t} triângulos, '
              f'{dims[0]:.1f} x {dims[1]:.1f} x {dims[2]:.1f} cm')
        az, el = VIEWS.get(n, (30, 25))
        im = render(p, os.path.join(OUT_IMG, n + '.webp'), size=900, az=az, el=el)
        # recorta as margens vazias e centraliza num quadrado com respiro de 6%
        box_ = im.getchannel('A').point(lambda a: 255 if a > 10 else 0).getbbox()
        crop = im.crop(box_)
        side = int(max(crop.size) * 1.12)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(crop, ((side - crop.width) // 2, (side - crop.height) // 2))
        sq.resize((720, 720), Image.LANCZOS).save(os.path.join(OUT_IMG, n + '.webp'), 'WEBP', quality=86, method=6)
