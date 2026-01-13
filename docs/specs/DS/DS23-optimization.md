# DS23 - Optimization

## Summary
Defines the `Maximize` and `Minimize` pragmatic modes for finding optimal solutions within the Knowledge Base. These commands extend the constraint solving capabilities to search for variable bindings that maximize or minimize a specific objective function.

## Scope
- Syntax for optimization commands.
- Supported objective functions (attributes, aggregations).
- Integration with constraint solving (`Solve`).
- Output format.

## Syntax

Optimization commands follow the standard imperative pattern:

```cnl
Maximize <Objective> [Subject to <Constraints>].
Minimize <Objective> [Subject to <Constraints>].
```

### Objective Functions
The objective must evaluate to a numeric value.

1.  **Direct Attribute:**
    ```cnl
    Maximize the price of the product.
    ```
    *Context:* Requires a variable binding (e.g., `?product`) defined in the constraints or implied context.

2.  **Aggregation:**
    ```cnl
    Minimize the total weight of the selected items.
    ```
    *Supported Aggregations:*
    - `total of <Attribute>` / `sum of <Attribute>`
    - `average of <Attribute>`
    - `count of <Set>` / `number of <Set>`

### Constraints (Subject to)
The `Subject to` clause defines the search space, identical to the `Solve` command body.

```cnl
Maximize the capacity of ?truck
Subject to:
    ?truck is a Vehicle.
    ?truck is available.
```

If `Subject to` is omitted, the optimization runs over all entities where the objective function is defined (global scan).

## Semantics

### 1. Resolution
The system first converts the `Subject to` constraints into a `Solve` plan.
- **Input:** A constraint satisfaction problem (CSP).
- **Output:** A stream of valid variable assignments (tuples).

### 2. Evaluation
For each valid assignment tuple, the system evaluates the **Objective Function**.
- **Case: Single Variable Attribute:** The system looks up `attr(Subject)` in the numeric index.
- **Case: Aggregation:** The system computes the aggregate over the set of bound variables.

### 3. Selection
The system maintains the "best so far" tuple(s).
- `Maximize`: Keep tuple if `Score > CurrentMax`.
- `Minimize`: Keep tuple if `Score < CurrentMin`.

## Pragmatic Execution

### Command Output
The output of an optimization command is a **Result Set** (similar to `Solve`), containing the variable bindings that achieved the optimal score, plus the score itself.

**JSON Structure:**
```json
{
  "status": "success",
  "mode": "optimize",
  "objective": "maximize",
  "score": 450.5,
  "solutions": [
    {
      "truck": "Truck_001",
      "_score": 450.5
    }
  ]
}
```

### Errors
- `OPT001 - Indeterminate Objective`: The objective function relies on unbound variables.
- `OPT002 - Non-Numeric Objective`: The target attribute is not numeric.
- `OPT003 - No Feasible Solution`: The constraints cannot be satisfied (score is undefined).

## Examples

**Scenario: Logistics**
```cnl
Minimize the cost of ?route
Subject to:
    ?route is a DeliveryPath.
    ?route connects Warehouse_A to Customer_B.
    ?route is active.
```

**Scenario: Team Building**
```cnl
Maximize the total skill_level of ?team
Subject to:
    ?team is a Group.
    ?team has at least 3 members.
```

## Integration with Compiler
- The `Maximize`/`Minimize` keywords must be added to the Lexer/Parser as commands.
- The AST node `OptimizationCommand` will store:
    - `direction`: "max" | "min"
    - `objective`: AST Expression
    - `constraints`: List of Conditions (parsed from `Subject to` or implicitly the `where` clause style).
