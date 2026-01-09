function createError(code, message, primaryToken) {
  return {
    code,
    name: "DictionaryError",
    message,
    severity: "error",
    primaryToken: primaryToken ?? "EOF",
    hint: "Check BaseDictionary declaration syntax.",
  };
}

export function createDictionaryState() {
  return {
    predicates: new Map(),
    attributes: new Map(),
    types: new Map(),
    errors: [],
  };
}

function getOrCreatePredicate(state, key) {
  if (!state.predicates.has(key)) {
    state.predicates.set(key, { key, arity: null, domain: [], range: [] });
  }
  return state.predicates.get(key);
}

function getOrCreateAttribute(state, key) {
  if (!state.attributes.has(key)) {
    state.attributes.set(key, {
      key,
      valueType: null,
      functional: null,
      comparators: new Set(),
      domain: [],
    });
  }
  return state.attributes.get(key);
}

function getOrCreateType(state, key) {
  if (!state.types.has(key)) {
    state.types.set(key, { key, parent: null });
  }
  return state.types.get(key);
}

export function applyDictionaryStatement(node, state) {
  if (!node) return;
  const target = node.kind === "Statement" ? node.sentence : node;

  switch (target.kind) {
    case "PredicateDeclaration": {
      const def = getOrCreatePredicate(state, target.key);
      if (def.arity && def.arity !== target.arity) {
        state.errors.push(createError("DICT001", "Predicate arity conflict.", target.key));
      }
      def.arity = target.arity;
      return;
    }
    case "PredicateDomainDeclaration": {
      const def = getOrCreatePredicate(state, target.key);
      def.domain.push(target.domain);
      return;
    }
    case "PredicateRangeDeclaration": {
      const def = getOrCreatePredicate(state, target.key);
      def.range.push(target.range);
      return;
    }
    case "AttributeDeclaration": {
      const def = getOrCreateAttribute(state, target.key);
      if (def.valueType && def.valueType !== target.valueType) {
        state.errors.push(createError("DICT002", "Attribute value type conflict.", target.key));
      }
      def.valueType = target.valueType;
      return;
    }
    case "AttributeCardinalityDeclaration": {
      const def = getOrCreateAttribute(state, target.key);
      def.functional = target.functional;
      return;
    }
    case "AttributeComparatorDeclaration": {
      const def = getOrCreateAttribute(state, target.key);
      def.comparators.add(target.comparator);
      return;
    }
    case "TypeDeclaration": {
      const def = getOrCreateType(state, target.key);
      def.parent = target.parent ?? def.parent;
      return;
    }
    default:
      state.errors.push(
        createError("DICT000", "Unsupported dictionary declaration.", target.kind)
      );
  }
}

export function applyDictionaryContext(context, state) {
  const items = context?.items ?? context?.statements ?? [];
  items.forEach((item) => applyDictionaryStatement(item, state));
}
