import { Button, Label, Node, ProgressBar, Sprite, SpriteFrame } from 'cc';

export function setText(label: Label | null, text: string) {
    if (label && label.string !== text) label.string = text;
}

export function setActive(node: Node | null, on: boolean) {
    if (node && node.active !== on) node.active = on;
}

export function setFrame(sprite: Sprite | null, frame: SpriteFrame | null) {
    if (sprite && frame && sprite.spriteFrame !== frame) sprite.spriteFrame = frame;
}

export function setProgress(bar: ProgressBar | null, ratio: number) {
    if (bar) bar.progress = Math.max(0, Math.min(1, ratio));
}

/** Button 필드에 노드만 연결하면 클릭 핸들러는 코드가 붙인다(Inspector ClickEvent 불필요). */
export function onClick(button: Button | null, handler: () => void, target: object) {
    if (button) button.node.on(Button.EventType.CLICK, handler, target);
}

export function offClick(button: Button | null, handler: () => void, target: object) {
    if (button && button.isValid) button.node.off(Button.EventType.CLICK, handler, target);
}
