const { z } = require('zod');

const TriageInputSchema = z.object({
  text: z
    .string({ required_error: 'text is required' })
    .trim()
    .min(1, 'text must be at least 1 character')
    .max(2000, 'text must be at most 2000 characters'),
});

const TriageOutputSchema = z.object({
  category: z.enum(['billing', 'bug', 'feature', 'other']),
  urgency: z.enum(['low', 'normal', 'high']),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
});

module.exports = {
  TriageInputSchema,
  TriageOutputSchema,
};