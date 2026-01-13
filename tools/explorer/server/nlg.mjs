// Natural Language Generation for KB Explorer (DS17 Component A)

// Convert CamelCase to kebab-case for concepts: NonGuest -> non-guest
function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

export function formatEntityName(key) {
  if (!key) return '(unknown)';
  let clean = key;
  if (key.startsWith('E:')) clean = key.slice(2);
  else if (key.startsWith('L:')) clean = key.slice(2);
  // Things keep their original case, just replace underscores with spaces
  return clean.replace(/_/g, ' ');
}

export function formatPredicate(key) {
  if (!key) return '(unknown)';
  let clean = key.replace(/^P:/, '');
  if (clean.startsWith('passive:')) {
    const match = clean.match(/passive:(\w+)\|(\w+)/);
    if (match) return `is ${match[1]} ${match[2]}`;
  }
  if (clean.startsWith('aux:')) {
    clean = clean.replace('aux:', '');
  }
  return clean.split('|').join(' ');
}

export function formatCategory(key) {
  if (!key) return '(unknown)';
  const clean = key.replace(/^U:/, '');
  return camelToKebab(clean);
}

export function pluralize(word, count) {
  if (count === 1) return word;
  if (word.endsWith('s') || word.endsWith('x') || word.endsWith('ch') || word.endsWith('sh')) 
    return word + 'es';
  if (word.endsWith('y') && !/[aeiou]y$/.test(word)) 
    return word.slice(0, -1) + 'ies';
  return word + 's';
}

export function formatList(items, max = 5) {
  if (!items || items.length === 0) return '(none)';
  if (items.length === 1) return items[0];
  if (items.length <= max) {
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  }
  return items.slice(0, max).join(', ') + ` and ${items.length - max} more`;
}

export function formatSummary(stats) {
  const parts = [];
  if (stats.things > 0) parts.push(`${stats.things} ${pluralize('thing', stats.things)}`);
  if (stats.categories > 0) parts.push(`${stats.categories} ${pluralize('category', stats.categories)}`);
  if (stats.relationships > 0) parts.push(`${stats.relationships} ${pluralize('relationship', stats.relationships)}`);
  if (stats.rules > 0) parts.push(`${stats.rules} ${pluralize('rule', stats.rules)}`);
  if (parts.length === 0) return 'Empty knowledge base';
  return parts.join(', ');
}

// --- Learn Response Messages ---

export function learnMessage(text, changes) {
  if (!changes || changes.newFacts === 0) {
    return 'No changes made.';
  }
  
  const parts = [];
  
  // Try to describe what was learned
  if (changes.newEntities && changes.newEntities.length > 0) {
    if (changes.newCategories && changes.newCategories.length > 0) {
      // "John is a user" pattern
      const ent = changes.newEntities[0];
      const cat = changes.newCategories[0];
      parts.push(`${ent} is now a ${cat}`);
    } else if (changes.newRelationships && changes.newRelationships.length > 0) {
      // "John likes Pizza" pattern
      parts.push(`noted relationship`);
    }
  } else if (changes.newRules && changes.newRules > 0) {
    parts.push(`rule added`);
  }
  
  if (parts.length === 0) {
    return `✓ Applied (${changes.newFacts} ${pluralize('fact', changes.newFacts)}).`;
  }
  
  return `✓ Noted: ${parts.join('; ')}.`;
}

export function ruleAddedMessage(ruleText) {
  return `✓ Rule added: ${ruleText}`;
}

// --- Query Response Messages ---

export function queryResultMessage(result, queryCategory) {
  const items = result?.items ?? result?.entities ?? [];
  if (!items || items.length === 0) {
    if (queryCategory) {
      return `No ${pluralize(queryCategory, 2)} found.`;
    }
    return 'No results found.';
  }
  
  const names = items.map(e => formatEntityName(e.name || e.key));
  const count = result.count || names.length;
  
  if (queryCategory) {
    return `Found ${count} ${pluralize(queryCategory, count)}: ${formatList(names)}`;
  }
  return `Found ${count}: ${formatList(names)}`;
}

