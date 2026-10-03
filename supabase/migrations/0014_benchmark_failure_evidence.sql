-- Preserve benchmark identity for failed evaluations without requiring criterion scores.
-- Successful benchmark evaluations retain the exact version binding introduced previously.

create or replace function public.create_evaluation_run(
  p_prompt_version_id uuid,
  p_workflow_id uuid,
  p_benchmark_case_id uuid,
  p_actual_output jsonb,
  p_scores jsonb,
  p_failure_codes text[],
  p_reviewer_notes text
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_prompt_version_id uuid;
  v_workflow_id uuid;
  v_workflow_version text;
  v_benchmark_case_id uuid;
  v_run_id uuid;
  v_audit_snapshot jsonb;
  v_scores jsonb := coalesce(p_scores, '{}'::jsonb);
  v_overall numeric := 0;
  v_total_weight numeric := 0;
  v_existing_scores integer := 0;
  v_expected_scores integer := 0;
  v_invalid jsonb;
  v_unknown jsonb;
  v_missing jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication required';
  end if;

  if jsonb_typeof(v_scores) is distinct from 'object' then
    raise exception 'evaluation scores must be a JSON object';
  end if;
  if p_actual_output is null then
    raise exception 'actual output is required';
  end if;

  if p_prompt_version_id is not null then
    select pv.id,
           jsonb_build_object(
             'score', pv.audit_score,
             'findings', pv.audit_findings,
             'missingSections', pv.audit_missing_sections
           )
      into v_prompt_version_id, v_audit_snapshot
    from public.prompt_versions pv
    join public.prompts p on p.id = pv.prompt_id
    where pv.id = p_prompt_version_id
      and (p.is_system = true or p.owner_user_id = v_user_id);

    if v_prompt_version_id is null then
      raise exception 'prompt version not found or not accessible';
    end if;

    if v_audit_snapshot->>'score' is null then
      v_audit_snapshot := null;
    end if;
  end if;

  if p_workflow_id is not null then
    select id, version into v_workflow_id, v_workflow_version
    from public.workflows
    where id = p_workflow_id
      and (is_system = true or owner_user_id = v_user_id);
    if v_workflow_id is null then
      raise exception 'workflow not found or not accessible';
    end if;
  end if;

  if p_benchmark_case_id is not null then
    select id into v_benchmark_case_id
    from public.benchmark_cases
    where id = p_benchmark_case_id
      and (is_system = true or owner_user_id = v_user_id);
    if v_benchmark_case_id is null then
      raise exception 'benchmark case not found or not accessible';
    end if;

    if cardinality(coalesce(p_failure_codes, '{}'::text[])) = 0 then
    select count(*) into v_expected_scores
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id);

    select count(*) into v_existing_scores
    from jsonb_object_keys(v_scores) as key
    where key <> 'overall';

    if v_existing_scores <> v_expected_scores then
      raise exception 'evaluation scores must include exactly one score per benchmark criterion';
    end if;

    select jsonb_agg(key) into v_unknown
    from jsonb_object_keys(v_scores) as key
    where key <> 'overall'
      and not exists (
        select 1
        from public.benchmark_case_criteria bcc
        where bcc.benchmark_case_id = v_benchmark_case_id
          and bcc.criterion_id::text = key
      );
    if v_unknown is not null then
      raise exception 'evaluation contains unknown benchmark criteria: %', v_unknown::text;
    end if;

    select jsonb_agg(c.id::text) into v_missing
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and not (v_scores ? c.id::text);
    if v_missing is not null then
      raise exception 'evaluation is missing benchmark criteria: %', v_missing::text;
    end if;

    select jsonb_agg(jsonb_build_object('id', c.id, 'score', v_scores->>(c.id::text)))
      into v_invalid
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and (
        jsonb_typeof(v_scores->c.id::text) is distinct from 'number'
        or ((v_scores->>c.id::text)::numeric < 0)
        or ((v_scores->>c.id::text)::numeric > 100)
        or (c.scoring_type = 'binary' and ((v_scores->>c.id::text)::numeric not in (0, 100)))
      );
    if v_invalid is not null then
      raise exception 'invalid evaluation scores: %', v_invalid::text;
    end if;

    select
      coalesce(sum((v_scores->>(c.id::text))::numeric * coalesce(bcc.weight_override, c.weight)), 0),
      coalesce(sum(coalesce(bcc.weight_override, c.weight)), 0)
      into v_overall, v_total_weight
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id)
      and coalesce(bcc.weight_override, c.weight) > 0;

    if v_total_weight > 0 then
      v_overall := round(v_overall / v_total_weight, 6);
    else
      v_overall := 0;
    end if;

    v_scores := jsonb_set(v_scores, '{overall}', to_jsonb(v_overall), true);
    end if;
  else
    if jsonb_object_length(v_scores) > 0 then
      raise exception 'criterion scores require a benchmark case';
    end if;
  end if;

  insert into public.evaluation_runs (
    owner_user_id,
    prompt_version_id,
    workflow_id,
    workflow_version,
    benchmark_case_id,
    actual_output,
    scores,
    failure_codes,
    reviewer_notes,
    prompt_audit_snapshot
  ) values (
    v_user_id,
    v_prompt_version_id,
    v_workflow_id,
    v_workflow_version,
    v_benchmark_case_id,
    p_actual_output,
    v_scores,
    coalesce(p_failure_codes, '{}'::text[]),
    nullif(trim(coalesce(p_reviewer_notes, '')), ''),
    v_audit_snapshot
  ) returning id into v_run_id;

  if v_benchmark_case_id is not null and cardinality(coalesce(p_failure_codes, '{}'::text[])) = 0 then
    insert into public.evaluation_run_scores (evaluation_run_id, criterion_id, score, rationale)
    select
      v_run_id,
      c.id,
      (v_scores->>(c.id::text))::numeric,
      null
    from public.benchmark_case_criteria bcc
    join public.evaluation_criteria c on c.id = bcc.criterion_id
    where bcc.benchmark_case_id = v_benchmark_case_id
      and (c.is_system = true or c.owner_user_id = v_user_id);
  end if;

  return v_run_id;
end;
$$;

revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from public;
revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from anon;
revoke execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) from service_role;
grant execute on function public.create_evaluation_run(uuid,uuid,uuid,jsonb,jsonb,text[],text) to authenticated;