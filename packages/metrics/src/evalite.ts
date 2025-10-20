import { createScorer } from 'evalite'
import { Metric, MetricScore, SingleTurnSample } from '@open-evals/core'

export function toEvaliteScorer(metric: Metric) {
  return createScorer<Omit<SingleTurnSample, 'response'>, string, MetricScore>({
    name: metric.name,
    description: metric.description,
    async scorer({ input, output }) {
      const result = await metric.evaluate({ ...input, response: output })
      return {
        score: result.score,
        metadata: {
          ...result.metadata,
          reason: result.reason,
        },
      }
    },
  })
}
