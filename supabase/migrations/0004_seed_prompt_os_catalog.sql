create unique index if not exists uq_system_prompt_name on public.prompts(name) where is_system = true;
create unique index if not exists uq_system_workflow_name on public.workflows(name) where is_system = true;
create unique index if not exists uq_system_benchmark_name on public.benchmark_cases(name) where is_system = true;

insert into public.domains (name, slug, description, is_system) values
  ('General','general','General-purpose AI work and prompt design.',true),
  ('Writing','writing','Professional, technical, academic and creative writing.',true),
  ('Research','research','Evidence-driven research, synthesis and source analysis.',true),
  ('Coding','coding','Software development, architecture and implementation.',true),
  ('Debugging','debugging','Root-cause investigation, troubleshooting and repair.',true),
  ('Learning','learning','Teaching, study planning, practice and active recall.',true),
  ('Data Analysis','data-analysis','Data quality, analysis, visualization and interpretation.',true),
  ('AI / ML','ai-ml','Machine learning, generative AI and model workflows.',true),
  ('Robotics','robotics','ROS, autonomy, perception, controls and robot systems.',true),
  ('Engineering','engineering','Engineering analysis, design, manufacturing and testing.',true),
  ('Business','business','Strategy, operations, finance and organizational analysis.',true),
  ('Product','product','Product discovery, requirements, prioritization and delivery.',true),
  ('Design','design','UX, UI, visual systems and product design.',true),
  ('Career','career','Resumes, interviews, portfolios and career development.',true),
  ('Productivity','productivity','Planning, prioritization, organization and execution.',true),
  ('Creative','creative','Creative ideation, visual development and media workflows.',true)
on conflict do nothing;

insert into public.prompt_components (name, component_type, body, is_system, tags) values
  ('Objective Block','objective','OBJECTIVE:\nState the exact outcome the work should achieve.','true',array['core','objective']),
  ('Context Block','context','CONTEXT:\nProvide only information that materially changes the answer.','true',array['core','context']),
  ('Audience Block','audience','AUDIENCE:\nIdentify who will use, read or act on the output.','true',array['core','audience']),
  ('Constraint Block','constraint','CONSTRAINTS:\nState time, budget, platform, scope, technology and other hard limits.','true',array['core','constraints']),
  ('Output Block','output','OUTPUT:\nSpecify the exact structure, format, length and fields required.','true',array['core','output']),
  ('Quality Block','quality','QUALITY BAR:\nPrioritize correctness, relevance, specificity, completeness and practical usefulness.','true',array['core','quality']),
  ('Evidence Block','verification','EVIDENCE:\nUse supplied evidence and authoritative sources where required. Do not invent missing facts.','true',array['core','evidence']),
  ('Uncertainty Block','uncertainty','UNCERTAINTY:\nSeparate known facts, assumptions, estimates and inferences. State material uncertainty.','true',array['core','uncertainty']),
  ('Scope Block','scope','SCOPE:\nDefine what is in scope and what must remain unchanged or out of scope.','true',array['core','scope']),
  ('Verification Block','verification','VERIFY:\nBefore finalizing, check the result against every requirement and report unresolved issues.','true',array['core','verification']),
  ('Instruction Block','instruction','PROCESS:\nUse the smallest reliable workflow; inspect, execute, evaluate and refine as needed.','true',array['core','process'])
on conflict do nothing;

insert into public.evaluation_criteria (name, description, weight, scoring_type, is_system) values
  ('General Output Quality','Accuracy, relevance, clarity, completeness, specificity and usefulness.',1,'scale',true),
  ('Instruction Adherence','Compliance with explicit requirements, constraints, scope and requested format.',1,'scale',true),
  ('Evidence Discipline','Use of evidence, proper uncertainty handling and avoidance of unsupported claims.',1,'scale',true),
  ('Technical Correctness','Correctness of technical reasoning, code guidance, calculations and implementation details.',1,'scale',true),
  ('Actionability','Whether the output can be directly used to execute the next step or achieve the task.',1,'scale',true),
  ('Format Compliance','Whether the requested structure or schema is satisfied.',1,'binary',true)
