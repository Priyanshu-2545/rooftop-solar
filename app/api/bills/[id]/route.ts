import { getDb } from "@/db/client";
import { getUser } from "@/lib/auth/current";
import { getUploadFor } from "@/lib/data/leads";

// Authorised image route: bill photos are never served from a public path.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const upload = await getUploadFor(getDb(), await getUser(), id);
  if (!upload) return new Response("Not found", { status: 404 }); // 404, not 403: no existence leak
  return new Response(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.mime,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
