import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();

  // 미지정 폴더로 리다이렉트
  const { data: defaultFolder } = await supabase
    .from("folders")
    .select("id")
    .is("para_category", null)
    .limit(1)
    .single();

  if (defaultFolder) {
    redirect(`/folder/${defaultFolder.id}`);
  }

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-muted-foreground">폴더를 선택하세요</p>
    </div>
  );
}