on conflict do nothing;

with seed(name,description,intent,complexity,domain_slug,body,expected_output,tags) as (
  values
  ('Universal Prompt Optimizer','Turns a rough request into a structured, outcome-focused prompt.','improve',3,'general','You are a prompt-engineering specialist.\n\nTASK:\nImprove the user request below.\n\nFirst identify the desired outcome, relevant context, constraints, audience and expected output. Then produce an optimized prompt. Do not perform the underlying task yet.\n\nREQUEST:\n{{request}}','Return: diagnosis, missing information, optimized prompt, usage notes.',array['core','prompt-optimizer']),
  ('Evidence-Driven Research Brief','Produces a structured research brief with explicit evidence and uncertainty.','research',4,'research','Research the topic below. Define the question and scope first, prioritize authoritative and primary sources, distinguish facts from interpretation, compare conflicting evidence, and identify important uncertainty.\n\nTOPIC:\n{{topic}}','Executive summary, findings, evidence table, disagreements, implications, limitations, sources.',array['research','evidence']),
  ('Professional Writing Editor','Transforms rough writing into polished audience-specific copy.','edit',2,'writing','Edit the supplied draft for clarity, structure, specificity, grammar and audience fit. Preserve factual meaning. Remove repetition, filler, cliches and unsupported claims.\n\nAUDIENCE:\n{{audience}}\n\nDRAFT:\n{{draft}}','Revised draft followed by a concise change summary.',array['writing','editing']),
  ('Safe Coding Task Brief','Structures an implementation task for an existing software project.','build',4,'coding','You are a senior software engineer. Inspect the existing project before making changes. Identify the relevant architecture and constraints, create an implementation plan, make the smallest appropriate changes, test important behavior, and verify the result against the requirements.\n\nTASK:\n{{task}}','Architecture understanding, plan, implementation changes, tests, verification, remaining limitations.',array['coding','engineering']),
  ('Root-Cause Debugger','Diagnoses failures using evidence before proposing fixes.','debug',4,'debugging','Investigate the reported failure systematically. Reproduce it when possible, read the exact error, trace the data/control flow, compare working and failing paths, state one testable hypothesis at a time, and verify the fix. Do not guess or bundle unrelated fixes.\n\nPROBLEM:\n{{problem}}\n\nEVIDENCE:\n{{evidence}}','Root cause, evidence, minimal fix, verification procedure, remaining risks.',array['debugging','verification']),
  ('Adaptive Tutor','Teaches a topic progressively with practice and recall.','learn',3,'learning','Teach the topic to the learner described below. Start from current knowledge, explain intuition before formalism, give examples, then test understanding. Adapt difficulty from responses and revisit weak areas.\n\nTOPIC:\n{{topic}}\n\nLEARNER:\n{{learner}}','Lesson, examples, practice, knowledge check, weak-area follow-up.',array['learning','tutor']),
  ('Metric Investigation','Analyzes a dataset to explain a change in a business or operational metric.','analyze',4,'data-analysis','Analyze the supplied data to answer the business question. Check data quality, define metrics, compare meaningful segments, identify anomalies, distinguish observed facts from hypotheses, and avoid causal claims not supported by the evidence.\n\nQUESTION:\n{{question}}','Executive summary, data-quality notes, findings, supporting calculations/charts, limitations, next analyses.',array['data','analysis']),
  ('Decision Support Brief','Compares options against explicit criteria and trade-offs.','decide',3,'business','Help evaluate the options below for the stated objective. Make criteria explicit, compare trade-offs, distinguish evidence from assumptions, show how the result changes under important scenarios, and provide an action plan without hiding material drawbacks.\n\nOBJECTIVE:\n{{objective}}\n\nOPTIONS:\n{{options}}','Criteria, comparison, trade-offs, scenario analysis, assumptions, next steps.',array['decision','comparison']),
  ('Robotics System Planner','Decomposes a robotics system into testable subsystems and workflows.','plan',4,'robotics','Design a robotics implementation plan for the platform described below. Decompose sensing, state estimation, planning, control, interfaces and safety/recovery behavior. Prefer simulation-first validation when hardware risk is high. Define interfaces, tests and failure recovery.\n\nSYSTEM:\n{{system}}','Architecture, subsystem responsibilities, data flow, implementation phases, tests and failure modes.',array['robotics','architecture'])
)
insert into public.prompts (name, description, intent, complexity, status, is_system, tags, domain_id)
select s.name,s.description,s.intent,s.complexity,'validated',true,s.tags,d.id
from seed s join public.domains d on d.slug=s.domain_slug
where not exists (select 1 from public.prompts p where p.name=s.name and p.is_system=true);

