import { supabase } from '../../lib/supabase';

export async function GET(context) {
  const url = new URL(context.request.url);
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_slug', slug)
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}

export async function POST(context) {
  const body = await context.request.json();
  const { post_slug, name, content } = body;

  if (!post_slug || !content) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
    });
  }

  const { data, error } = await supabase.from('comments').insert([
    {
      post_slug,
      name: name || "Anónimo",
      content,
    },
  ]);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}
