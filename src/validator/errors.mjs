export class CnlError extends Error {
  constructor({ code, name, message, primaryToken, hint, offendingField }) {
    super(message);
    this.code = code;
    this.name = name;
    this.message = message;
    this.severity = "error";
    this.primaryToken = primaryToken;
    if (offendingField) {
      this.offendingField = offendingField;
    }
    this.hint = hint;
  }
}

const ERROR_CATALOG = {
  LEX001: {
    name: "InvalidCharacterError",
    message: "Invalid character.",
    hint: "Use IDENT, NUMBER, or STRING tokens and permitted punctuation.",
  },
  LEX002: {
    name: "UnterminatedStringError",
    message: "Unterminated string literal.",
    hint: "Close the string with a double quote.",
  },
  LEX003: {
    name: "KeywordAsIdentifierError",
    message: "Keyword used where an identifier is expected.",
    hint: "Choose a different name for the identifier.",
  },
  LEX004: {
    name: "InvalidNumberError",
    message: "Invalid number format.",
    hint: "Use 123 or 123.45.",
  },
  SYN001: {
    name: "UnexpectedTokenError",
    message: "Unexpected token in the current grammar position.",
    hint: "Check the triplet structure and keyword order.",
  },
  SYN002: {
    name: "UnexpectedEOFError",
    message: "Unexpected end of input.",
    hint: "Complete the statement (missing object/comparator/etc.).",
  },
  SYN003: {
    name: "MissingTerminatorError",
    message: "Statement is missing a terminator.",
    hint: "Add a period at the end.",
  },
  SYN004: {
    name: "InvalidParenthesesError",
    message: "Unbalanced parentheses.",
    hint: "Close the parentheses or remove them.",
  },
  SYN005: {
    name: "InvalidComparatorError",
    message: "Invalid comparator; expected a canonical comparator.",
    hint: "Use 'is equal to', 'is greater than', 'contains', or 'does not contain'.",
  },
  SYN006: {
    name: "InvalidCommandFormError",
    message: "Command form is missing a required clause.",
    hint: "Use the required form, such as 'find ... such that ...'.",
  },
  SYN007: {
    name: "TransitionRuleMissingOccursError",
    message: "Transition rule is missing the 'occurs' keyword.",
    hint: "Use 'When <event> occurs, then <effect>.'",
  },
  SYN008: {
    name: "HasFormDeterminismError",
    message: "Attribute form requires a determiner after 'has'.",
    hint: "Use 'has a <attribute> of <value>'.",
  },
  SYN009: {
    name: "InvalidNounPhraseStartError",
    message: "Noun phrase must start with a determiner or quantifier.",
    hint: "Start with a/an/the/every/all/no/some/at least/at most/another.",
  },
  SYN010: {
    name: "RelativePronounRepetitionError",
    message: "Relative clause chain is missing a repeated pronoun.",
    hint: "Repeat the pronoun: 'who ... and who ...'.",
  },
  SYN011: {
    name: "MixedBooleanOperatorsError",
    message:
      "Mixed 'and'/'or' without explicit grouping (both/either/neither/it is the case that/parentheses).",
    hint: "Rewrite using 'either ... or ...' or parentheses.",
  },
  SYN012: {
    name: "MixedRelativeBooleanOperatorsError",
    message:
      "Mixed boolean operators inside a relative restriction without explicit grouping.",
    hint: "Group explicitly with parentheses or use either/both forms.",
  },
  SYN013: {
    name: "ActionBlockMissingRequiredFieldError",
    message: "Action block is missing a required field.",
    hint: "A valid block must include both Action and Agent.",
  },
  SYN014: {
    name: "ActionBlockDuplicateFieldError",
    message: "Action block has a duplicate unique field.",
    hint: "Keep unique fields single and list multiple preconditions/effects.",
  },
  SYN015: {
    name: "MissingColonAfterLabelError",
    message: "Label is missing a colon.",
    hint: "Use the exact Label: form.",
  },
  SYN016: {
    name: "InvalidContextDirectiveError",
    message: "Invalid context directive format.",
    hint: "Use '--- CONTEXT: LogisticsNetwork ---'.",
  },
  SYN017: {
    name: "InvalidQuantifierNumberError",
    message: "Quantifier requires a number after 'at least' or 'at most'.",
    hint: "Use 'At least 2 users ...'.",
  },
};

export function createError(code, primaryToken, overrides = {}) {
  const def = ERROR_CATALOG[code];
  if (!def) {
    return new CnlError({
      code,
      name: overrides.name ?? "CnlError",
      message: overrides.message ?? "Unknown error.",
      primaryToken,
      hint: overrides.hint ?? "Check the input.",
      offendingField: overrides.offendingField,
    });
  }
  return new CnlError({
    code,
    name: overrides.name ?? def.name,
    message: overrides.message ?? def.message,
    primaryToken,
    hint: overrides.hint ?? def.hint,
    offendingField: overrides.offendingField,
  });
}
