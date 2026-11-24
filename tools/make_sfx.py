#!/usr/bin/env python3
"""붕어빵 굽기 효과음 합성기. 외부 음원 없이 순수 파이썬으로 WAV(22.05kHz 16bit mono)를 만든다.
사용: python3 tools/make_sfx.py  → assets/audio/*.wav (직접 만든 합성음이라 저작권 문제가 없다)"""
import math, random, struct, wave, os

SR = 22050
random.seed(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')

def env(n, atk=0.004, dec=6.0):
    """빠른 어택 + 지수 감쇠"""
    a = max(1, int(SR * atk))
    return [(i / a if i < a else 1.0) * math.exp(-dec * i / n) for i in range(n)]

def sine(freq, dur, amp=1.0, dec=6.0, sweep_to=None, atk=0.004):
    n = int(SR * dur); e = env(n, atk, dec); out = []; ph = 0.0
    for i in range(n):
        f = freq if sweep_to is None else freq + (sweep_to - freq) * i / n
        ph += 2 * math.pi * f / SR
        out.append(math.sin(ph) * amp * e[i])
    return out

def noise(dur, amp=1.0, dec=5.0, hp=0.0, lp=1.0, atk=0.004):
    """백색잡음 + 간단 1극 필터. hp(0~1): 고역 통과 정도, lp(0~1): 저역 통과 계수(작을수록 어둡다)"""
    n = int(SR * dur); e = env(n, atk, dec); out = []; y = 0.0; prev = 0.0
    for i in range(n):
        x = random.uniform(-1, 1)
        y += lp * (x - y)                 # 저역 통과
        v = y - hp * prev; prev = y * 1.0 # 고역 강조
        out.append(v * amp * e[i])
    return out

def mix(*tracks, offsets=None):
    offsets = offsets or [0] * len(tracks)
    n = max(int(SR * o) + len(t) for t, o in zip(tracks, offsets))
    out = [0.0] * n
    for t, o in zip(tracks, offsets):
        s = int(SR * o)
        for i, v in enumerate(t): out[s + i] += v
    return out

def save(name, samples, gain=0.85):
    peak = max(1e-9, max(abs(v) for v in samples))
    data = b''.join(struct.pack('<h', int(max(-1, min(1, v / peak * gain)) * 32767)) for v in samples)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(data)
    print(name, len(samples) / SR, 's')

# 1) 반죽 넣기: 묵직하고 부드러운 '퍽'
save('sfx_dough', mix(sine(130, 0.16, 1.0, 14, sweep_to=55), noise(0.12, 0.35, 18, lp=0.12)))
# 2) 앙금 넣기: 말랑한 '뽁' (상승 후 하강 버블)
save('sfx_filling', mix(sine(260, 0.09, 1.0, 16, sweep_to=620), sine(900, 0.05, 0.35, 30, sweep_to=500), offsets=[0, 0.05]))
# 3) 굽기: 지글지글 + 톡톡 튀는 소리
crackle = [0.0] * int(SR * 0.5)
for _ in range(14):
    p = random.randint(0, len(crackle) - 400)
    for i, v in enumerate(noise(0.012, 1.0, 40, hp=0.9, lp=0.9)): crackle[p + i] += v * random.uniform(0.4, 1.0)
save('sfx_bake', mix(noise(0.5, 0.55, 3.2, hp=0.6, lp=0.55, atk=0.02), crackle))
# 4) 뒤집기: 슉(스윕) + 착(안착)
save('sfx_flip', mix(noise(0.16, 0.7, 7, hp=0.3, lp=0.35, atk=0.03), sine(180, 0.09, 0.8, 22, sweep_to=90), offsets=[0, 0.12]))
# 5) 완성: 맑은 '띵'
bell = lambda f, d, a: sine(f, d, a, 5.5, atk=0.002)
save('sfx_finish', mix(bell(1046.5, 0.6, 1.0), bell(1568, 0.5, 0.45), bell(2093, 0.35, 0.2)))
# 6) 콤보 10+ 완성: 반짝이는 아르페지오
notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
save('sfx_finish_big', mix(*[bell(f, 0.45, 0.8) for f in notes], offsets=[0.06 * i for i in range(len(notes))]))
# 7) 너무 일찍 탭: 아주 작은 '툭'
save('sfx_early', sine(150, 0.06, 1.0, 30, sweep_to=100), gain=0.35)
# 8) 구매: 동전 '찰랑'
save('sfx_buy', mix(bell(1318.5, 0.25, 1.0), bell(1760, 0.3, 0.8), offsets=[0, 0.07]))
# 9) 새 메뉴 개발(확장)·환생: 종소리 화음
save('sfx_expand', mix(*[bell(f, 0.9, a) for f, a in [(523.25, 1.0), (659.25, 0.8), (783.99, 0.8), (1046.5, 0.7)]], offsets=[0, 0.08, 0.16, 0.24]))
# 10) 황금 불판: 불 붙는 휘익 + 반짝
save('sfx_golden', mix(noise(0.55, 0.8, 2.2, hp=0.5, lp=0.5, atk=0.15), sine(400, 0.5, 0.5, 3, sweep_to=1600, atk=0.05), bell(1760, 0.5, 0.7), offsets=[0, 0, 0.3]))
