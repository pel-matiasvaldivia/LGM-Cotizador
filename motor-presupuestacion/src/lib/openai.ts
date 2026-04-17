import OpenAI from 'openai';

// Se instancia con delay para no crashear Next.js durante 'npm run build'
// ya que las env variables sólo estarán presentes en Runtime.
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'missing-key',
});
