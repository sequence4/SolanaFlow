import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import supertest from 'supertest';
import { NextRequest, NextResponse } from 'next/server';

export const toNodeHandler = <T>(
  fn: (req: NextRequest) => Promise<NextResponse<T> | Response>
) => async (req: IncomingMessage, res: ServerResponse) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks);

  const url = `http://localhost${req.url}`;
  
  const nextReq = new NextRequest(url, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body: rawBody.length ? rawBody : undefined,
  });
  
  const fetchRes = await fn(nextReq);

  res.statusCode = fetchRes.status;
  fetchRes.headers.forEach((v, k) => res.setHeader(k, v));
  const buf = Buffer.from(await fetchRes.arrayBuffer());
  res.end(buf);
};

export const makeAgent = (nodeHandler: (req: IncomingMessage, res: ServerResponse) => void) =>
  supertest(createServer(nodeHandler)); 