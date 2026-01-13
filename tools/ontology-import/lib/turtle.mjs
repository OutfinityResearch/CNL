const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";

function stripComment(line) {
  const src = String(line || "");
  let inIri = false;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (inIri) {
      if (ch === ">") inIri = false;
      continue;
    }
    if (ch === "<") {
      inIri = true;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "#") {
      return src.slice(0, i);
    }
  }
  return src;
}

function isWhitespace(ch) {
  return ch === " " || ch === "\t" || ch === "\n" || ch === "\r";
}

function tokenizeTurtle(text) {
  const tokens = [];
  const src = String(text || "");
  let i = 0;

  function isPunct(ch) {
    return ch === ";" || ch === "," || ch === ".";
  }

  function isLangChar(ch) {
    return /[A-Za-z0-9-]/.test(ch);
  }

  while (i < src.length) {
    const ch = src[i];
    if (isWhitespace(ch)) {
      i += 1;
      continue;
    }
    if (isPunct(ch)) {
      tokens.push({ type: "punct", value: ch });
      i += 1;
      continue;
    }
    if (ch === "<") {
      const start = i;
      i += 1;
      let iri = "";
      while (i < src.length && src[i] !== ">") {
        iri += src[i];
        i += 1;
      }
      if (src[i] !== ">") {
        throw new Error(`Unterminated IRI: ${src.slice(start, Math.min(start + 40, src.length))}`);
      }
      i += 1;
      tokens.push({ type: "iri", value: iri });
      continue;
    }
    if (ch === '"') {
      i += 1;
      let value = "";
      while (i < src.length) {
        const current = src[i];
        if (current === "\\") {
          const next = src[i + 1];
          if (next) {
            value += "\\" + next;
            i += 2;
            continue;
          }
        }
        if (current === '"') {
          i += 1;
          break;
        }
        value += current;
        i += 1;
      }
      // Optional language tag or datatype.
      let lang = null;
      if (src[i] === "@") {
        i += 1;
        let tag = "";
        while (i < src.length && isLangChar(src[i])) {
          tag += src[i];
          i += 1;
        }
        if (tag) lang = tag.toLowerCase();
      } else if (src[i] === "^" && src[i + 1] === "^") {
        // Skip datatype annotation: ^^<iri> or ^^prefix:name
        i += 2;
        if (src[i] === "<") {
          i += 1;
          while (i < src.length && src[i] !== ">") i += 1;
          if (src[i] === ">") i += 1;
        } else {
          while (i < src.length && !isWhitespace(src[i]) && !isPunct(src[i])) i += 1;
        }
      }

      // Tolerate any trailing token fragments until whitespace/punctuation.
      while (i < src.length && !isWhitespace(src[i]) && !isPunct(src[i])) i += 1;

      tokens.push({ type: "literal", value, lang });
      continue;
    }
    // word / prefixed name / keyword
    let word = "";
    while (i < src.length && !isWhitespace(src[i]) && !";,.".includes(src[i])) {
      word += src[i];
      i += 1;
    }
    if (word) tokens.push({ type: "word", value: word });
  }

  return tokens;
}

function parsePrefixLine(line, prefixMap) {
  const trimmed = stripComment(line).trim();
  if (!trimmed) return false;
  const match = trimmed.match(/^@prefix\s+([A-Za-z][\w-]*)\s*:\s*<([^>]+)>\s*\.\s*$/i);
  if (!match) return false;
  const prefix = match[1];
  const iri = match[2];
  prefixMap.set(prefix, iri);
  return true;
}

function expandTerm(token, prefixMap) {
  if (!token) return null;
  if (token.type === "iri") return token.value;
  if (token.type === "literal") return { literal: token.value, lang: token.lang || null };
  if (token.type !== "word") return null;

  const value = token.value;
  if (value === "a") return `${RDF}type`;
  if (value.startsWith("_:")) return { blank: value };
  if (value.startsWith("[")) return { blank: value };

  const colon = value.indexOf(":");
  if (colon !== -1) {
    const prefix = value.slice(0, colon);
    const local = value.slice(colon + 1);
    const base = prefixMap.get(prefix);
    if (base) return base + local;
  }

  // bare name is not valid in Turtle for IRI terms, but accept it as-is.
  return value;
}

function shouldIgnoreNode(node) {
  if (!node) return true;
  if (typeof node === "object" && (node.blank || node.list)) return true;
  return false;
}

export function parseTurtleToTriples(text) {
  const prefixMap = new Map();
  prefixMap.set("rdf", RDF);
  prefixMap.set("rdfs", "http://www.w3.org/2000/01/rdf-schema#");
  prefixMap.set("owl", "http://www.w3.org/2002/07/owl#");
  prefixMap.set("xsd", "http://www.w3.org/2001/XMLSchema#");
  prefixMap.set("skos", "http://www.w3.org/2004/02/skos/core#");

  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const nonPrefixLines = [];
  for (const line of lines) {
    if (parsePrefixLine(line, prefixMap)) continue;
    const cleaned = stripComment(line);
    if (cleaned.trim()) nonPrefixLines.push(cleaned);
  }

  const flat = nonPrefixLines.join("\n");
  const tokens = tokenizeTurtle(flat);

  const triples = [];
  let i = 0;

  function peek() {
    return tokens[i] ?? null;
  }
  function consume() {
    const t = peek();
    i += 1;
    return t;
  }

  while (i < tokens.length) {
    // subject
    const subjTok = consume();
    if (!subjTok) break;
    if (subjTok.type === "punct" && subjTok.value === ".") continue;
    const subject = expandTerm(subjTok, prefixMap);
    if (shouldIgnoreNode(subject)) {
      // Skip until '.' to avoid desync
      while (i < tokens.length && !(peek().type === "punct" && peek().value === ".")) consume();
      if (peek()) consume();
      continue;
    }

    // predicate + objects lists, with ; and , expansions
    let currentPredicate = null;
    while (i < tokens.length) {
      const next = peek();
      if (!next) break;
      if (next.type === "punct" && next.value === ".") {
        consume();
        break;
      }
      if (next.type === "punct" && next.value === ";") {
        consume();
        currentPredicate = null;
        continue;
      }
      if (next.type === "punct" && next.value === ",") {
        consume();
        // same predicate continues
        if (!currentPredicate) {
          // malformed, skip object token and continue
          consume();
          continue;
        }
        const obj = expandTerm(consume(), prefixMap);
        if (!shouldIgnoreNode(obj)) triples.push({ subject, predicate: currentPredicate, object: obj });
        continue;
      }

      if (!currentPredicate) {
        currentPredicate = expandTerm(consume(), prefixMap);
        if (shouldIgnoreNode(currentPredicate)) {
          currentPredicate = null;
          continue;
        }
        const obj = expandTerm(consume(), prefixMap);
        if (!shouldIgnoreNode(obj)) triples.push({ subject, predicate: currentPredicate, object: obj });
        continue;
      }

      // Another object for the same predicate without comma (tolerant)
      const obj = expandTerm(consume(), prefixMap);
      if (!shouldIgnoreNode(obj)) triples.push({ subject, predicate: currentPredicate, object: obj });
    }
  }

  return triples;
}
