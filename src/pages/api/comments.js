import { supabase } from '../../lib/supabase';

export async function GET({ url }) {
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), { status: 400 });
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

export async function POST({ request }) {
  const { post_slug, name, content } = await request.json();

  if (!post_slug || !content) {
    return new Response(JSON.stringify({ error: "Missing data" }), { status: 400 });
  }

  const { error } = await supabase.from('comments').insert([
    {
      post_slug,
      name: name || "Anónimo",
      content,
    },
  ]);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}

export async function DELETE({ request }) {
  const { id } = await request.json();

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing ID" }), { status: 400 });
  }

  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);

  if (error) {
    return new Response(JSON.stringify({ error }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
