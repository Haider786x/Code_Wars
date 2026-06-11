/* eslint-disable no-unused-vars */
// ─── Judge Comparator ─────────────────────────────────────────────────────────
// After the sandbox executes the generated wrapper, this module:
//   1. Parses the raw stdout (one JSON line per test case)
//   2. Compares each actual result to its expected value server-side
//   3. Returns a structured verdict per test case
//
// All comparison happens here – the generated code just returns raw values.
//
// For linkedlist  → wrapper serialises to integer[]  → compared as arrays
// For binarytree  → wrapper serialises to integer[]  (level-order, nulls trimmed)
// For float/float[] → compared with 1e-5 tolerance

const FLOAT_TOLERANCE = 1e-5;

// ─── Deep equality with float tolerance ───────────────────────────────────────

function deepEqual(actual, expected) {
  // Both null / undefined
  if (actual == null && expected == null) return true;
  if (actual == null || expected == null) return false;

  const typeA = typeof actual;
  const typeE = typeof expected;

  // Float comparison with tolerance
  if (typeA === 'number' && typeE === 'number') {
    if (Number.isInteger(actual) && Number.isInteger(expected)) return actual === expected;
    return Math.abs(actual - expected) < FLOAT_TOLERANCE;
  }

  // Booleans and strings: strict
  if (typeA !== 'object' && typeE !== 'object') return actual === expected;

  // Arrays
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return false;
    return actual.every((v, i) => deepEqual(v, expected[i]));
  }

  // Plain objects
  if (typeA === 'object' && typeE === 'object' && !Array.isArray(actual) && !Array.isArray(expected)) {
    const keysA = Object.keys(actual);
    const keysE = Object.keys(expected);
    if (keysA.length !== keysE.length) return false;
    return keysA.every((k) => deepEqual(actual[k], expected[k]));
  }

  return false;
}

// ─── Stdout parser ────────────────────────────────────────────────────────────

/**
 * Parse the wrapper's stdout. Each non-empty line must be a JSON object:
 *   {"index":0,"result": <value>}
 *   {"index":0,"error": "<message>"}
 */
function parseStdout(stdout) {
  const results = new Map();
  const lines = (stdout ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (typeof obj.index === 'number') results.set(obj.index, obj);
    } catch (_) {
      // Non-JSON output (e.g. rogue print statement) – ignore
    }
  }
  return results;
}

// ─── Main comparator ──────────────────────────────────────────────────────────

/**
 * Compare the judge's raw stdout against the expected values for each test case.
 *
 * @param {string}   stdout    - raw stdout from the sandbox execution
 * @param {object[]} testCases - array of { args, expected } in the same order passed to generateWrapper
 * @param {string}   returnType - the question's returnType (e.g. 'integer[]')
 * @returns {object} verdict
 *   {
 *     passed: boolean,          // true only if ALL test cases pass
 *     total: number,
 *     passedCount: number,
 *     results: [
 *       {
 *         index: number,
 *         passed: boolean,
 *         actual: <any>,        // parsed actual return value
 *         expected: <any>,      // expected value from question
 *         error: string|null,   // runtime error message if any
 *       }
 *     ]
 *   }
 */
export function compareResults(stdout, testCases, returnType) {
  const parsed = parseStdout(stdout);
  const results = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc    = testCases[i];
    const line  = parsed.get(i);

    if (!line) {
      // No output for this test case (crash or missing index)
      results.push({
        index:    i,
        passed:   false,
        actual:   null,
        expected: tc.expected,
        error:    'No output produced for this test case',
      });
      continue;
    }

    if (line.error) {
      results.push({
        index:    i,
        passed:   false,
        actual:   null,
        expected: tc.expected,
        error:    line.error,
      });
      continue;
    }

    const actual  = line.result;
    const passed  = deepEqual(actual, tc.expected);

    results.push({
      index:    i,
      passed,
      actual,
      expected: tc.expected,
      error:    null,
    });
  }

  const passedCount = results.filter((r) => r.passed).length;

  return {
    passed:      passedCount === testCases.length,
    total:       testCases.length,
    passedCount,
    results,
  };
}

/**
 * Quick helper: get a human-readable summary string.
 */
export function verdictSummary(verdict) {
  if (verdict.passed) return `Accepted (${verdict.total}/${verdict.total})`;
  const firstFail = verdict.results.find((r) => !r.passed);
  if (firstFail?.error) return `Runtime Error: ${firstFail.error}`;
  return `Wrong Answer (${verdict.passedCount}/${verdict.total} passed)`;
}
