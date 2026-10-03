import type { Database, Json } from "@prompt-os/db-types";
import type { BenchmarkCase, EvaluationCriterion } from "@prompt-os/shared-types";
import { createClient } from "./supabase/server";

type BenchmarkRow = Database["public"]["Tables"]["benchmark_cases"]["Row"];
type CriterionRow = Database["public"]["Tables"]["evaluation_criteria"]["Row"];
type BenchmarkCriterionRow = Database["public"]["Tables"]["benchmark_case_criteria"]["Row"];

export interface SystemBenchmarkDefinition extends BenchmarkCase {
  weightOverrides: Record<string, number>;
}

function stringArray(value: Json | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function scoring(value: string): EvaluationCriterion["scoring"] {
  return value === "binary" || value === "reference" ? value : "scale";
}

function mapCriterion(row: CriterionRow): EvaluationCriterion {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    weight: Number(row.weight),
    scoring: scoring(row.scoring_type),
    isSystem: row.is_system,
  };
}

function mapBenchmark(
  row: BenchmarkRow,
  links: BenchmarkCriterionRow[],
): SystemBenchmarkDefinition {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    input: row.input,
    expectedCharacteristics: stringArray(row.expected_characteristics),
    goldenOutput: row.golden_output ?? undefined,
    criterionIds: links.map((link) => link.criterion_id),
    isSystem: true,
    weightOverrides: Object.fromEntries(
      links
        .filter((link) => link.weight_override !== null)
        .map((link) => [link.criterion_id, Number(link.weight_override)]),
    ),
  };
}

export async function getSystemEvaluationCriteria(): Promise<EvaluationCriterion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("evaluation_criteria")
    .select("id,name,description,weight,scoring_type,is_system,owner_user_id,created_at")
    .eq("is_system", true)
    .order("name", { ascending: true });

  if (error || !data) return [];
  return data.map(mapCriterion);
}

export async function getSystemBenchmarkCases(query = ""): Promise<SystemBenchmarkDefinition[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("benchmark_cases")
    .select("id,category,name,input,expected_characteristics,golden_output,created_at,updated_at,is_system,owner_user_id")
    .eq("is_system", true)
    .order("name", { ascending: true });

  if (error || !rows?.length) return [];

  const benchmarkIds = rows.map((row) => row.id);
  const { data: links, error: linkError } = await supabase
    .from("benchmark_case_criteria")
    .select("benchmark_case_id,criterion_id,weight_override")
    .in("benchmark_case_id", benchmarkIds);

  if (linkError) return [];

  const linksByBenchmark = new Map<string, BenchmarkCriterionRow[]>();
  for (const link of links ?? []) {
    const current = linksByBenchmark.get(link.benchmark_case_id) ?? [];
    current.push(link);
    linksByBenchmark.set(link.benchmark_case_id, current);
  }

  const normalizedQuery = query.trim().toLocaleLowerCase();
  return rows
    .map((row) => mapBenchmark(row, linksByBenchmark.get(row.id) ?? []))
    .filter((benchmark) => {
      if (!normalizedQuery) return true;
      return [
        benchmark.name,
        benchmark.category,
        ...benchmark.expectedCharacteristics,
      ].join(" ").toLocaleLowerCase().includes(normalizedQuery);
    });
}

export async function getSystemBenchmarkById(id: string): Promise<SystemBenchmarkDefinition | null> {
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  const benchmarks = await getSystemBenchmarkCases();
  return benchmarks.find((benchmark) => benchmark.id === normalizedId) ?? null;
}
