import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "org-logos";

/**
 * Uploads a logo file to Supabase Storage and returns the public URL.
 * Requires bucket "org-logos" created in Supabase dashboard with public access.
 * RLS policy needed: authenticated users can upload to their own orgId prefix.
 */
export async function uploadOrgLogo(
  supabase: SupabaseClient,
  orgId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${orgId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  // Bust cache so the new logo shows immediately
  return `${data.publicUrl}?t=${Date.now()}`;
}
