// Roadmap data from the 89-day plan. Day 1 = 13 Nov 2026, Day 89 = 9 Feb 2027.
window.START_DATE = Date.UTC(2026, 10, 13);
window.BASE_DAYS = 89;
window.TOTAL_DAYS = 89;
const BASE_PHASES = [
  { n: 1, name: 'Foundation and assessment', from: 1, to: 14,
    milestone: 'Strong foundation, updated career profiles and a list of potential startup problems.',
    ai: ['Python OOP and advanced concepts', 'FastAPI, REST, Pydantic: build one API', 'Git, Linux, debugging practice'],
    job: ['Resume, LinkedIn, GitHub review', 'Research target companies (goal: 20)', 'Python, SQL, DSA revision (5-6 problems)'],
    startup: ['Research customer problems (goal: 10)', 'Research competitors (goal: 5)'] },
  { n: 2, name: 'LLM Engineering', from: 15, to: 28,
    milestone: 'One working LLM application and initial customer research.',
    ai: ['Transformer fundamentals', 'Tokens and context windows', 'LLM APIs and structured output: build an app', 'Prompt engineering: test prompts'],
    job: ['Apply for suitable jobs (12 this phase)', 'Referral outreach (4 contacts)', 'DSA and SQL (8 problems)'],
    startup: ['Interview potential customers (5 interviews)'] },
  { n: 3, name: 'RAG Engineering', from: 29, to: 42,
    milestone: 'A functional RAG project and three promising business ideas.',
    ai: ['Embeddings: implement', 'Vector databases: FAISS / ChromaDB', 'Document chunking: implement', 'Hybrid retrieval and reranking', 'RAG evaluation: measure retrieval quality'],
    job: ['Job applications (12 this phase)', 'Mock interview (2 this phase)'],
    startup: ['Compare business opportunities', 'Shortlist 3 ideas'] },
  { n: 4, name: 'Agentic AI and business selection', from: 43, to: 56,
    milestone: 'One agentic AI project and one selected startup opportunity.',
    ai: ['Agent architecture', 'Tool calling: implement', 'LangGraph: build a workflow', 'Agent memory and state'],
    job: ['Job applications (12 this phase)', 'DSA (8 problems)'],
    startup: ['Customer validation (10-15 cumulative interviews)', 'Select 1 business idea'] },
  { n: 5, name: 'Production AI Engineering', from: 57, to: 70,
    milestone: 'An AI project with production-oriented reliability features and a working SaaS MVP.',
    ai: ['Evaluation and benchmarking', 'Guardrails and validation', 'Logging and monitoring', 'API security practice'],
    job: ['Applications (10 this phase)', 'Mock interviews (2 this phase)'],
    startup: ['MVP development: core features', 'User testing: first testers'] },
  { n: 6, name: 'Deployment and market validation', from: 71, to: 84,
    milestone: 'One deployed portfolio project and a tested startup MVP.',
    ai: ['Docker: containerise project', 'AWS / cloud deployment', 'CI/CD: basic pipeline', 'Performance and cost optimisation'],
    job: ['Applications (10 this phase)', 'Interview preparation (2 mocks)', 'Referrals (4 contacts)'],
    startup: ['MVP testing: real user feedback', 'Pricing: test willingness to pay'] },
  { n: 7, name: 'Final review', from: 85, to: 89,
    milestone: 'A clear career position, a technical portfolio and a validated startup direction.',
    ai: ['Finalise GitHub documentation', 'Prepare project demonstrations'],
    job: ['Review applications and interview pipeline', 'Revise technical interview concepts'],
    startup: ['Analyse customer feedback', 'Decide next product improvements', 'Review the 89-day journey'] },
];

const BASE_TARGETS = {
  job: [['Application', 65, 'Applications'], ['Referral', 20, 'Referral connections'], ['DSA', 38, 'DSA problems'], ['Mock', 12, 'Mock interviews']],
  startup: [['Problem', 10, 'Customer problems'], ['Idea', 3, 'Ideas shortlisted'], ['Interview', 15, 'Customer interviews'], ['MVP', 1, 'MVP built']],
};

// Scale the 89-day roadmap and targets to any challenge length (14-365 days).
window.setPlan = function (n) {
  n = Math.max(14, Math.min(365, Math.round(Number(n)) || BASE_DAYS));
  window.TOTAL_DAYS = n;
  let prev = 0;
  window.PHASES = BASE_PHASES.map((p, i) => {
    const to = i === BASE_PHASES.length - 1 ? n : Math.max(prev + 1, Math.round((p.to * n) / BASE_DAYS));
    const out = { ...p, from: prev + 1, to };
    prev = to;
    return out;
  });
  const k = n / BASE_DAYS;
  const scale = (list) => list.map(([t, goal, label]) => [t, Math.max(1, Math.round(goal * k)), label]);
  window.TARGETS = { job: scale(BASE_TARGETS.job), startup: scale(BASE_TARGETS.startup) };
};
setPlan(BASE_DAYS);

window.buildDays = function (userId, n = TOTAL_DAYS) {
  setPlan(n);
  const rows = [];
  for (const p of PHASES) {
    for (let d = p.from; d <= p.to; d++) {
      const i = d - p.from;
      rows.push({
        user_id: userId, day: d, phase: p.n,
        date: new Date(START_DATE + (d - 1) * 864e5).toISOString().slice(0, 10),
        ai_task: p.ai[i % p.ai.length], job_task: p.job[i % p.job.length], startup_task: p.startup[i % p.startup.length],
      });
    }
  }
  return rows;
};
