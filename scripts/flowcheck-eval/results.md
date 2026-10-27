# Flowcheck Static Analysis Evaluation Report

Generated: 2026-10-27T13:46:24.462Z
Corpus: 30 valid workflows across 15 node types
Total Mutants: 193
Clean Corpus Errors: 0 (False Positive Rate = 0.00%)
Mean Analysis Latency: 0.271 ms

---

## Table III: Fault Detection Breakdown by Injected Fault Class

| Fault Class | Mutants | Runtime Failures | Flagged (Errors) | Flagged (E + W) | REP (Errors) | REP (E + W) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **typo** | 30 | 30 | 30 | 30 | **100.0%** | **100.0%** |
| **nonAncestor** | 27 | 27 | 26 | 27 | **96.3%** | **100.0%** |
| **unknownField** | 23 | 22 | 22 | 22 | **100.0%** | **100.0%** |
| **deletedVariable** | 30 | 30 | 26 | 29 | **86.7%** | **96.7%** |
| **typeMisuse** | 26 | 26 | 26 | 26 | **100.0%** | **100.0%** |
| **duplicateName** | 27 | 24 | 23 | 24 | **95.8%** | **100.0%** |
| **syntax** | 30 | 30 | 30 | 30 | **100.0%** | **100.0%** |

*REP = Runtime Error Prevention Rate (runtime failures caught / total runtime failures, max 100%)*

---

## Table IV: Ablation Study

| Configuration | Description | Mutants | Failures | Caught Failures | REP (Errors) | Clean FPR | Latency |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Full Flowcheck (Default)** | Sequential topological union must-scopes, full lattice, reachability BFS | 193 | 189 | 183 | **96.8%** | 0.0% | 0.271 ms |
| **Branch-Sensitive (Ablation C)** | Intersection over direct parents (must = ⋂ parents); emits false W1 on diamonds | 193 | 189 | 183 | **96.8%** | 0.0% | 0.282 ms |
| **Syntax-Only (Ablation A)** | Only flags root unknown variables (E1); ignores nested property schemas | 193 | 189 | 125 | **66.1%** | 0.0% | 0.195 ms |
| **No HTTP Sample (Ablation B)** | Treats HTTP response body as open/unknown without user-supplied schema | 193 | 189 | 161 | **85.2%** | 0.0% | 0.238 ms |

---

## Key Findings

1. **Zero False Positives on Clean Workflows**: Flowcheck achieves exactly **0.00% false error rate** on valid real-world DAG workflows with topological sequential union.
2. **Sub-millisecond Latency**: Static data-flow analysis runs in **~0.27 ms** on average per workflow, enabling instant real-time feedback during typing.
3. **Bounded & Accurate REP**: Runtime Error Prevention is accurately calculated over actual runtime failures and never exceeds 100%.
4. **DAG Topological Union**: Branch-sensitivity (intersection over direct parents) creates false warnings on diamond merges; Nodebase's sequential topological execution model guarantees all reachable ancestors execute, making union the sound model.
