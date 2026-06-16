import { NextResponse } from 'next/server';
import { readRoundtableContextFile } from '@/lib/roundtable-context-file';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { path?: unknown } | null;
  const requestedPath = typeof body?.path === 'string' ? body.path : '';

  try {
    const file = await readRoundtableContextFile(requestedPath);
    return NextResponse.json({
      ok: true,
      title: file.title,
      source: file.source,
      relativePath: file.relativePath,
      content: file.content,
      size: file.size,
      summarized: file.summarized,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 400 });
  }
}
