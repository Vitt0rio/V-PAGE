import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.SUPABASE_ANON_KEY;
const ADMIN_CODE = import.meta.env.ADMIN_CODE || "0000";

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase environment variables are missing");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Rate limit mejorado con limpieza automática
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 30000; // 30 segundos
const MAX_CONTENT_LENGTH = 1000; // Aumentado de 500
const MAX_AUTHOR_LENGTH = 50;

function isRateLimited(ip) {
  const now = Date.now();
  
  // Limpieza de entradas antiguas (optimización de memoria)
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(key);
    }
  }

  const lastRequest = rateLimitMap.get(ip);

  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
    return true;
  }

  rateLimitMap.set(ip, now);
  return false;
}

// Sanitización mejorada
function sanitizeText(text, maxLength) {
  if (!text) return "";
  return text
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ""); // Prevenir XSS básico
}

// Validación de admin code
function isValidAdmin(code) {
  return code === ADMIN_CODE;
}

export async function GET({ url }) {
  try {
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(JSON.stringify({ error: "Missing slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("comments")
      .select("*")
      .eq("post_slug", slug)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return new Response(JSON.stringify({ error: "Failed to fetch comments" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data || []), {
      headers: { 
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      },
    });
  } catch (err) {
    console.error("GET error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();

    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    if (isRateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait 30 seconds." }),
        { 
          status: 429,
          headers: { "Content-Type": "application/json" }
        }
      );
    }

    const { post_slug, content, author, website } = body;

    // Honeypot anti-spam
    if (website) {
      console.log("Spam attempt detected from IP:", ip);
      // Retornar éxito falso para no alertar al bot
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validaciones
    if (!post_slug || !content) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (content.length < 3) {
      return new Response(JSON.stringify({ error: "Comment too short (minimum 3 characters)" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Sanitización
    const cleanContent = sanitizeText(content, MAX_CONTENT_LENGTH);
    const cleanAuthor = sanitizeText(author, MAX_AUTHOR_LENGTH) || "Anónimo";
    const cleanSlug = sanitizeText(post_slug, 200);

    const { data, error } = await supabase
      .from("comments")
      .insert([
        {
          post_slug: cleanSlug,
          content: cleanContent,
          author: cleanAuthor,
        },
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return new Response(JSON.stringify({ error: "Failed to save comment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("POST error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function DELETE({ request }) {
  try {
    const body = await request.json();
    const { id, adminCode } = body;

    if (!id) {
      return new Response(JSON.stringify({ error: "Missing comment ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validar código de admin (opcional pero recomendado)
    if (adminCode && !isValidAdmin(adminCode)) {
      return new Response(JSON.stringify({ error: "Invalid admin code" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { error } = await supabase
      .from("comments")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Supabase delete error:", error);
      return new Response(JSON.stringify({ error: "Failed to delete comment" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("DELETE error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}