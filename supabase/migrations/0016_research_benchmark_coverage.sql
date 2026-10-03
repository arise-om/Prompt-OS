-- Add enough benchmark coverage for the Research Workflow to satisfy the default promotion gate.
-- These cases use the workflow entry contract directly: question + scope.

with seed(name, category, input, expected_characteristics) as (
  values
  ('Research ROS 2 navigation technology','research','{"question":"Research the current state of ROS 2 navigation technology for autonomous mobile robots.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Research self-driving laboratories','research','{"question":"Research the current state of self-driving laboratories for materials discovery.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Research vision-language-action robotics','research','{"question":"Research the current state of vision-language-action models in robotics and their practical limitations.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb)
)
insert into public.benchmark_cases (name, category, input, expected_characteristics, is_system)
select s.name, s.category, s.input, s.expected_characteristics, true
from seed s
where not exists (select 1 from public.benchmark_cases b where b.name=s.name and b.is_system=true);

with map(benchmark_name, criterion_name) as (
  values
  ('Research ROS 2 navigation technology','General Output Quality'),
  ('Research ROS 2 navigation technology','Evidence Discipline'),
  ('Research ROS 2 navigation technology','Actionability'),
  ('Research self-driving laboratories','General Output Quality'),
  ('Research self-driving laboratories','Evidence Discipline'),
  ('Research self-driving laboratories','Actionability'),
  ('Research vision-language-action robotics','General Output Quality'),
  ('Research vision-language-action robotics','Evidence Discipline'),
  ('Research vision-language-action robotics','Actionability')
)
insert into public.benchmark_case_criteria (benchmark_case_id, criterion_id)
select b.id, c.id
from map m
join public.benchmark_cases b on b.name=m.benchmark_name and b.is_system=true
join public.evaluation_criteria c on c.name=m.criterion_name and c.is_system=true
where not exists (select 1 from public.benchmark_case_criteria x where x.benchmark_case_id=b.id and x.criterion_id=c.id);