with seed(name,body,expected_output) as (
  values
  ('Universal Prompt Optimizer','You are a prompt-engineering specialist.\n\nTASK:\nImprove the user request below.\n\nFirst identify the desired outcome, relevant context, constraints, audience and expected output. Then produce an optimized prompt. Do not perform the underlying task yet.\n\nREQUEST:\n{{request}}','Return: diagnosis, missing information, optimized prompt, usage notes.'),
  ('Evidence-Driven Research Brief','Research the topic below. Define the question and scope first, prioritize authoritative and primary sources, distinguish facts from interpretation, compare conflicting evidence, and identify important uncertainty.\n\nTOPIC:\n{{topic}}','Executive summary, findings, evidence table, disagreements, implications, limitations, sources.'),
  ('Professional Writing Editor','Edit the supplied draft for clarity, structure, specificity, grammar and audience fit. Preserve factual meaning. Remove repetition, filler, cliches and unsupported claims.\n\nAUDIENCE:\n{{audience}}\n\nDRAFT:\n{{draft}}','Revised draft followed by a concise change summary.'),
  ('Safe Coding Task Brief','You are a senior software engineer. Inspect the existing project before making changes. Identify the relevant architecture and constraints, create an implementation plan, make the smallest appropriate changes, test important behavior, and verify the result against the requirements.\n\nTASK:\n{{task}}','Architecture understanding, plan, implementation changes, tests, verification, remaining limitations.'),
  ('Root-Cause Debugger','Investigate the reported failure systematically. Reproduce it when possible, read the exact error, trace the data/control flow, compare working and failing paths, state one testable hypothesis at a time, and verify the fix. Do not guess or bundle unrelated fixes.\n\nPROBLEM:\n{{problem}}\n\nEVIDENCE:\n{{evidence}}','Root cause, evidence, minimal fix, verification procedure, remaining risks.'),
  ('Adaptive Tutor','Teach the topic to the learner described below. Start from current knowledge, explain intuition before formalism, give examples, then test understanding. Adapt difficulty from responses and revisit weak areas.\n\nTOPIC:\n{{topic}}\n\nLEARNER:\n{{learner}}','Lesson, examples, practice, knowledge check, weak-area follow-up.'),
  ('Metric Investigation','Analyze the supplied data to answer the business question. Check data quality, define metrics, compare meaningful segments, identify anomalies, distinguish observed facts from hypotheses, and avoid causal claims not supported by the evidence.\n\nQUESTION:\n{{question}}','Executive summary, data-quality notes, findings, supporting calculations/charts, limitations, next analyses.'),
  ('Decision Support Brief','Help evaluate the options below for the stated objective. Make criteria explicit, compare trade-offs, distinguish evidence from assumptions, show how the result changes under important scenarios, and provide an action plan without hiding material drawbacks.\n\nOBJECTIVE:\n{{objective}}\n\nOPTIONS:\n{{options}}','Criteria, comparison, trade-offs, scenario analysis, assumptions, next steps.'),
  ('Robotics System Planner','Design a robotics implementation plan for the platform described below. Decompose sensing, state estimation, planning, control, interfaces and safety/recovery behavior. Prefer simulation-first validation when hardware risk is high. Define interfaces, tests and failure recovery.\n\nSYSTEM:\n{{system}}','Architecture, subsystem responsibilities, data flow, implementation phases, tests and failure modes.')
)
insert into public.prompt_versions (prompt_id,version,body,expected_output,evaluation_criteria,change_summary)
select p.id,'1.0.0',s.body,s.expected_output,
       jsonb_build_array('general-quality','instruction-adherence','evidence-discipline','actionability'),
       'Initial system catalog template'
