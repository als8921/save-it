import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/shell/app-header";
import { SearchForm } from "@/components/library/search-form";
import { LinkCard } from "@/components/library/link-card";
import { ParaBadge } from "@/components/primitives/para-badge";
import type { Link, ParaCategory } from "@/lib/types";

type LinkWithFolder = Link & {
  folders: { name: string; para_category: ParaCategory | null } | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const raw = q?.trim() ?? "";
  // Defensive: strip characters that would break Supabase .or() syntax.
  const query = raw.replace(/[%,()]/g, "");

  const supabase = await createClient();
  let results: LinkWithFolder[] = [];
  if (query) {
    const { data } = await supabase
      .from("links")
      .select("*, folders(name, para_category)")
      .or(
        `title.ilike.%${query}%,description.ilike.%${query}%,url.ilike.%${query}%`
      )
      .order("created_at", { ascending: false })
      .limit(50);
    results = (data ?? []) as LinkWithFolder[];
  }

  return (
    <>
      <AppHeader title="검색" />
      <div className="p-4 space-y-3">
        <SearchForm />
        {!query ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            검색어를 입력하세요
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm italic text-muted-foreground">
            일치하는 링크가 없어요
          </p>
        ) : (
          <ul className="space-y-2">
            {results.map((l) => (
              <li key={l.id} className="flex items-center gap-2">
                <ParaBadge category={l.folders?.para_category ?? null} />
                <div className="flex-1">
                  <LinkCard link={l} />
                  {l.folders?.name && (
                    <div className="mt-0.5 px-4 text-[10px] text-muted-foreground">
                      📁 {l.folders.name}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
