// Shared types

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Sheet {
  id: string;
  name: string;
  question_count: number;
  solved_count: number;
  created_at: string;
  updated_at: string;
}

export interface DifficultyStats {
  total: number;
  solved: number;
}

export interface SheetStats {
  total: number;
  solved: number;
  by_difficulty: {
    Easy: DifficultyStats;
    Medium: DifficultyStats;
    Hard: DifficultyStats;
  };
}

export interface Question {
  id: string;
  leetcode_id: number;
  url: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  primary_topic: string;
  solved: boolean;
  solved_at: string | null;
}

export interface QuestionsResponse {
  questions: Question[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  stats: SheetStats;
  primary_topics: string[];
}

export type SortBy = "id" | "title" | "difficulty" | "primary_topic";
export type SortDir = "asc" | "desc";
export type SolvedFilter = "all" | "solved" | "unsolved";

export interface QuestionQuery {
  search?: string;
  difficulty?: string;       // comma-separated
  primary_topic?: string;    // comma-separated
  solved?: SolvedFilter;
  sort_by: SortBy;
  sort_dir: SortDir;
  page: number;
  page_size: number;
}

export interface Filters {
  search: string;
  difficulty: Set<"Easy" | "Medium" | "Hard">;
  primaryTopic: Set<string>;
  solved: SolvedFilter;
}
