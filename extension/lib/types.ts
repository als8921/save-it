export type ParaCategory = "project" | "area" | "resource" | "archive";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  para_category: ParaCategory | null;
  created_at: string;
}

export const PARA_LABELS: Record<ParaCategory, string> = {
  project: "Projects",
  area: "Areas",
  resource: "Resources",
  archive: "Archives",
};

export const PARA_ORDER: ParaCategory[] = [
  "project",
  "area",
  "resource",
  "archive",
];
