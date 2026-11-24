"""Rebuild the original SVG and PNG art for Bungeoppang Company.

Only design/src and assets/art are written. Requires rsvg-convert.
"""
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/src'
OUT = ROOT / 'assets/art'
ASSETS = []
C = dict(brown='#743F26', dark='#432A1C', line='#BD7648', orange='#E9643C',
         amber='#FFB347', cream='#FFF2D9', pale='#FFF9EA', gold='#FFCA66',
         road='#D5A674', steel='#47505C', bean='#E8A54B')
(SRC / 'palette.json').write_text(json.dumps(C, ensure_ascii=False, indent=2) + '\n')

def add(folder, name, w, h, body, vb=None, opaque=False, priority='P0', basis='original vector shapes'):
    vb = vb or f'0 0 {w} {h}'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="{vb}">
<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#FFEAC2"/><stop offset="1" stop-color="#FFF9EA"/></linearGradient>
<linearGradient id="button" x2="0" y2="1"><stop stop-color="#FFB347"/><stop offset="1" stop-color="#ED7830"/></linearGradient>
<linearGradient id="oven" x2="0" y2="1"><stop stop-color="#47505C"/><stop offset="1" stop-color="#242B36"/></linearGradient>
<radialGradient id="glow"><stop stop-color="#FFD35A" stop-opacity=".42"/><stop offset="1" stop-color="#FFD35A" stop-opacity="0"/></radialGradient></defs>{body}</svg>'''
    source = SRC / f'{name}.svg'
    target = OUT / folder / f'{name}.png'
    source.parent.mkdir(parents=True, exist_ok=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    source.write_text(svg)
    with target.open('wb') as stream:
        subprocess.run(['rsvg-convert', str(source)], stdout=stream, check=True)
    ASSETS.append(dict(id=name, folder=folder, width=w, height=h, opaque=opaque,
                       priority=priority, basis=basis))

def rect(x,y,w,h,fill,rx=0,stroke=None,sw=0,extra=''):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + f' {extra}/>'
def circle(x,y,r,fill,extra=''):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{fill}" {extra}/>'
def path(d,fill,stroke=None,sw=0,extra=''):
    return f'<path d="{d}" fill="{fill}"' + (f' stroke="{stroke}" stroke-width="{sw}"' if stroke else '') + f' {extra}/>'
def line(x1,y1,x2,y2,color,sw,extra=''):
    return f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" fill="none" {extra}/>'

# Scene layers retain the reference's warm daylight, ground bands and short shadows.
sky = rect(0,0,1080,1920,'url(#sky)') + circle(884,348,130,'#FFD89B','opacity=".65"')
sky += path('M0 900Q250 830 540 900T1080 890V1110H0','#EED3A5')
sky += path('M0 997Q280 938 530 1005T1080 980V1920H0','#FFF7E8')
add('bg','bg_sky_day',1080,1920,sky,opaque=True,basis='design main-screen sky gradient and sun')

for stage in range(1,6):
    b = path('M0 270H1080V640H0Z','#F7E5C5')
    b += path('M0 449H1080V579H0Z','#D5A674') + rect(0,508,1080,24,'#BD895E')
    if stage >= 2:
        for x in (95,965):
            b += rect(x-8,170,16,150,'#9D714A',6) + circle(x,165,47,'#A5B98C') + circle(x-28,187,34,'#B7C898')
    if stage >= 3:
        for x,ww,hh in ((22,190,175),(217,145,225),(735,165,205),(905,155,250)):
            y=330-hh
            b += rect(x,y,ww,hh,'#E9C9A5',9) + rect(x+12,y+15,ww-24,35,'#DDA677',5)
            b += rect(x+26,y+72,ww-52,78,'#A9B9B2',8)
    if stage >= 4:
        b += path('M0 560H1080V640H0Z','#C99D72')
        for x in range(44,1080,210): b += rect(x,572,112,12,'#FFF4DE',4)
    if stage >= 5:
        for x in (80,500,995):
            b += rect(x,85,10,195,'#735A50',4) + path(f'M{x} 92q35-35 82 0','none','#735A50',9) + circle(x+81,91,15,'#FFE1A2')
        b += path('M0 328H1080V363H0Z','#DEBC99')
    add('bg',f'bg_street_s{stage}',1080,640,b,basis=f'concept street bands; stage {stage} original additions')

def wheel(x,y):
    return circle(x,y,31,'#4F3C37') + circle(x,y,15,'#AD9280') + circle(x,y,6,'#4F3C37')
def bun(cx=0,cy=0,scale=1,color='#E8A54B'):
    s=f'<g transform="translate({cx} {cy}) scale({scale})">'
    s+= '<ellipse cx="0" cy="0" rx="58" ry="38" fill="#A95023"/>'
    s+=f'<ellipse cx="0" cy="-6" rx="52" ry="32" fill="{color}"/>'
    s+=path('M-46 1Q-18-22 13-4Q29-22 50-1','none','#FBD184',8,'stroke-linecap="round"')
    s+=circle(-16,-11,4,'#703721')+path('M45 0l32-20v40z','#DA8B3D')
    s+=path('M-5 6q13 14 30 0','none','#A65E2C',5,'stroke-linecap="round"')
    return s+'</g>'

cart = wheel(167,392)+wheel(478,392)+rect(72,190,498,190,'#A95A34',20)
cart += rect(90,210,460,110,'#FBE7C4',18,'#BD7648',7)+rect(80,335,480,30,'#7E3D29',10)
cart += rect(205,115,240,82,'#47505C',16)+rect(226,128,198,50,'#242B36',12)
cart += line(70,273,20,285,'#7E3D29',15)+bun(316,150,.42)
add('store','store_s1_cart',640,460,cart,basis='cart derived from concept oven and wheels')

stall = rect(45,170,630,300,'#FBE7C4',28,'#BD7648',8)
stall += path('M18 176L99 35H620L702 176Z','#E9643C','#AE4C31',8)
for x in (108,272,440,593): stall+=path(f'M{x} 35L{x-18} 176H{x+66}L{x+38} 35Z','#FFF2D9')
stall += rect(158,58,404,72,'#742F25',28)
stall += rect(95,255,530,168,'#A95A34',22)+rect(127,276,466,120,'url(#oven)',20)
stall += bun(278,337,.61)+bun(442,337,.61)+rect(106,424,508,69,'#7E3D29',15)
stall += wheel(137,518)+wheel(593,518)
add('store','store_s2_stall',720,560,stall,basis='concept stall roof, oven, wheels and bun')

def shop(stage):
    W,H={3:(860,620),4:(960,700),5:(1040,720)}[stage]
    base=H-70
    if stage==3:
        s=rect(80,132,W-160,base-132,'#F6DDB9',22,'#BD7648',8)
        s+=rect(60,110,W-120,84,'#E9643C',20)+rect(118,210,W-236,70,'#743F26',16)
        s+=rect(132,302,W-264,200,'#83A7A6',18,'#BD7648',8)
        s+=rect(160,334,170,145,'#FFF2D9',8)+rect(W-319,334,160,145,'#FFF2D9',8)
        s+=rect(67,495,W-134,60,'#A95A34',15)
    elif stage==4:
        s=rect(80,85,W-160,base-85,'#E9C9A5',20,'#BD7648',8)
        s+=rect(114,120,W-228,143,'#F8E8CF',12)
        for x in (160,370,580): s+=rect(x,135,145,110,'#99B9B8',10)
        s+=rect(55,275,W-110,85,'#E9643C',18)
        for x in range(100,W-90,150): s+=rect(x,285,77,69,'#FFF2D9',5)
        s+=rect(112,382,W-224,205,'#82A9AB',13,'#BD7648',8)+rect(145,402,198,170,'#FFF2D9',10)
        s+=rect(40,585,W-80,48,'#A95A34',12)
    else:
        s=rect(70,80,W-140,base-80,'#E3C4A1',22,'#BD7648',8)
        s+=rect(95,115,W-190,115,'#743F26',20)
        for row in (260,380,500):
            for x in (120,330,540,750): s+=rect(x,row,165,92,'#8FB4B4',10,'#FFF2D9',8)
        s+=rect(390,518,260,130,'#FFF2D9',10)+rect(425,532,190,112,'#83A7A6',10)
        s+=rect(50,640,W-100,42,'#A95A34',10)
    return s
for st, name, size in [(3,'shop',(860,620)),(4,'local',(960,700)),(5,'large',(1040,720))]:
    add('store',f'store_s{st}_{name}',*size,shop(st),basis=f'original stage {st} storefront based on concept palette')

for st in range(6,12):
    if st<=7:
        s=rect(65,130,230,120,'#C9B8A6',10)+rect(95,55,170,85,'#C9B8A6',5)
        for x in (105,150,195,240): s+=rect(x,90,18,29,'#FFF9EA',2)
        for x in (100,140,180,220): s+=rect(x,155,14,65,'#B2A08E',3)
        if st==7: s+=rect(130,20,100,40,'#C9B8A6',5)
    elif st<=9:
        s=''.join(rect(x,250-h,58,h,'#C9B8A6',5) for x,h in ((40,100),(105,155),(170,215),(235,135),(300,95)))
        if st==9: s+=path('M180 30V155','none','#B2A08E',8)+path('M180 30l78 28-78 27Z','#C9B8A6')
    else:
        s=circle(180,140,105,'#C9B8A6')+path('M68 139Q180 235 292 139','none','#B2A08E',12)
        if st==11: s+=circle(60,45,9,'#C9B8A6')+circle(300,43,7,'#C9B8A6')
    add('bg',f'bg_roadmap_silhouette_s{st}',360,280,s,priority='P1')

for name,color in [('batter','#F5DDA0'),('baking','#C68146'),('plain_done','#E8A54B'),('red_bean_done','#B9773D'),('custard_done','#EFC064'),('golden_done','#FFD35A')]:
    s=bun(90,76,1.05,color)
    if name=='red_bean_done': s+=circle(104,72,8,'#7B2F32')
    if name=='custard_done': s+=path('M65 97Q95 109 121 93','none','#FFF0A3',8)
    if name=='golden_done': s+=circle(142,23,7,'#FFF2B6')
    add('bread',f'bread_{name}',192,144,s,priority='P0' if name in ('batter','baking','plain_done') else 'P1',basis='concept bun symbol redrawn with state colours')

for wide,w,n in [(False,560,2),(True,760,4)]:
    s=rect(10,40,w-20,145,'#47505C',23,'#242B36',10)
    for k in range(n):
        x=45+k*(w-90)/n
        s+=rect(x,64,(w-100)/n-10,95,'#242B36',32,'#7B706B',6)
        s+=circle(x+((w-100)/n-10)/2,112,30,'#ED9850','opacity=".37"')
    add('equip','equip_mold_plate_wide' if wide else 'equip_mold_plate',w,200,s)
s=rect(15,25,570,210,'#A95A34',25,'#7E3D29',9)+rect(37,45,526,140,'url(#oven)',19)
s+=rect(55,60,490,108,'#55443E',16)+circle(178,115,56,'#ED9850','opacity=".46"')+circle(414,115,56,'#ED9850','opacity=".46"')
s+=bun(178,116,.51)+bun(414,116,.51)+rect(95,195,410,25,'#7E3D29',8)
add('equip','equip_oven_s2',600,260,s,basis='concept oven geometry and bun')
add('equip','equip_plate',260,90,path('M14 35Q130 10 246 35Q250 78 130 82Q10 78 14 35Z','#FFFDF6','#D6C2A8',5)+path('M40 38Q130 17 220 38','none','#E8D6C0',4))

# Equipment silhouettes can be displayed as independent upgrades.
equip={
 'equip_flipper_auto':(220,220, rect(23,165,174,33,'#47505C',13)+line(113,162,113,70,'#7A8C93',19)+path('M65 72Q113 16 164 72','none','#47505C',19)+circle(113,65,18,'#E9643C')),
 'equip_dispenser':(220,300, rect(52,25,116,152,'#FFF2D9',22,'#BD7648',8)+path('M81 177H139L130 256H91Z','#47505C')+rect(75,80,70,45,'#E9643C',9)+circle(111,260,11,'#F5DDA0')),
 'equip_conveyor_oven':(520,240, rect(20,96,480,115,'#47505C',24)+rect(54,111,410,72,'#242B36',14)+rect(12,190,496,30,'#A95A34',10)+''.join(circle(x,205,13,'#D6B68C') for x in range(55,490,65))),
 'equip_packing_line':(560,240, rect(15,185,530,32,'#47505C',12)+''.join(rect(x,112,110,75,'#D7B88D',9,'#A17650',5)+path(f'M{x} 112l55 28 55-28','none','#A17650',4) for x in (55,225,395)))
}
for name,(w,h,s) in equip.items(): add('equip',name,w,h,s,priority='P1')

for frame in range(4):
    shift=[0,9,-7,4][frame]
    flame=path(f'M80 190Q28 155 {55+shift} 105Q63 65 70 23Q121 71 126 106Q157 66 146 46Q175 126 128 185Z','#ED7830')
    flame+=path(f'M83 181Q63 153 79 117Q97 89 91 73Q135 130 116 178Z','#FFE9A6')
    add('fx',f'fx_flame_{frame:02}',160,200,flame,priority='P1')
add('fx','fx_spark',64,64,path('M32 6V58M6 32H58','none','#FFE9A6',9,'stroke-linecap="round"'),basis='concept spark symbol')
add('fx','fx_coin_pop',96,96,circle(48,48,39,'#FFD35A')+circle(48,48,30,'none','stroke="#FFF2B6" stroke-width="4"')+path('M29 46h38M39 30l9 32 9-32','none','#743F26',5,'stroke-linecap="round"'),priority='P1')
add('fx','fx_steam',128,128,path('M30 112Q7 89 36 66T35 14M72 112Q49 89 78 66T77 14M109 112Q86 89 115 66T114 14','none','#FFFFFF',10,'stroke-linecap="round" opacity=".6"'),priority='P1')
add('fx','fx_confetti',32,32,rect(8,4,16,24,'#FFFFFF',3),priority='P1')
add('fx','fx_golden_glow',640,640,circle(320,320,315,'url(#glow)'),priority='P1')

def person(w,h,shirt,hair='#684132',skin='#F3C28F',pose='idle',hat=None):
    cx=w/2
    s=path(f'M{cx-38} {h*.54}Q{cx} {h*.39} {cx+38} {h*.54}L{cx+54} {h*.91}H{cx-54}Z',shirt)
    s+=rect(cx-47,h*.89,36,h*.1,'#4F3C37',10)+rect(cx+11,h*.89,36,h*.1,'#4F3C37',10)
    s+=circle(cx,h*.34,w*.21,skin)+path(f'M{cx-w*.2} {h*.28}Q{cx} {h*.08} {cx+w*.2} {h*.28}Q{cx} {h*.20} {cx-w*.2} {h*.28}Z',hair)
    s+=circle(cx-14,h*.34,3,'#432A1C')+circle(cx+14,h*.34,3,'#432A1C')
    if pose=='bake': s+=line(cx-42,h*.61,cx-90,h*.74,skin,19)+line(cx+42,h*.61,cx+85,h*.73,skin,19)
    else: s+=line(cx-42,h*.61,cx-67,h*.83,skin,19)+line(cx+42,h*.61,cx+67,h*.83,skin,19)
    if hat: s+=path(f'M{cx-48} {h*.22}Q{cx} {h*.08} {cx+48} {h*.22}Z',hat)+rect(cx-52,h*.22,104,12,hat,6)
    return s
add('char','char_staff_idle',220,320,person(220,320,'#F4A845'),basis='concept worker face and orange apron')
for frame in (0,1):
    s=person(220,320,'#F4A845',pose='bake')
    if frame: s+=line(180,220,204,179,'#F3C28F',16)
    add('char',f'char_staff_bake_{frame:02}',220,320,s,priority='P1')
add('char','char_staff_badge',96,96,circle(48,48,45,'#FFE6BC')+circle(48,46,27,'#F3C28F')+path('M21 39Q48 5 75 39Z','#684132')+rect(21,72,54,13,'#F4A845',6),priority='P1')
add('char','char_customer_a',200,280,person(200,280,'#6F8C7C',hair='#7B4C36'),basis='concept customer hair and teal shirt')
for name,shirt,hair,hat in [('b','#E8BA4E','#8A6349','#E9C05B'),('c','#455C79','#483A36',None)]:
    add('char',f'char_customer_{name}',200,280,person(200,280,shirt,hair,hat=hat),priority='P1')
add('ui','ui_speech_bubble',420,150,rect(7,7,406,118,'#FFF6E3',25,'#DFC8A4',6)+path('M60 121L45 146L104 123Z','#FFF6E3','#DFC8A4',4))

# Button/card padding has transparent corners for Cocos Sprite.SLICED.
def button(w,h,fill,border=None,r=30,pressed=False):
    s=rect(5,8,w-10,h-13,'#854A20',r,extra='opacity=".16"')
    s+=rect(4,4,w-8,h-14,fill,r,border,4 if border else 0)
    if not pressed: s+=path(f'M{r+12} 20H{w-r-12}','none','#FFFFFF',5,'opacity=".31" stroke-linecap="round"')
    return s
add('ui','ui_btn_primary',400,170,button(400,170,'url(#button)'))
add('ui','ui_btn_primary_pressed',400,170,button(400,170,'#D9602D',pressed=True))
add('ui','ui_btn_disabled',400,170,button(400,170,'#D9CBB9',pressed=True))
add('ui','ui_btn_secondary',300,120,button(300,120,'#FFF9EC','#E7BF82',27))
add('ui','ui_card_bg',470,222,rect(5,10,460,207,'#854A20',30,extra='opacity=".13"')+rect(4,3,462,209,'#FFFFFF',30,'#F0D6AF',3))
add('ui','ui_card_price_chip',409,43,rect(2,2,405,39,'#FFEEE0',20))
add('ui','ui_card_locked',470,222,rect(5,10,460,207,'#854A20',30,extra='opacity=".12"')+rect(4,3,462,209,'#DDD5CB',30,'#BDAA99',3))
add('ui','ui_card_franchise',972,110,rect(3,3,966,104,'#FFF0CC',27,'#E7C884',3))
add('ui','ui_hud_money_card',972,143,rect(5,9,962,127,'#854A20',32,extra='opacity=".14"')+rect(3,3,966,130,'#FFFDF6',30))
add('ui','ui_progress_frame',972,145,rect(2,2,968,141,'#743F26',29))
add('ui','ui_progress_track',16,40,rect(1,1,14,38,'#AA7452',7))
add('ui','ui_progress_fill',16,40,rect(1,1,14,38,'#FFCA66',7))
add('ui','ui_heat_track',800,24,rect(1,1,798,22,'#743F26',11),priority='P1')
add('ui','ui_heat_fill',16,24,rect(1,1,14,22,'url(#button)',7),priority='P1')
add('ui','ui_tabbar_bg',1080,120,rect(0,0,1080,120,'#FFFDF7')+rect(0,0,1080,3,'#EBD8BA'),opaque=True)
for name,color in [('on','#ED7830'),('off','#BDAA99')]: add('ui',f'ui_tab_dot_{name}',24,24,circle(12,12,10,color))
add('ui','ui_tab_underline',160,8,rect(1,1,158,6,'#ED7830',3))
add('ui','ui_popup_bg',800,600,rect(10,15,780,575,'#854A20',52,extra='opacity=".18"')+rect(5,5,790,580,'#FFF9EA',50,'#BD7648',7))
add('ui','ui_dim',4,4,rect(0,0,4,4,'#000000'),opaque=True)

def icon(name,size=96):
    mid=size/2
    if name=='won': return circle(mid,mid,mid-6,'#FFD98B')+path(f'M{mid-22} {mid-14}L{mid} {mid+21}L{mid+22} {mid-14}M{mid-25} {mid+1}H{mid+25}','none','#743F26',6,'stroke-linecap="round"')
    if name=='fire': return path('M48 8Q68 32 63 47Q82 36 79 62Q76 88 49 90Q15 90 17 58Q19 38 36 24Q33 44 43 50Q55 33 48 8Z','#ED7830')+path('M48 51Q58 61 58 72Q57 86 45 84Q33 82 35 69Z','#FFE9A6')
    if name=='recipe': return path('M48 7L59 35L89 37L66 56L73 87L48 70L23 87L30 56L7 37L37 35Z','#FFCA66')
    if name=='staff': return circle(48,36,24,'#F3C28F')+path('M24 28Q48 1 72 28Z','#684132')+rect(23,62,50,26,'#F4A845',13)
    if name in ('equip','settings'): return circle(mid,mid,mid-8,'#E9643C')+circle(mid,mid,mid*.33,'#FFF9EA')+''.join(rect(mid-7,y,14,16,'#E9643C',4) for y in (3,size-19))
    if name=='expand': return rect(10,43,42,40,'#E9643C',5)+path('M48 56L72 32L62 32L62 15L87 15L87 40L72 40Z','#743F26')
    if name=='franchise': return path('M25 12V87','none','#743F26',7)+path('M29 15H77L67 35L79 57H29Z','#E9643C')
    if name=='lock': return rect(12,27,40,35,'#BDAA99',6)+path('M21 28V18Q21 5 32 5Q44 5 44 18V28','none','#8A7769',6)
    if name=='arrow_right': return path('M5 16H26M17 7L26 16L17 25','none','#743F26',5,'stroke-linecap="round" stroke-linejoin="round"')
    if name.startswith('sound_'):
        s=path('M8 28H21L39 13V52L21 37H8Z','#743F26')
        if name.endswith('on'): s+=path('M48 18Q70 32 48 49','none','#E9643C',6)
        else: s+=path('M46 22L59 44M59 22L46 44','none','#E9643C',5)
        return s
    raise ValueError(name)
for name in ('won','fire','recipe','staff','expand','franchise','lock','settings','arrow_right','equip','sound_on','sound_off'):
    size={'lock':64,'settings':48,'arrow_right':32,'sound_on':64,'sound_off':64}.get(name,96)
    add('icon','icon_'+name,size,size,icon(name,size),priority='P1' if name in ('equip','sound_on','sound_off') else 'P0')

if __name__=='__main__':
    print(f'Exported {len(ASSETS)} SVG/PNG pairs')
    (SRC/'asset_index.json').write_text(json.dumps(ASSETS,ensure_ascii=False,indent=2)+'\n')