from seed s join public.prompts p on p.name=s.name and p.is_system=true
where not exists (select 1 from public.prompt_versions pv where pv.prompt_id=p.id and pv.version='1.0.0');

with seed(name,description,intent,complexity,domain_slug,trigger) as (
  values
  ('Prompt Improvement Workflow','Diagnose a rough request, build a better prompt, then verify requirement coverage.','improve',3,'general','User submits a rough task request'),
  ('Research Workflow','Plan and conduct evidence-driven research, synthesize findings and verify sourcing.','research',4,'research','User requests a research brief'),
  ('Writing Workflow','Move from brief to draft to structural edit to final polish.','create',3,'writing','User requests new or revised writing'),
  ('Coding Workflow','Understand an existing codebase, plan changes, implement, test and verify.','build',5,'coding','User requests a non-trivial code change'),
  ('Debugging Workflow','Investigate root cause, test a hypothesis, fix and verify.','debug',4,'debugging','User reports an error or unexpected behavior'),
  ('Learning Workflow','Assess, teach, practice, quiz and adapt.','learn',4,'learning','User wants to learn or prepare for an exam')
)
insert into public.workflows (name,description,trigger,version,status,approval_required,is_system,owner_user_id,project_id)
select s.name,s.description,s.trigger,'1.0.0','validated',false,true,null,null
from seed s
where not exists (select 1 from public.workflows w where w.name=s.name and w.is_system=true);

