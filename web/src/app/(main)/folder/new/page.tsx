"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PARA_LABELS, PARA_ORDER } from "@/lib/types";
import type { ParaCategory } from "@/lib/types";

export default function NewFolderPage() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as ParaCategory | null;

  const [name, setName] = useState("");
  const [category, setCategory] = useState<ParaCategory | null>(
    initialCategory
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("로그인이 필요합니다");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("folders")
      .insert({
        user_id: user.id,
        name,
        para_category: category,
      })
      .select("id")
      .single();

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(`/folder/${data.id}`);
    router.refresh();
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-semibold">새 폴더</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">폴더 이름</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="폴더 이름을 입력하세요"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>카테고리</Label>
            <div className="flex flex-wrap gap-2">
              {PARA_ORDER.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    category === cat
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                >
                  {PARA_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => router.back()}
            >
              취소
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "생성 중..." : "생성"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
