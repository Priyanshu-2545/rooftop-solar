import { getDb } from "@/db/client";
import { getUser } from "@/lib/auth/current";
import { getDocumentFor } from "@/lib/projects/service";

// Authorised download: owner or sales only. Never a public path.
export async function GET(_r: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const d = await getDocumentFor(getDb(), await getUser(), id);
  if (!d) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(d.data), {
    headers: { "Content-Type": d.mime, "Content-Disposition": `attachment; filename="${d.filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
