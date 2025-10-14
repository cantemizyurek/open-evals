/**
 * Compute F-beta score
 *
 * @param tp - True positives
 * @param fp - False positives
 * @param fn - False negatives
 * @param beta - Beta value (beta > 1 gives more weight to recall, beta < 1 favors precision)
 * @returns F-beta score
 */
export function fbetaScore(
  tp: number,
  fp: number,
  fn: number,
  beta: number
): number {
  const precision = tp / (tp + fp + 1e-8)
  const recall = tp / (tp + fn + 1e-8)
  const betaSquared = beta * beta

  return (
    ((1 + betaSquared) * precision * recall) /
    (betaSquared * precision + recall + 1e-8)
  )
}
