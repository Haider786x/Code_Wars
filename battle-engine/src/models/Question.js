import mongoose, { Schema } from 'mongoose';

const QuestionSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, required: true, enum: ['Easy', 'Medium', 'Hard'] },
    task: { type: String, required: true },
    input_format: { type: String, required: true },
    constraints: { type: String, required: true },
    output_format: { type: String, required: true },
    time: { type: Number, required: true },
    examples: [
      {
        input: { type: String, required: true },
        output: { type: String, required: true },
        explanation: { type: String, required: true },
      },
    ],
    test_cases: [
      {
        input: { type: String, required: true },
        output: {
          type: [String],
          required: true,
          validate: {
            validator: (arr) => arr.length > 0,
            message: 'At least one output is required for each test case',
          },
        },
      },
    ],
    template: {
      type: Object,
      required: true,
      default: {},
    },
    approved: {
      type: Boolean,
      default: false,
    },
    suggestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    pings: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    submits: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    tags: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true },
);

QuestionSchema.index({ time: 1 });

const Question = mongoose.models.Question || mongoose.model('Question', QuestionSchema);

export default Question;
