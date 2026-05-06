import { createClient } from '@supabase/supabase-js';
import { buildLitematic } from '@/lib/litematic';
import { buildBg2Template } from '@/lib/bg2template';
import type { Session, Block } from '@/lib/types';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get('format');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon);

  const { data: session, error } = await sb
    .from('mcmcp_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!session) return Response.json({ error: 'Session not found' }, { status: 404 });

  // Paginate through all blocks (Supabase caps at 1000 rows per response).
  const PAGE = 1000;
  let offset = 0;
  const blocks: Block[] = [];
  for (;;) {
    const { data, error: blockError } = await sb
      .from('mcmcp_blocks')
      .select('*')
      .eq('session_id', id)
      .range(offset, offset + PAGE - 1);
    if (blockError) return Response.json({ error: blockError.message }, { status: 500 });
    if (!data || data.length === 0) break;
    blocks.push(...(data as Block[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }

  if (format === 'bg2') {
    const { json } = buildBg2Template(session as Session, blocks);
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="mcmcp-${id}.json"`,
      },
    });
  }

  const { buffer } = buildLitematic(session as Session, blocks);

  const filename = `mcmcp-${id}.litematic`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(buffer.length),
    },
  });
}
