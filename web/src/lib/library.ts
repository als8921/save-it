import type { ParaCategory } from "./types";
import { PARA_ORDER, PARA_TOKENS, UNASSIGNED_TOKEN } from "./para";

export function folderDeleteMessage(linkCount: number): string {
  if (linkCount === 0) return "이 폴더를 삭제할까요?";
  return `이 폴더와 안에 있는 링크 ${linkCount}개가 함께 삭제됩니다. 삭제할까요?`;
}

export type ParaParam = ParaCategory | "unassigned";

export interface ParaOption {
  value: ParaParam;
  label: string;
}

export const PARA_OPTIONS: ParaOption[] = [
  ...PARA_ORDER.map((c) => ({ value: c, label: PARA_TOKENS[c].label })),
  { value: "unassigned" as const, label: UNASSIGNED_TOKEN.label },
];

export function paraParamToCategory(value: ParaParam): ParaCategory | null {
  return value === "unassigned" ? null : value;
}

export function categoryToParaParam(category: ParaCategory | null): ParaParam {
  return category ?? "unassigned";
}

export interface FolderMoveOption {
  id: string | null;
  label: string;
}

export function folderMoveOptions(
  folders: { id: string; name: string }[],
): FolderMoveOption[] {
  return [
    { id: null, label: UNASSIGNED_TOKEN.label },
    ...folders.map((f) => ({ id: f.id, label: f.name })),
  ];
}

export function isDuplicateNameError(code: string | undefined): boolean {
  return code === "23505";
}
