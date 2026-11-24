// node(타입 스트리핑)에서 Cocos식 확장자 없는 상대 import를 .ts로 해석하는 훅.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
    resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
            const base = new URL(specifier, context.parentURL);
            for (const cand of [base.href + '.ts', base.href + '/index.ts']) {
                if (existsSync(fileURLToPath(cand))) return nextResolve(cand, context);
            }
        }
        return nextResolve(specifier, context);
    },
});
