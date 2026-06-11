/* eslint-disable no-useless-escape, no-unused-vars */
// ─── Wrapper Code Generator ───────────────────────────────────────────────────
// Generates one self-contained runnable program that executes ALL test cases
// in a single compilation/run.  Each result is emitted as a JSON line on stdout.
//
// Output format (one JSON object per line):
//   {"index":0,"result":<raw return value>}
//   {"index":0,"error":"<message>"}
//
// ── Supported parameter / return types ───────────────────────────────────────
//   Primitives  : integer | float | string | boolean
//   Arrays      : integer[] | float[] | string[] | boolean[]
//   2-D arrays  : integer[][] | string[][]
//   Structures  : linkedlist | binarytree
//
// ── Structural types on the wire ─────────────────────────────────────────────
//   linkedlist  → stored as integer[]  e.g. [1,2,3,4,5]
//   binarytree  → stored as integer[]  e.g. [3,9,20,null,null,15,7]  (level-order, null = missing)
//
// The wrapper injects the helper class definitions + deserializers automatically.
// The comparator receives the result serialized back to the same array format.

// ─── Type helpers ─────────────────────────────────────────────────────────────

export const STRUCTURAL_TYPES = new Set(['linkedlist', 'binarytree']);

export const SUPPORTED_TYPES = [
  'integer', 'float', 'string', 'boolean',
  'integer[]', 'float[]', 'string[]', 'boolean[]',
  'integer[][]', 'string[][]',
  'linkedlist', 'binarytree',
];

function isStructural(type) {
  return STRUCTURAL_TYPES.has(type);
}

// ─── Java type mapping ────────────────────────────────────────────────────────

function javaType(type) {
  const map = {
    integer:       'int',
    float:         'double',
    string:        'String',
    boolean:       'boolean',
    'integer[]':   'int[]',
    'float[]':     'double[]',
    'string[]':    'String[]',
    'boolean[]':   'boolean[]',
    'integer[][]': 'int[][]',
    'string[][]':  'String[][]',
    linkedlist:    'ListNode',
    binarytree:    'TreeNode',
  };
  return map[type] ?? 'Object';
}

// ─── Argument literal emitters ────────────────────────────────────────────────
// For structural types: the array value is embedded as a literal integer[] /
// Integer[] and passed to the deserializer at runtime.

