import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.API_URL ?? 'http://localhost:3001';

async function proxy(req: NextRequest, path: string[], method: string) {
  const url = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;
  const init: RequestInit = { method };

  if (method !== 'GET' && method !== 'HEAD') {
    const body = await req.text();
    init.body = body || undefined;
    init.headers = { 'Content-Type': 'application/json' };
  }

  const res = await fetch(url, init);

  if (res.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const text = await res.text();
  try {
    return NextResponse.json(JSON.parse(text), { status: res.status });
  } catch {
    return new NextResponse(text, { status: res.status });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path, 'GET');
}
export async function POST(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path, 'POST');
}
export async function PATCH(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path, 'PATCH');
}
export async function DELETE(req: NextRequest, { params }: Ctx) {
  return proxy(req, (await params).path, 'DELETE');
}
