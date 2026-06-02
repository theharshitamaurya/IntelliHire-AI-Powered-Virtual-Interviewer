const Joi = require("joi");

const teacherEvaluationSchema = Joi.object({
  feedback: Joi.string().required(),
  status: Joi.string()
    .valid("correct", "partially-correct", "incorrect")
    .required(),
  score: Joi.number().min(0).max(100).required(),
  competencies: Joi.object({
    technical: Joi.number().min(0).max(100),
    clarity: Joi.number().min(0).max(100),
    confidence: Joi.number().min(0).max(100),
    conciseness: Joi.number().min(0).max(100),
    engagement: Joi.number().min(0).max(100),
  }),
  followUp: Joi.string().allow("", null),
});

const defaultEvaluation = {
  feedback: "Unable to evaluate response at this time.",
  status: "partially-correct",
  score: 50,
  competencies: {
    technical: 50,
    clarity: 50,
    confidence: 50,
    conciseness: 50,
    engagement: 50,
  },
  followUp: "",
};

function validateTeacherEvaluation(llmResponse) {
  const { error, value } = teacherEvaluationSchema.validate(llmResponse, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    console.warn(
      "[LLM Validation] Invalid structure, using defaults:",
      error.message,
    );
    return { ...defaultEvaluation, ...llmResponse };
  }

  return value;
}

module.exports = {
  validateTeacherEvaluation,
  teacherEvaluationSchema,
  defaultEvaluation,
};
