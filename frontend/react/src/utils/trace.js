export function getTraceDetail(step) {
  const results = step?.output?.results ?? [];
  if (step.tool === 'ticket_search') {
    return results.map((r) => `${r.ticket_id} (${(r.similarity * 100).toFixed(0)}% match) - ${r.failure_mode}, ${r.severity} - "${r.symptom.slice(0, 70)}..."`);
  }
  if (step.tool === 'bom_lookup') {
    return results.map((r) => `${r.component_id} - ${r.component_name} (${r.current_revision}, ${r.supplier})`);
  }
  if (step.tool === 'design_doc_search') {
    return results.map((r) => `${r.doc_id} - ${r.title}`);
  }
  if (step.tool === 'past_fix_retrieval') {
    return results.map((r) => `${r.fix_id} - ${(r.effectiveness_score * 100).toFixed(0)}% effective - ${r.fix_description.slice(0, 80)}...`);
  }
  return ['Grounded synthesis generated below'];
}

export function getProviderMeta(data) {
  const provider = data?.llm_provider || (data?.llm_used ? 'gemini' : 'rule_based');
  return {
    provider,
    label: {
      gemini: 'Gemini synthesis',
      openai: 'GPT synthesis',
      rule_based: 'offline rule-based synthesis'
    }[provider] ?? 'offline rule-based synthesis',
    className: {
      gemini: 'gemini',
      openai: 'openai',
      rule_based: 'rule'
    }[provider] ?? 'rule'
  };
}
