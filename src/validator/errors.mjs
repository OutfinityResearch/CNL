export class MixedBooleanOperatorsError extends Error {
  constructor(message = "Mixed boolean operators without explicit grouping.") {
    super(message);
    this.name = "MixedBooleanOperatorsError";
  }
}

export class MissingTerminatorError extends Error {
  constructor(message = "Statement is missing a terminator.") {
    super(message);
    this.name = "MissingTerminatorError";
  }
}

export class HasFormDeterminismError extends Error {
  constructor(message = "Attribute form requires a determiner after 'has'.") {
    super(message);
    this.name = "HasFormDeterminismError";
  }
}
