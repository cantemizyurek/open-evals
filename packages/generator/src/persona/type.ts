export interface Persona {
  name: string
  description: string
}

export interface GeneratePersonasOptions {
  /**
   * Number of personas to generate.
   * If not provided, generates one persona per representative cluster.
   * If provided and exceeds available clusters, samples with replacement.
   */
  count?: number
  concurrency?: number
}
