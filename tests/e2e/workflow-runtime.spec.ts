import { test, expect, type Page } from "@playwright/test";

const baseURL = process.env.PROMPT_OS_BASE_URL?.trim();
const supabaseURL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
const email = process.env.PROMPT_OS_E2E_EMAIL?.trim();

function requireEnvironment() {
  for (const [name, value] of Object.entries({
    PROMPT_OS_BASE_URL: baseURL,
    NEXT_PUBLIC_SUPABASE_URL: supabaseURL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
    PROMPT_OS_E2E_EMAIL: email,
  })) {
    if (!value) throw new Error(`${name} is required for authenticated workflow E2E`);
  }
}

async function authenticate(page: Page) {
  requireEnvironment();
  const response = await fetch(`${supabaseURL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email: email!,
    }),
  });
  if (!response.ok) throw new Error(`Supabase admin.generateLink failed with HTTP ${response.status}`);

  const payload = await response.json() as {
    hashed_token?: string;
    verification_type?: string;
  };
  if (!payload.hashed_token || !payload.verification_type) {
    throw new Error("Supabase magic-link response did not contain a verification token");
  }

  const confirmURL = new URL("/auth/confirm", baseURL!);
  confirmURL.searchParams.set("token_hash", payload.hashed_token);
  confirmURL.searchParams.set("type", payload.verification_type);
  confirmURL.searchParams.set("next", "/workflows");

  await page.goto(confirmURL.toString());
  await expect(page).toHaveURL(/\/workflows(?:\?|$)/);
}

async function selectResearchWorkflow(page: Page) {
  const select = page.locator('select[name="workflowId"]');
  await expect(select).toBeVisible();
  await select.selectOption({ label: "Research Workflow · v1.0.0" });
  await expect(page.getByRole("heading", { name: "Research Workflow" })).toBeVisible();
}

async function workflowIdFromURL(page: Page): Promise<string> {
  const id = new URL(page.url()).searchParams.get("workflowId");
  if (!id) throw new Error("E2E did not receive a workflowId in the URL");
  return id;
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  requireEnvironment();
  const response = await fetch(`${supabaseURL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: secretKey!,
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`Supabase REST request failed with HTTP ${response.status}`);
  return response;
}

async function evaluationRunsForWorkflow(workflowId: string) {
  const response = await supabaseRequest(
    `evaluation_runs?select=id,workflow_version,benchmark_case_id,failure_codes&workflow_id=eq.${encodeURIComponent(workflowId)}`,
  );
  return await response.json() as Array<{
    id: string;
    workflow_version: string | null;
    benchmark_case_id: string | null;
    failure_codes: string[];
  }>;
}

async function cleanupWorkflow(workflowId: string) {
  const runs = await evaluationRunsForWorkflow(workflowId);
  for (const run of runs) {
    await supabaseRequest(`evaluation_run_scores?evaluation_run_id=eq.${encodeURIComponent(run.id)}`, { method: "DELETE" });
  }
  await supabaseRequest(`workflow_promotions?workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
  await supabaseRequest(`workflow_runs?workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
  await supabaseRequest(`evaluation_runs?workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
  await supabaseRequest(`workflow_edges?workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
  await supabaseRequest(`workflow_steps?workflow_id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
  await supabaseRequest(`workflows?id=eq.${encodeURIComponent(workflowId)}`, { method: "DELETE" });
}

test.beforeEach(async ({ page }) => {
  test.skip(!process.env.PROMPT_OS_E2E_ENABLED, "Live authenticated E2E is opt-in");
  await authenticate(page);
});

test("authenticated user can clone and execute the real Research Workflow", async ({ page }) => {
  let workflowId: string | undefined;
  try {
    await selectResearchWorkflow(page);
    await page.getByRole("button", { name: "Duplicate as editable" }).click();
    await expect(page).toHaveURL(/status=workflow_cloned/);
    await expect(page.getByText("Workflow cloned.")).toBeVisible();
    await expect(page.locator(".chip").filter({ hasText: "draft · v1.0.0" })).toBeVisible();
    workflowId = await workflowIdFromURL(page);

    const workflowInput = page.locator('textarea[name="inputJson"]');
    await workflowInput.fill(JSON.stringify({
      question: "Assess the current state of robotics technology using authoritative evidence.",
    }));
    await page.getByRole("button", { name: "Run workflow" }).click();

    await expect(page).toHaveURL(/status=completed/, { timeout: 5 * 60_000 });
    await expect(page.getByText(/Run history/)).toBeVisible();
    await expect(page.locator(".evaluation-run")).toHaveCount(1, { timeout: 30_000 });

    const runs = await evaluationRunsForWorkflow(workflowId);
    expect(runs).toHaveLength(0);

    const runRowsResponse = await supabaseRequest(
      `workflow_runs?select=id,workflow_version,status&workflow_id=eq.${encodeURIComponent(workflowId)}`,
    );
    const runRows = await runRowsResponse.json() as Array<{ id: string; workflow_version: string; status: string }>;
    expect(runRows).toHaveLength(1);
    expect(runRows[0].workflow_version).toBe("1.0.0");
    expect(runRows[0].status).toBe("completed");
  } finally {
    if (workflowId) await cleanupWorkflow(workflowId);
  }
});

test("real benchmark evidence is persisted against the cloned workflow version", async ({ page }) => {
  test.skip(process.env.PROMPT_OS_E2E_EVALUATE !== "true", "Enable PROMPT_OS_E2E_EVALUATE for model-backed benchmark evidence");
  let workflowId: string | undefined;
  try {
    await selectResearchWorkflow(page);
    await page.getByRole("button", { name: "Duplicate as editable" }).click();
    await expect(page).toHaveURL(/status=workflow_cloned/);
    workflowId = await workflowIdFromURL(page);

    await page.getByRole("button", { name: "Run benchmark suite" }).click();
    await expect(page).toHaveURL(/status=workflow_evaluated|status=model_failed|status=evaluation_failed/, { timeout: 20 * 60_000 });

    await expect(page.getByText(/Production promotion/)).toBeVisible();
    await expect(page.getByText(/successful runs/)).toBeVisible();
    await expect(page.getByText(/benchmarks/)).toBeVisible();

    if (new URL(page.url()).searchParams.get("status") === "workflow_evaluated") {
      const rows = await evaluationRunsForWorkflow(workflowId);
      expect(rows.length).toBeGreaterThanOrEqual(3);
      expect(rows.every((row) => row.workflow_version === "1.0.0")).toBe(true);
      expect(rows.every((row) => typeof row.benchmark_case_id === "string")).toBe(true);
      expect(rows.every((row) => row.failure_codes.length === 0)).toBe(true);

      const promotionStatus = await page.locator(".workflow__promotion").textContent();
      expect(promotionStatus).toMatch(/BLOCKED|ready/);
    }
  } finally {
    if (workflowId) await cleanupWorkflow(workflowId);
  }
});
