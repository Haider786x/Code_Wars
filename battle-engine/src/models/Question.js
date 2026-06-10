import mongoose, { Schema } from 'mongoose';

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * One typed parameter of the function the user must implement.
 * Supported types:
 *   Primitives : integer | float | string | boolean
 *   Arrays     : integer[] | float[] | string[] | boolean[]
 *   2-D arrays : integer[][] | string[][]
 *   Structures : linkedlist | binarytree
 *
 * Structural types are always stored as arrays on the wire:
 *   linkedlist  → integer[]   e.g. [1,2,3,4,5]
 *   binarytree  → integer[]   e.g. [3,9,20,null,null,15,7]  (level-order BFS)
 * The wrapper generator deserializes them automatically before calling the function.
 */
const ParamSchema = new Schema(
  {
    name:        { type: String, required: true },
    type:        { type: String, required: true },
    description: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * A visible example shown in the problem description panel.
 * args + expected are also used for the "Run" button (not judged for score).
 */
const ExampleSchema = new Schema(
  {
    args:        { type: [Schema.Types.Mixed], required: true }, // ordered, matches params
    expected:    { type: Schema.Types.Mixed,   required: true }, // expected return value
    explanation: { type: String, default: '' },
  },
  { _id: false }
);

/**
 * A hidden test case used for actual judging.
 * Never sent to the client before submission.
 */
const HiddenTestCaseSchema = new Schema(
  {
    args:     { type: [Schema.Types.Mixed], required: true },
    expected: { type: Schema.Types.Mixed,   required: true },
  },
  { _id: false }
);

/**
 * Per-language starter code shown in the editor.
 * Must contain only the function body – NO main/stdin boilerplate.
 * The judge wraps it automatically.
 */
const StarterCodeSchema = new Schema(
  {
    python:     { type: String, default: '' },
    javascript: { type: String, default: '' },
    java:       { type: String, default: '' },
  },
  { _id: false }
);

// ─── Main schema ─────────────────────────────────────────────────────────────

const QuestionSchema = new Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────────────
    slug:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    title:      { type: String, required: true },
    difficulty: { type: String, required: true, enum: ['Easy', 'Medium', 'Hard'] },
    tags:       { type: [String], default: [] },

    // ── Content (markdown, shown in problem panel) ─────────────────────────────
    description:       { type: String, required: true },
    constraints:       { type: [String], default: [] },   // array of constraint strings
    timeLimitMinutes:  { type: Number,   required: true, default: 10 },

    // ── Function contract ─────────────────────────────────────────────────────
    functionName: { type: String, required: true },     // e.g. "twoSum"
    params:       { type: [ParamSchema], required: true }, // ordered param list
    returnType:   { type: String, required: true },     // e.g. "integer[]"

    // ── Test cases (split into visible examples + hidden judge cases) ──────────
    examples:        { type: [ExampleSchema],        default: [] }, // shown in UI
    hiddenTestCases: { type: [HiddenTestCaseSchema], default: [] }, // judged only

    // ── Editor starter code ───────────────────────────────────────────────────
    starterCode: { type: StarterCodeSchema, default: () => ({}) },

    // ── Moderation ────────────────────────────────────────────────────────────
    approved:    { type: Boolean, default: false },
    suggestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    pings:       [{ type: Schema.Types.ObjectId, ref: 'User' }],
    submits:     [{ type: Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

QuestionSchema.index({ difficulty: 1, approved: 1 });
QuestionSchema.index({ slug: 1 }, { unique: true });
QuestionSchema.index({ tags: 1 });

const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);
export default Question;