function toPythonLiteral(value, type) {
  if (value === null) return 'None';
  if (type === 'string')  return JSON.stringify(value);
  if (type === 'boolean') return value ? 'True' : 'False';
  if (type === 'integer' || type === 'float') return String(value);
  if (type === 'linkedlist' || type === 'binarytree') {
    // value is an array like [1,2,3] or [3,9,null,null,20]
    const pyList = '[' + value.map((v) => v === null ? 'None' : String(v)).join(', ') + ']';
    return type === 'linkedlist' ? `_build_list(${pyList})` : `_build_tree(${pyList})`;
  }
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

function toJsLiteral(value, type) {
  if (type === 'linkedlist') return `_buildList(${JSON.stringify(value)})`;
  if (type === 'binarytree') return `_buildTree(${JSON.stringify(value)})`;
  return JSON.stringify(value);
}

function toJavaLiteral(value, type) {
  if (value === null) return 'null';
  if (type === 'integer')  return String(value);
  if (type === 'float')    return value + 'd';
  if (type === 'string')   return JSON.stringify(value);
  if (type === 'boolean')  return value ? 'true' : 'false';
  if (type === 'integer[]')  return `new int[]{${value.join(', ')}}`;
  if (type === 'float[]')    return `new double[]{${value.map((v) => v + 'd').join(', ')}}`;
  if (type === 'string[]')   return `new String[]{${value.map((v) => JSON.stringify(v)).join(', ')}}`;
  if (type === 'boolean[]')  return `new boolean[]{${value.map((v) => v ? 'true' : 'false').join(', ')}}`;
  if (type === 'integer[][]') {
    return `new int[][]{${value.map((row) => `new int[]{${row.join(', ')}}`).join(', ')}}`;
  }
  if (type === 'string[][]') {
    return `new String[][]{${value.map((row) => `new String[]{${row.map((v) => JSON.stringify(v)).join(', ')}}`).join(', ')}}`;
  }
  if (type === 'linkedlist') {
    // Pass as Integer[] with nulls
    const items = value.map((v) => v === null ? 'null' : `(Integer)${v}`).join(', ');
    return `ListNode.build(new Integer[]{${items}})`;
  }
  if (type === 'binarytree') {
    const items = value.map((v) => v === null ? 'null' : `(Integer)${v}`).join(', ');
    return `TreeNode.build(new Integer[]{${items}})`;
  }
  return JSON.stringify(value);
}

// ─── Helper library snippets ──────────────────────────────────────────────────
// Each returns a string of source code that gets injected into the wrapper.

const PYTHON_HELPERS = `
# ── ListNode ──────────────────────────────────────────────────────────────────
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

def _build_list(vals):
    if not vals:
        return None
    head = ListNode(vals[0])
    cur = head
    for v in vals[1:]:
        cur.next = ListNode(v)
        cur = cur.next
    return head

def _list_to_arr(node):
    result = []
    while node:
        result.append(node.val)
        node = node.next
    return result

# ── TreeNode ──────────────────────────────────────────────────────────────────
class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

def _build_tree(vals):
    if not vals or vals[0] is None:
        return None
    root = TreeNode(vals[0])
    queue = [root]
    i = 1
    while queue and i < len(vals):
        node = queue.pop(0)
        if i < len(vals) and vals[i] is not None:
            node.left = TreeNode(vals[i])
            queue.append(node.left)
        i += 1
        if i < len(vals) and vals[i] is not None:
            node.right = TreeNode(vals[i])
            queue.append(node.right)
        i += 1
    return root

def _tree_to_arr(root):
    if not root:
        return []
    result, queue = [], [root]
    while queue:
        node = queue.pop(0)
        if node:
            result.append(node.val)
            queue.append(node.left)
            queue.append(node.right)
        else:
            result.append(None)
    # Trim trailing Nones
    while result and result[-1] is None:
        result.pop()
    return result
`;

const JS_HELPERS = `
// ── ListNode ─────────────────────────────────────────────────────────────────
class ListNode {
  constructor(val = 0, next = null) { this.val = val; this.next = next; }
}
function _buildList(vals) {
  if (!vals || !vals.length) return null;
  const head = new ListNode(vals[0]);
  let cur = head;
  for (let i = 1; i < vals.length; i++) { cur.next = new ListNode(vals[i]); cur = cur.next; }
  return head;
}
function _listToArr(node) {
  const r = [];
  while (node) { r.push(node.val); node = node.next; }
  return r;
}

// ── TreeNode ──────────────────────────────────────────────────────────────────
class TreeNode {
  constructor(val = 0, left = null, right = null) { this.val = val; this.left = left; this.right = right; }
}
function _buildTree(vals) {
  if (!vals || !vals.length || vals[0] === null) return null;
  const root = new TreeNode(vals[0]);
  const queue = [root];
  let i = 1;
  while (queue.length && i < vals.length) {
    const node = queue.shift();
    if (i < vals.length && vals[i] !== null) { node.left = new TreeNode(vals[i]); queue.push(node.left); }
    i++;
    if (i < vals.length && vals[i] !== null) { node.right = new TreeNode(vals[i]); queue.push(node.right); }
    i++;
  }
  return root;
}
function _treeToArr(root) {
  if (!root) return [];
  const result = [], queue = [root];
  while (queue.length) {
    const node = queue.shift();
    if (node) { result.push(node.val); queue.push(node.left, node.right); }
    else { result.push(null); }
  }
  while (result.length && result[result.length - 1] === null) result.pop();
  return result;
}
`;

// Java helpers are injected as static inner classes inside Solution
const JAVA_HELPERS = `
    // ── ListNode ──────────────────────────────────────────────────────────────
    static class ListNode {
        int val; ListNode next;
        ListNode(int v) { val = v; }
        static ListNode build(Integer[] vals) {
            if (vals == null || vals.length == 0) return null;
            ListNode head = new ListNode(vals[0]), cur = head;
            for (int i = 1; i < vals.length; i++) {
                if (vals[i] != null) { cur.next = new ListNode(vals[i]); cur = cur.next; }
            }
            return head;
        }
        static java.util.List<Integer> toList(ListNode n) {
            java.util.List<Integer> r = new java.util.ArrayList<>();
            while (n != null) { r.add(n.val); n = n.next; }
            return r;
        }
    }

    // ── TreeNode ──────────────────────────────────────────────────────────────
    static class TreeNode {
        int val; TreeNode left, right;
        TreeNode(int v) { val = v; }
        static TreeNode build(Integer[] vals) {
            if (vals == null || vals.length == 0 || vals[0] == null) return null;
            TreeNode root = new TreeNode(vals[0]);
            java.util.Queue<TreeNode> q = new java.util.LinkedList<>();
            q.add(root);
            int i = 1;
            while (!q.isEmpty() && i < vals.length) {
                TreeNode node = q.poll();
                if (i < vals.length && vals[i] != null) { node.left = new TreeNode(vals[i]); q.add(node.left); }
                i++;
                if (i < vals.length && vals[i] != null) { node.right = new TreeNode(vals[i]); q.add(node.right); }
                i++;
            }
            return root;
        }
        static java.util.List<Integer> toList(TreeNode root) {
            java.util.List<Integer> r = new java.util.ArrayList<>();
            if (root == null) return r;
            java.util.Queue<TreeNode> q = new java.util.LinkedList<>();
            q.add(root);
            while (!q.isEmpty()) {
                TreeNode n = q.poll();
                if (n != null) { r.add(n.val); q.add(n.left); q.add(n.right); }
                else { r.add(null); }
            }
            while (!r.isEmpty() && r.get(r.size()-1) == null) r.remove(r.size()-1);
            return r;
        }
    }
`;

// ─── Result serialisers – what to do with the raw return value ────────────────

// Python: convert result to JSON-serialisable form before json.dumps
function pythonSerialiseResult(returnType) {
  if (returnType === 'linkedlist') return '_list_to_arr(result)';
  if (returnType === 'binarytree') return '_tree_to_arr(result)';
  if (returnType === 'boolean')    return 'result';   // json.dumps handles bool → true/false
  return 'result';                                    // numbers, lists, strings all fine
}

// JS: convert result before JSON.stringify
function jsSerialiseResult(returnType) {
  if (returnType === 'linkedlist') return '_listToArr(result)';
  if (returnType === 'binarytree') return '_treeToArr(result)';
  return 'result';
}

// Java: expression that produces a JSON string from result
function javaSerialiseResult(returnType) {
  if (returnType === 'integer' || returnType === 'float') return `"{"result":" + result + "}"`;
  if (returnType === 'boolean')   return `"{"result":" + result + "}"`;
  if (returnType === 'string')    return `"{"result":"" + result.replace("\\\","\\\\\\\").replace("\"","\\\\\"") + ""}"`;
  if (returnType === 'linkedlist') return `listToJson(ListNode.toList(result))`;
  if (returnType === 'binarytree') return `listToJson(TreeNode.toList(result))`;
  // Arrays
  return `arrToJson(result)`;
}

// ─── Check if any param or returnType needs helper classes ────────────────────

function needsHelpers(question) {
  const types = [...question.params.map((p) => p.type), question.returnType];
  return types.some(isStructural);
}

// ─── Python wrapper ───────────────────────────────────────────────────────────

export function generatePythonWrapper(userCode, question, testCases) {
  const { functionName, params, returnType } = question;
  const helpers = needsHelpers(question) ? PYTHON_HELPERS : '';
  const serialise = pythonSerialiseResult(returnType);

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toPythonLiteral(tc.args[pi], p.type)).join(', ');
    return `
    try:
        _raw = ${functionName}(${argLiterals})
        _out = ${serialise.replace('result', '_raw')}
        print(json.dumps({"index":${i},"result":_out}, separators=(",",":")))
    except Exception as _e:
        print(json.dumps({"index":${i},"error":str(_e)}, separators=(",",":")))`;
  }).join('\n');

  return `import json, sys, collections
${helpers}
${userCode}

def _run_all():
${testBlocks}

_run_all()
`;
}

