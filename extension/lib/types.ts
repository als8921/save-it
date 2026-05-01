export type ParaCategory = "project" | "area" | "resource" | "archive";

export interface Folder {
  id: string;
  user_id: string;
  name: string;
  para_category: ParaCategory | null;
  created_at: string;
}

export interface Link {
  id: string;
  user_id: string;
  folder_id: string;
  url: string;
  title: string;
  description: string | null;
  priority: number;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
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
