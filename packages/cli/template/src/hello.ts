import type { FUNCAPP, FUNCCTX } from '../context'
const ctx: FUNCCTX = _CTX
const app: FUNCAPP = _APP

export const main = async () => {
    return { data: { name: 'yajs' } }
}
