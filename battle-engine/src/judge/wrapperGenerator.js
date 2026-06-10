// ─── Wrapper Code Generator ───────────────────────────────────────────────────
// Generates one self-contained runnable program that executes ALL test cases
// in a single compilation.  Each test case's result is emitted as a JSON line
// on stdout so the Node.js comparator can do all comparison logic server-side.
//
// Output format (one JSON object per line, one per test case):
//   {"index":0,"result":<raw return value as JSON>}
//   {"index":1,"result":<raw return value as JSON>}
//   ...
//
// If the user's function throws, the line becomes:
//   {"index":0,"error":"<message>"}
//
// Supported types:
//   integer | float | string | boolean
//   integer[] | float[] | string[] | boolean[]
//   integer[][] | string[][]

// ─── Argument literal emitters (embed args directly in source code) ───────────

function toPythonLiteral(value, type) {
  if (value === null) return 'None';
  if (type === 'string')  return JSON.stringify(value);
  if (type === 'boolean') return value ? 'True' : 'False';
  if (type === 'integer' || type === 'float') return String(value);
  if (type.endsWith('[][]')) {
    const inner = type.slice(0, -4);
    return '[' + value.map((row) => '[' + row.map((v) => toPythonLiteral(v, inner)).join(', ') + ']').join(', ') + ']';
  }
  if (type.endsWith('[]')) {
    const inner = type.slice(0, -2);
    return '[' + value.map((v) => toPythonLiteral(v, inner)).join(', ') + ']';
  }
  return JSON.stringify(value);
}

function toJsLiteral(value) {
  // All JS values round-trip cleanly through JSON
  return JSON.stringify(value);
}

function toJavaLiteral(value, type) {
  if (value === null) return 'null';
  if (type === 'integer')  return String(value);
  if (type === 'float')    return value + 'd';           // use double literals
  if (type === 'string')   return JSON.stringify(value);
  if (type === 'boolean')  return value ? 'true' : 'false';
  if (type === 'integer[]') return `new int[]{${value.join(', ')}}`;
  if (type === 'float[]')   return `new double[]{${value.map((v) => v + 'd').join(', ')}}`;
  if (type === 'string[]')  return `new String[]{${value.map((v) => JSON.stringify(v)).join(', ')}}`;
  if (type === 'boolean[]') return `new boolean[]{${value.map((v) => v ? 'true' : 'false').join(', ')}}`;
  if (type === 'integer[][]') {
    const rows = value.map((row) => `new int[]{${row.join(', ')}}`);
    return `new int[][]{${rows.join(', ')}}`;
  }
  if (type === 'string[][]') {
    const rows = value.map((row) => `new String[]{${row.map((v) => JSON.stringify(v)).join(', ')}}`);
    return `new String[][]{${rows.join(', ')}}`;
  }
  return JSON.stringify(value);
}

function javaType(type) {
  const map = {
    integer:      'int',
    float:        'double',
    string:       'String',
    boolean:      'boolean',
    'integer[]':  'int[]',
    'float[]':    'double[]',
    'string[]':   'String[]',
    'boolean[]':  'boolean[]',
    'integer[][]': 'int[][]',
    'string[][]': 'String[][]',
  };
  return map[type] ?? 'Object';
}

// ─── Result-to-JSON serialisers (embedded in generated code) ─────────────────
// Each snippet converts the raw return value to a JSON string for stdout.

function pythonResultToJson(returnType) {
  if (returnType === 'boolean') return 'str(result).lower()';  // "true"/"false"
  if (returnType === 'float')   return 'repr(result)';
  // lists, integers, strings all round-trip through json.dumps
  return '__import__("json").dumps(result, separators=(",", ":"))\n'
    + '        if not isinstance(result, str) else __import__("json").dumps(result)';
}

function jsResultToJson() {
  return 'JSON.stringify(result)';
}

// Java: use Arrays.deepToString for all array types → then strip brackets/spaces
// for non-nested; use Gson-style manual for primitives.
function javaResultToJson(returnType) {
  if (returnType === 'boolean')      return 'String.valueOf(result)';
  if (returnType === 'integer')      return 'String.valueOf(result)';
  if (returnType === 'float')        return 'String.valueOf(result)';
  if (returnType === 'string')       return '"\\\"" + result.replace("\\\"", "\\\\\\\"") + "\\\""';
  // All array types: use Arrays.deepToString which handles 1D and 2D correctly
  // Then convert "[1, 2, 3]" → "[1,2,3]" to match JSON
  if (returnType.endsWith('[]') || returnType.endsWith('[][]')) {
    return 'java.util.Arrays.deepToString(result instanceof Object[] ? (Object[]) result : boxArray(result)).replaceAll(", ", ",")';
  }
  return 'String.valueOf(result)';
}

// ─── Python wrapper ───────────────────────────────────────────────────────────

