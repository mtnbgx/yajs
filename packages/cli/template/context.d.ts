import type Redis from "ioredis";
import type { WebSocket, WebSocketServer } from 'ws'
import type { FastifyRequest, FastifyReply } from 'fastify'
import type * as M from '@fastify/multipart'
import type { Knex } from "knex";

interface Request {
    query: any
    rawBody: string;
    body: any;
    user: any
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers: any,
    saveRequestFiles: any
}

export interface FUNCCTX {
    request: Request
    reply: Reply
    redis: Redis,
    knex: Knex,
    secret: any
}

interface Reply extends FastifyReply {
    sendFile: (filePath: string) => Promise<void>;
}

export interface FUNCAPP {
    ApiError: new (message: string, code?: number, status?: number) => void,
    publicDir: string
    templateEngine: any
}
