// 코드로 UI 조각(둥근 사각형 Graphics + Label)을 만드는 작은 도우미. 씬에 미리 배치하지 않는 굽기 단계 UI 전용.
import { Color, Graphics, HorizontalTextAlignment, Label, Node, UITransform, VerticalTextAlignment, Label as L } from 'cc';

export const C = {
    cream: new Color(251, 241, 221, 255),
    track: new Color(235, 222, 200, 255),
    orange: new Color(232, 134, 58, 255),
    orangeDeep: new Color(186, 75, 33, 255),
    tan: new Color(214, 160, 96, 255),
    brown: new Color(67, 42, 28, 255),
    muted: new Color(133, 110, 90, 255),
    white: new Color(255, 255, 255, 255),
    gray: new Color(190, 178, 160, 255),
    card: new Color(255, 250, 240, 255),
};

/** parent 아래 빈 노드. 디자인 좌표(1080×1920, 좌상단 원점)가 아니라 parent 로컬 좌표를 쓴다. */
export function makeNode(name: string, parent: Node, x: number, y: number, w: number, h: number): Node {
    const n = new Node(name);
    n.layer = parent.layer;
    n.parent = parent;
    n.setPosition(x, y, 0);
    n.addComponent(UITransform).setContentSize(w, h);
    return n;
}

export function makeLabel(name: string, parent: Node, text: string, x: number, y: number, w: number, h: number,
    size: number, color: Color, bold = false, align: HorizontalTextAlignment = HorizontalTextAlignment.CENTER): Label {
    const n = makeNode(name, parent, x, y, w, h);
    const l = n.addComponent(Label);
    l.string = text;
    l.fontSize = size;
    l.lineHeight = Math.round(size * 1.25);
    l.overflow = L.Overflow.SHRINK;
    l.horizontalAlign = align;
    l.verticalAlign = VerticalTextAlignment.CENTER;
    l.color = color;
    l.isBold = bold;
    return l;
}

export function makeGraphics(name: string, parent: Node, x: number, y: number, w: number, h: number): Graphics {
    const n = makeNode(name, parent, x, y, w, h);
    return n.addComponent(Graphics);
}

/** 중심 기준 둥근 사각형 채우기 */
export function fillRound(g: Graphics, color: Color, w: number, h: number, r: number, left = -w / 2) {
    g.fillColor = color;
    g.roundRect(left, -h / 2, w, h, Math.min(r, h / 2, w / 2));
    g.fill();
}
