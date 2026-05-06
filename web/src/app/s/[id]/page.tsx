import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Viewer from './Viewer';
import type { Session } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function SessionPage({ params }: PageProps<'/s/[id]'>) {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, anon);

  const { data, error } = await sb
    .from('mcmcp_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) notFound();

  return <Viewer session={data as Session} />;
}
