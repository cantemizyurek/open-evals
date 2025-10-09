import type { Scenario } from './type'

/**
 * Create a scenario manually
 *
 * This is a helper function to create scenarios directly,
 * similar to how the persona() helper works
 */
export function scenario<T extends object = {}>(
  scenario: Scenario<T>
): Scenario<T> {
  return scenario
}