export function generatePythonWrapper(userCode, question, testCases) {
  const { functionName, params } = question;

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toPythonLiteral(tc.args[pi], p.type)).join(', ');
    return `
    try:
        result = ${functionName}(${argLiterals})
        print(__import__("json").dumps({"index":${i},"result":result}, separators=(",",":")))
    except Exception as e:
        print(__import__("json").dumps({"index":${i},"error":str(e)}, separators=(",","：")))`;
  }).join('\n');

  return `import json, sys

${userCode}

def _run_all():
${testBlocks}

_run_all()
`;
}

// ─── JavaScript wrapper ───────────────────────────────────────────────────────

export function generateJsWrapper(userCode, question, testCases) {
  const { functionName, params } = question;

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toJsLiteral(tc.args[pi])).join(', ');
    return `
  try {
    const result = ${functionName}(${argLiterals});
    process.stdout.write(JSON.stringify({index:${i},result}) + "\\n");
  } catch (e) {
    process.stdout.write(JSON.stringify({index:${i},error:e.message}) + "\\n");
  }`;
  }).join('\n');

  return `${userCode}

(function _runAll() {
${testBlocks}
})();
`;
}

// ─── Java wrapper ─────────────────────────────────────────────────────────────

export function generateJavaWrapper(userCode, question, testCases) {
  const { functionName, params, returnType } = question;
  const jReturnType = javaType(returnType);
  const paramDecls  = params.map((p) => `${javaType(p.type)} ${p.name}`).join(', ');
  const needsBoxing = returnType.endsWith('[]') || returnType.endsWith('[][]');

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toJavaLiteral(tc.args[pi], p.type)).join(', ');
    return `
        try {
            ${jReturnType} result = sol.${functionName}(${argLiterals});
            System.out.println(toJson(${i}, result));
        } catch (Exception e) {
            System.out.println("{\\"index\\":${i},\\"error\\":\\"" + e.getMessage() + "\\"}");
        }`;
  }).join('\n');

  // Helper method to convert primitive arrays to Object[] for deepToString
  const boxHelper = needsBoxing ? `
    static Object[] boxArray(Object arr) {
        if (arr instanceof int[]) {
            int[] a = (int[]) arr;
            Integer[] b = new Integer[a.length];
            for (int i = 0; i < a.length; i++) b[i] = a[i];
            return b;
        }
        if (arr instanceof double[]) {
            double[] a = (double[]) arr;
            Double[] b = new Double[a.length];
            for (int i = 0; i < a.length; i++) b[i] = a[i];
            return b;
        }
        if (arr instanceof boolean[]) {
            boolean[] a = (boolean[]) arr;
            Boolean[] b = new Boolean[a.length];
            for (int i = 0; i < a.length; i++) b[i] = a[i];
            return b;
        }
        if (arr instanceof int[][]) {
            int[][] a = (int[][]) arr;
            Integer[][] b = new Integer[a.length][];
            for (int i = 0; i < a.length; i++) {
                b[i] = new Integer[a[i].length];
                for (int j = 0; j < a[i].length; j++) b[i][j] = a[i][j];
            }
            return b;
        }
        return (Object[]) arr;
    }` : '';

  const toJsonMethod = returnType === 'string'
    ? `static String toJson(int i, String r) { return "{\\"index\\":" + i + ",\\"result\\":\\"" + r.replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"}"; }`
    : returnType === 'boolean'
      ? `static String toJson(int i, boolean r) { return "{\\"index\\":" + i + ",\\"result\\":" + r + "}"; }`
      : returnType === 'integer' || returnType === 'float'
        ? `static String toJson(int i, ${jReturnType} r) { return "{\\"index\\":" + i + ",\\"result\\":" + r + "}"; }`
        : `static String toJson(int i, ${jReturnType} r) {
        String s = java.util.Arrays.deepToString(boxArray(r)).replaceAll(", ", ",");
        return "{\\"index\\":" + i + ",\\"result\\":" + s + "}";
    }`;

  return `public class Solution {
    // ── User code ──────────────────────────────────────────────────────────────
    ${userCode}

    // ── Judge harness ──────────────────────────────────────────────────────────
    ${toJsonMethod}
    ${boxHelper}

    public static void main(String[] args) {
        Solution sol = new Solution();
${testBlocks}
    }
}
`;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Generate a complete runnable program that runs ALL provided test cases in one
 * compilation/execution and emits one JSON result line per test case.
 *
 * @param {'python'|'javascript'|'java'} language
 * @param {string}   userCode   - user's function body only (no main / stdin)
 * @param {object}   question   - { functionName, params, returnType }
 * @param {object[]} testCases  - array of { args, expected }
 * @returns {string} complete runnable source code
 */
export function generateWrapper(language, userCode, question, testCases) {
  const cases = Array.isArray(testCases) ? testCases : [testCases];
  switch (language) {
    case 'python':     return generatePythonWrapper(userCode, question, cases);
    case 'javascript': return generateJsWrapper(userCode, question, cases);
    case 'java':       return generateJavaWrapper(userCode, question, cases);
    default: throw new Error(`Unsupported language: ${language}`);
  }
}