// ─── JavaScript wrapper ───────────────────────────────────────────────────────

export function generateJsWrapper(userCode, question, testCases) {
  const { functionName, params, returnType } = question;
  const helpers = needsHelpers(question) ? JS_HELPERS : '';
  const serialise = jsSerialiseResult(returnType);

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toJsLiteral(tc.args[pi], p.type)).join(', ');
    return `
  try {
    const _raw = ${functionName}(${argLiterals});
    const _out = ${serialise.replace('result', '_raw')};
    process.stdout.write(JSON.stringify({index:${i},result:_out}) + "\\n");
  } catch (_e) {
    process.stdout.write(JSON.stringify({index:${i},error:_e.message}) + "\\n");
  }`;
  }).join('\n');

  return `${helpers}
${userCode}

(function _runAll() {
${testBlocks}
})();
`;
}

// ─── Java wrapper ─────────────────────────────────────────────────────────────

export function generateJavaWrapper(userCode, question, testCases) {
  const { functionName, params, returnType } = question;
  const jReturnType = javaType(returnType);
  const helpers = needsHelpers(question) ? JAVA_HELPERS : '';

  const needsBoxing = returnType.endsWith('[]') || returnType.endsWith('[][]');

  const testBlocks = testCases.map((tc, i) => {
    const argLiterals = params.map((p, pi) => toJavaLiteral(tc.args[pi], p.type)).join(', ');
    return `
        try {
            ${jReturnType} _result = sol.${functionName}(${argLiterals});
            System.out.println(toJson(${i}, _result));
        } catch (Exception _e) {
            System.out.println("{\"index\":${i},\"error\":\"" + _e.getMessage().replace("\"","\\\\\"") + "\"}");
        }`;
  }).join('\n');

  // Box-array helper for primitive arrays → needed by deepToString
  const boxHelper = `
    static Object[] _boxArr(Object arr) {
        if (arr instanceof int[])     { int[] a=(int[])arr; Integer[] b=new Integer[a.length]; for(int i=0;i<a.length;i++)b[i]=a[i]; return b; }
        if (arr instanceof double[])  { double[] a=(double[])arr; Double[] b=new Double[a.length]; for(int i=0;i<a.length;i++)b[i]=a[i]; return b; }
        if (arr instanceof boolean[]) { boolean[] a=(boolean[])arr; Boolean[] b=new Boolean[a.length]; for(int i=0;i<a.length;i++)b[i]=a[i]; return b; }
        if (arr instanceof int[][])   { int[][] a=(int[][])arr; Integer[][] b=new Integer[a.length][]; for(int i=0;i<a.length;i++){b[i]=new Integer[a[i].length];for(int j=0;j<a[i].length;j++)b[i][j]=a[i][j];} return b; }
        return (Object[])arr;
    }
    static String _arrToJson(Object arr) {
        return java.util.Arrays.deepToString(_boxArr(arr)).replaceAll(", ",",");
    }
    static String _listToJson(java.util.List<?> list) {
        StringBuilder sb = new StringBuilder("[");
        for(int i=0;i<list.size();i++){Object v=list.get(i);sb.append(v==null?"null":v.toString());if(i<list.size()-1)sb.append(",");}
        return sb.append("]").toString();
    }`;

  // toJson overloads for each return type
  let toJsonMethod;
  if (returnType === 'integer' || returnType === 'float') {
    toJsonMethod = `static String toJson(int i, ${jReturnType} r){return "{\"index\":"+i+",\"result\":"+r+"}"; }`;
  } else if (returnType === 'boolean') {
    toJsonMethod = `static String toJson(int i, boolean r){return "{\"index\":"+i+",\"result\":"+r+"}"; }`;
  } else if (returnType === 'string') {
    toJsonMethod = `static String toJson(int i, String r){return "{\"index\":"+i+",\"result\":""+r.replace("\\\","\\\\\\\").replace("\"","\\\\\"")+"\"}";}`;
  } else if (returnType === 'linkedlist') {
    toJsonMethod = `static String toJson(int i, ListNode r){return "{\"index\":"+i+",\"result\":"+_listToJson(ListNode.toList(r))+"}";}`;
  } else if (returnType === 'binarytree') {
    toJsonMethod = `static String toJson(int i, TreeNode r){return "{\"index\":"+i+",\"result\":"+_listToJson(TreeNode.toList(r))+"}";}`;
  } else {
    // All array types
    toJsonMethod = `static String toJson(int i, ${jReturnType} r){return "{\"index\":"+i+",\"result\":"+_arrToJson(r)+"}";}`;
  }

  return `import java.util.*;

public class Solution {
    // ── Helper classes ────────────────────────────────────────────────────────
    ${helpers}

    // ── User code ─────────────────────────────────────────────────────────────
    ${userCode}

    // ── Judge harness ─────────────────────────────────────────────────────────
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
 * Generate a complete runnable program for ALL test cases in one compilation.
 *
 * @param {'python'|'javascript'|'java'} language
 * @param {string}   userCode   – user's function only (no main/stdin)
 * @param {object}   question   – { functionName, params, returnType }
 * @param {object[]} testCases  – array of { args, expected }
 * @returns {string} complete runnable source
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
