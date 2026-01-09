export const SetOp = Object.freeze({
  AllEntities: "AllEntities",
  UnarySet: "UnarySet",
  EntitySet: "EntitySet",
  Intersect: "Intersect",
  Union: "Union",
  Not: "Not",
  Image: "Image",
  Preimage: "Preimage",
  NumFilter: "NumFilter",
  AttrEntityFilter: "AttrEntityFilter",
});

export const RelationOp = Object.freeze({
  BaseRelation: "BaseRelation",
  RestrictSubjects: "RestrictSubjects",
  RestrictObjects: "RestrictObjects",
  Compose: "Compose",
});

export const BoolOp = Object.freeze({
  Exists: "Exists",
  IsEmpty: "IsEmpty",
  Compare: "Compare",
});

export const NumberOp = Object.freeze({
  AttrValue: "AttrValue",
  Aggregate: "Aggregate",
});

function setPlan(op, payload = {}) {
  return { kind: "SetPlan", op, ...payload };
}

function relationPlan(op, payload = {}) {
  return { kind: "RelationPlan", op, ...payload };
}

function boolPlan(op, payload = {}) {
  return { kind: "BoolPlan", op, ...payload };
}

function numberPlan(op, payload = {}) {
  return { kind: "NumberPlan", op, ...payload };
}

export const Plans = {
  allEntities() {
    return setPlan(SetOp.AllEntities);
  },
  unarySet(unaryId) {
    return setPlan(SetOp.UnarySet, { unaryId });
  },
  entitySet(entityId) {
    return setPlan(SetOp.EntitySet, { entityId });
  },
  intersect(plans) {
    return setPlan(SetOp.Intersect, { plans });
  },
  union(plans) {
    return setPlan(SetOp.Union, { plans });
  },
  not(plan, universe) {
    return setPlan(SetOp.Not, { plan, universe });
  },
  image(predId, subjectSet) {
    return setPlan(SetOp.Image, { predId, subjectSet });
  },
  preimage(predId, objectSet) {
    return setPlan(SetOp.Preimage, { predId, objectSet });
  },
  numFilter(attrId, comparator, value) {
    return setPlan(SetOp.NumFilter, { attrId, comparator, value });
  },
  attrEntityFilter(attrId, valueSet) {
    return setPlan(SetOp.AttrEntityFilter, { attrId, valueSet });
  },
  baseRelation(predId) {
    return relationPlan(RelationOp.BaseRelation, { predId });
  },
  restrictSubjects(relation, subjectSet) {
    return relationPlan(RelationOp.RestrictSubjects, { relation, subjectSet });
  },
  restrictObjects(relation, objectSet) {
    return relationPlan(RelationOp.RestrictObjects, { relation, objectSet });
  },
  compose(left, right) {
    return relationPlan(RelationOp.Compose, { left, right });
  },
  exists(set) {
    return boolPlan(BoolOp.Exists, { set });
  },
  isEmpty(set) {
    return boolPlan(BoolOp.IsEmpty, { set });
  },
  compare(left, comparator, right) {
    return boolPlan(BoolOp.Compare, { left, comparator, right });
  },
  attrValue(attrId, subjectId) {
    return numberPlan(NumberOp.AttrValue, { attrId, subjectId });
  },
  aggregate(op, set, attrId = null) {
    return numberPlan(NumberOp.Aggregate, { aggregateOp: op, set, attrId });
  },
};