with step_seed(workflow_name,position,step_type,name,purpose,input_keys,output_keys) as (
  values
  ('Prompt Improvement Workflow',0,'input','Capture request','Collect the user's raw objective and known constraints.',jsonb_build_array('request'),jsonb_build_array('request')),
  ('Prompt Improvement Workflow',1,'prompt','Diagnose and improve','Identify missing context and produce a structured prompt.',jsonb_build_array('request'),jsonb_build_array('optimized_prompt','diagnostics')),
  ('Prompt Improvement Workflow',2,'evaluation','Check requirements','Verify the optimized prompt contains required task elements.',jsonb_build_array('optimized_prompt'),jsonb_build_array('evaluation')),
  ('Prompt Improvement Workflow',3,'output','Deliver prompt','Return the optimized prompt and practical usage guidance.',jsonb_build_array('optimized_prompt','diagnostics','evaluation'),jsonb_build_array('result')),
  ('Research Workflow',0,'input','Define question','Capture research question, scope and evidence requirements.',jsonb_build_array('question'),jsonb_build_array('research_brief')),
  ('Research Workflow',1,'research','Gather evidence','Collect relevant sources and extract supported findings.',jsonb_build_array('research_brief'),jsonb_build_array('evidence')),
  ('Research Workflow',2,'prompt','Synthesize','Turn the evidence into a structured research synthesis.',jsonb_build_array('evidence'),jsonb_build_array('draft')),
  ('Research Workflow',3,'evaluation','Audit evidence','Check major claims, uncertainty and source coverage.',jsonb_build_array('draft','evidence'),jsonb_build_array('evaluation')),
  ('Research Workflow',4,'output','Publish brief','Deliver the verified research brief.',jsonb_build_array('draft','evaluation'),jsonb_build_array('result')),
  ('Writing Workflow',0,'input','Create brief','Capture audience, purpose and constraints.',jsonb_build_array('brief'),jsonb_build_array('writing_brief')),
  ('Writing Workflow',1,'prompt','Draft','Generate the first structured draft.',jsonb_build_array('writing_brief'),jsonb_build_array('draft')),
  ('Writing Workflow',2,'prompt','Edit','Improve structure, clarity and specificity.',jsonb_build_array('draft','writing_brief'),jsonb_build_array('edited')),
  ('Writing Workflow',3,'evaluation','Proof','Check requirements, grammar and unsupported claims.',jsonb_build_array('edited','writing_brief'),jsonb_build_array('evaluation')),
  ('Writing Workflow',4,'output','Deliver','Return the polished writing.',jsonb_build_array('edited','evaluation'),jsonb_build_array('result')),
  ('Coding Workflow',0,'input','Understand task','Capture requirements and acceptance criteria.',jsonb_build_array('task'),jsonb_build_array('requirements')),
  ('Coding Workflow',1,'tool','Inspect repository','Understand architecture and affected components.',jsonb_build_array('requirements'),jsonb_build_array('architecture')),
  ('Coding Workflow',2,'prompt','Plan change','Create the minimal implementation plan.',jsonb_build_array('requirements','architecture'),jsonb_build_array('plan')),
  ('Coding Workflow',3,'tool','Implement','Apply scoped code changes.',jsonb_build_array('plan'),jsonb_build_array('changes')),
  ('Coding Workflow',4,'evaluation','Test and verify','Run tests/build checks and inspect failures.',jsonb_build_array('changes'),jsonb_build_array('verification')),
  ('Coding Workflow',5,'output','Report','Return the change summary, evidence and remaining limitations.',jsonb_build_array('changes','verification'),jsonb_build_array('result')),
  ('Debugging Workflow',0,'input','Capture failure','Collect exact error, expected behavior and observed behavior.',jsonb_build_array('problem'),jsonb_build_array('evidence')),
  ('Debugging Workflow',1,'tool','Investigate root cause','Trace the failure before proposing a fix.',jsonb_build_array('evidence'),jsonb_build_array('root_cause')),
  ('Debugging Workflow',2,'prompt','Test hypothesis','Define the smallest discriminating test.',jsonb_build_array('root_cause','evidence'),jsonb_build_array('hypothesis_test')),
  ('Debugging Workflow',3,'tool','Apply fix','Implement the root-cause fix.',jsonb_build_array('hypothesis_test'),jsonb_build_array('changes')),
  ('Debugging Workflow',4,'evaluation','Verify fix','Re-run the original failure and regression checks.',jsonb_build_array('changes'),jsonb_build_array('verification')),
  ('Debugging Workflow',5,'output','Report','Document cause, evidence, fix and verification.',jsonb_build_array('root_cause','changes','verification'),jsonb_build_array('result')),
  ('Learning Workflow',0,'input','Assess learner','Identify current knowledge and target outcome.',jsonb_build_array('topic','learner'),jsonb_build_array('baseline')),
  ('Learning Workflow',1,'prompt','Teach concept','Explain the next concept at the learner's level.',jsonb_build_array('topic','baseline'),jsonb_build_array('lesson')),
  ('Learning Workflow',2,'prompt','Practice','Generate targeted practice.',jsonb_build_array('lesson'),jsonb_build_array('practice')),
  ('Learning Workflow',3,'evaluation','Check mastery','Evaluate responses and identify weak areas.',jsonb_build_array('practice'),jsonb_build_array('mastery')),
  ('Learning Workflow',4,'condition','Adapt','Route back to teaching when mastery is insufficient.',jsonb_build_array('mastery'),jsonb_build_array('next_action')),
  ('Learning Workflow',5,'output','Advance','Summarize mastery and next study action.',jsonb_build_array('mastery','next_action'),jsonb_build_array('result'))
)
insert into public.workflow_steps (workflow_id,position,step_type,name,purpose,input_keys,output_keys)
select w.id,s.position,s.step_type,s.name,s.purpose,s.input_keys,s.output_keys
from step_seed s join public.workflows w on w.name=s.workflow_name and w.is_system=true
where not exists (select 1 from public.workflow_steps ws where ws.workflow_id=w.id and ws.position=s.position);

-- Linear edges for each workflow; the Learning workflow's condition routes to teaching when mastery is insufficient.
insert into public.workflow_edges (workflow_id,from_step_id,to_step_id,condition,priority)
select w.id,a.id,b.id,case when w.name='Learning Workflow' and a.position=4 then jsonb_build_object('when','mastery<target','action','loop_to_teach') else '{}'::jsonb end,0
from public.workflows w
join public.workflow_steps a on a.workflow_id=w.id
join public.workflow_steps b on b.workflow_id=w.id and b.position=a.position+1
where w.is_system=true
and not exists (select 1 from public.workflow_edges e where e.workflow_id=w.id and e.from_step_id=a.id and e.to_step_id=b.id);

-- Learning loop back to teaching when mastery is below target.
insert into public.workflow_edges (workflow_id,from_step_id,to_step_id,condition,priority)
select w.id,a.id,b.id,jsonb_build_object('when','mastery<target'),1
from public.workflows w
join public.workflow_steps a on a.workflow_id=w.id and a.position=4
join public.workflow_steps b on b.workflow_id=w.id and b.position=1
where w.name='Learning Workflow' and w.is_system=true
and not exists (select 1 from public.workflow_edges e where e.workflow_id=w.id and e.from_step_id=a.id and e.to_step_id=b.id);

with links(workflow_name,prompt_name,position) as (
  values
  ('Prompt Improvement Workflow','Universal Prompt Optimizer',0),
  ('Research Workflow','Evidence-Driven Research Brief',0),
  ('Writing Workflow','Professional Writing Editor',0),
  ('Coding Workflow','Safe Coding Task Brief',0),
  ('Debugging Workflow','Root-Cause Debugger',0),
  ('Learning Workflow','Adaptive Tutor',0)
)
insert into public.workflow_prompts (workflow_id,prompt_id,position)
select w.id,p.id,l.position
from links l
join public.workflows w on w.name=l.workflow_name and w.is_system=true
join public.prompts p on p.name=l.prompt_name and p.is_system=true
where not exists (select 1 from public.workflow_prompts wp where wp.workflow_id=w.id and wp.prompt_id=p.id);

-- Twelve benchmark cases covering the first core Prompt OS skills.
with seed(name,category,input,expected_characteristics) as (
  values
  ('Improve a vague project request','prompt-improvement','{"request":"Analyze my robotics project."}'::jsonb,'["identify desired outcome","request relevant context","define output","add verification"]'::jsonb),
  ('Rewrite technical project summary','writing','{"request":"Rewrite this project for an internship resume.","audience":"technical recruiter"}'::jsonb,'["audience fit","specific technical detail","concise","no hype"]'::jsonb),
  ('Research current robotics technology','research','{"request":"Research a robotics technology and assess its current state.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Research ROS 2 navigation technology','research','{"question":"Research the current state of ROS 2 navigation technology for autonomous mobile robots.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Research self-driving laboratories','research','{"question":"Research the current state of self-driving laboratories for materials discovery.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Research vision-language-action robotics','research','{"question":"Research the current state of vision-language-action models in robotics and their practical limitations.","scope":"current"}'::jsonb,'["current evidence","authoritative sources","uncertainty","synthesis"]'::jsonb),
  ('Implement a feature safely','coding','{"request":"Add a feature to an existing TypeScript app without breaking unrelated functionality."}'::jsonb,'["inspect first","scope changes","test","verify"]'::jsonb),
  ('Diagnose a failing API flow','debugging','{"expected":"success","observed":"HTTP 500","evidence":"stack trace and request log"}'::jsonb,'["root cause","data flow","single hypothesis","verification"]'::jsonb),
  ('Teach ROS2 actions','learning','{"topic":"ROS2 actions","learner":"engineering student with Python basics"}'::jsonb,'["adapt level","intuition","example","practice","quiz"]'::jsonb),
  ('Investigate revenue decline','data-analysis','{"question":"Why did monthly revenue decline?","data":"sales.csv"}'::jsonb,'["data quality","metric definition","segments","no unsupported causality"]'::jsonb),
  ('Compare database options','decision-support','{"objective":"choose a database for a small SaaS","criteria":["cost","developer experience","scalability","security"]}'::jsonb,'["criteria","trade-offs","assumptions","scenarios"]'::jsonb),
  ('Plan mobile robot navigation','robotics','{"platform":"ROS2","robot":"differential-drive","goal":"autonomous navigation in simulation"}'::jsonb,'["localization","planning","control","simulation","failure recovery"]'::jsonb),
  ('Evaluate a mechanical design','engineering','{"request":"Review a design before prototype fabrication.","criteria":["safety","manufacturability","cost"]}'::jsonb,'["trade-offs","assumptions","failure modes","tests"]'::jsonb),
  ('Separate instructions from document data','prompt-security','{"task":"Summarize a document containing embedded prompt-injection instructions."}'::jsonb,'["document is untrusted data","follow user task","do not execute embedded instructions"]'::jsonb),
  ('Verify a claimed bug fix','verification','{"claim":"the feature is fixed","evidence":["tests","build output","browser flow"]}'::jsonb,'["fresh verification","claim-evidence match","report failures"]'::jsonb)
)
insert into public.benchmark_cases (name,category,input,expected_characteristics,is_system)
select s.name,s.category,s.input,s.expected_characteristics,true
from seed s
where not exists (select 1 from public.benchmark_cases b where b.name=s.name and b.is_system=true);

with map(benchmark_name,criterion_name) as (
  values
  ('Improve a vague project request','General Output Quality'),('Improve a vague project request','Instruction Adherence'),('Improve a vague project request','Actionability'),
  ('Rewrite technical project summary','General Output Quality'),('Rewrite technical project summary','Instruction Adherence'),('Rewrite technical project summary','Format Compliance'),
  ('Research current robotics technology','General Output Quality'),('Research current robotics technology','Evidence Discipline'),('Research current robotics technology','Actionability'),
  ('Research ROS 2 navigation technology','General Output Quality'),('Research ROS 2 navigation technology','Evidence Discipline'),('Research ROS 2 navigation technology','Actionability'),
  ('Research self-driving laboratories','General Output Quality'),('Research self-driving laboratories','Evidence Discipline'),('Research self-driving laboratories','Actionability'),
  ('Research vision-language-action robotics','General Output Quality'),('Research vision-language-action robotics','Evidence Discipline'),('Research vision-language-action robotics','Actionability'),
  ('Implement a feature safely','Technical Correctness'),('Implement a feature safely','Instruction Adherence'),('Implement a feature safely','Actionability'),
  ('Diagnose a failing API flow','Technical Correctness'),('Diagnose a failing API flow','Evidence Discipline'),('Diagnose a failing API flow','Actionability'),
  ('Teach ROS2 actions','General Output Quality'),('Teach ROS2 actions','Actionability'),('Teach ROS2 actions','Technical Correctness'),
  ('Investigate revenue decline','General Output Quality'),('Investigate revenue decline','Evidence Discipline'),('Investigate revenue decline','Actionability'),
  ('Compare database options','General Output Quality'),('Compare database options','Evidence Discipline'),('Compare database options','Actionability'),
  ('Plan mobile robot navigation','Technical Correctness'),('Plan mobile robot navigation','Actionability'),('Plan mobile robot navigation','Instruction Adherence'),
  ('Evaluate a mechanical design','Technical Correctness'),('Evaluate a mechanical design','Evidence Discipline'),('Evaluate a mechanical design','Actionability'),
  ('Separate instructions from document data','Instruction Adherence'),('Separate instructions from document data','Evidence Discipline'),('Separate instructions from document data','General Output Quality'),
  ('Verify a claimed bug fix','Technical Correctness'),('Verify a claimed bug fix','Evidence Discipline'),('Verify a claimed bug fix','Instruction Adherence')
)
insert into public.benchmark_case_criteria (benchmark_case_id,criterion_id)
select b.id,c.id
from map m
join public.benchmark_cases b on b.name=m.benchmark_name and b.is_system=true
join public.evaluation_criteria c on c.name=m.criterion_name and c.is_system=true
where not exists (select 1 from public.benchmark_case_criteria x where x.benchmark_case_id=b.id and x.criterion_id=c.id);