export function solveResultMessage(result) {
  if (!result) return 'No results found.';
  if (Array.isArray(result.entities) && result.entities.length > 0) {
    return queryResultMessage({ items: result.entities });
  }
  if (result.bindings) {
    const lines = Object.entries(result.bindings).map(([name, entries]) => {
      const items = Array.isArray(entries) ? entries.map((e) => formatEntityName(e.name || e.key)) : [];
      return `${name}: ${items.length > 0 ? items.join(', ') : '(none)'}`;
    });
    return lines.length > 0 ? lines.join('\n') : 'No results found.';
  }
  return 'No results found.';
}

// --- Proof Response Messages ---

export function proofResultMessage(result, subject, predicate) {
  if (!result) return 'Unable to verify.';
  
  if (result.value === true) {
    if (subject && predicate) {
      return `Yes, ${subject} is ${predicate}.`;
    }
    return 'Yes, this is true.';
  }
  
  if (subject && predicate) {
    return `No, ${subject} is not ${predicate}.`;
  }
  return 'No, this is not true.';
}

// --- Explain Response Messages ---

export function explainResultMessage(result) {
  if (!result) return 'Unable to explain.';
  
  const fact = result.fact || 'this fact';
  const just = result.justification;
  
  if (!just) {
    return `${fact} — no justification available.`;
  }
  
  if (just.kind === 'BaseFact') {
    return `${fact} because it was directly stated.`;
  }
  
  if (just.kind === 'DerivedFact' && just.ruleId !== undefined) {
    const premises = just.premises || [];
    if (premises.length > 0) {
      return `${fact} because:\n  • ${premises.map(p => `premise ${p}`).join('\n  • ')}\n  • Applied rule #${just.ruleId}`;
    }
    return `${fact} because of rule #${just.ruleId}.`;
  }
  
  return `${fact} — ${JSON.stringify(just)}`;
}

// --- Plan Response Messages ---

export function planResultMessage(result) {
  if (!result) return 'Unable to create plan.';
  
  if (result.status === 'satisfied') {
    return 'Goal is already satisfied. No actions needed.';
  }
  
  if (result.status === 'unsatisfied' || !result.steps || result.steps.length === 0) {
    return 'No plan found to achieve the goal.';
  }
  
  const steps = result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  return `Plan found:\n${steps}`;
}

// --- Simulate Response Messages ---

export function simulateResultMessage(result) {
  if (!result) return 'Unable to simulate.';
  
  const steps = result.steps || 0;
  if (result.states && result.states.length > 0) {
    return `Simulated ${steps} ${pluralize('step', steps)}. Final state has ${result.states[result.states.length - 1]?.factCount || 0} facts.`;
  }
  return `Simulated ${steps} ${pluralize('step', steps)}.`;
}

// --- Optimize Response Messages ---

export function optimizeResultMessage(result) {
  if (!result) return 'Unable to optimize.';
  
  if (result.status === 'optimal') {
    return `Optimal value: ${result.value}`;
  }
  if (result.status === 'feasible') {
    return `Best found value: ${result.value}`;
  }
  return `Optimization status: ${result.status}`;
}

// --- Error Messages ---

export function errorMessage(error) {
  if (!error) return 'An error occurred.';
  
  const msg = error.message || String(error);
  const hint = error.hint || getHintForCode(error.code);
  
  if (hint) {
    return `${msg}\n💡 Hint: ${hint}`;
  }
  return msg;
}

function getHintForCode(code) {
  const hints = {
    'SYN001': "Add 'a', 'an', or 'the' before the noun.",
    'SYN015': "Put a colon ':' after 'Rule' or 'Command'.",
    'CMP007': "Use specific names, not general descriptions.",
    'CMP018': "Use 'every' or 'all' for rules about categories."
  };
  return hints[code] || null;
}

// --- Format full result for output ---

export function formatResultMessage(result, context = {}) {
  if (!result) return null;
  
  switch (result.kind) {
    case 'QueryResult':
      return queryResultMessage(result, context.category);
    case 'SolveResult':
      return solveResultMessage(result);
    case 'ProofResult':
      return proofResultMessage(result, context.subject, context.predicate);
    case 'ExplainResult':
      return explainResultMessage(result);
    case 'PlanResult':
      return planResultMessage(result);
    case 'SimulationResult':
      return simulateResultMessage(result);
    case 'OptimizeResult':
      return optimizeResultMessage(result);
    default:
      return JSON.stringify(result, null, 2);
  }
}
