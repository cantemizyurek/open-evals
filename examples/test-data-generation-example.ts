/**
 * Example: Test Data Generation Abstraction
 *
 * This example demonstrates the various ways to generate test data
 * using the unified abstraction layer.
 */

import {
  TestDataBuilder,
  TestDataGenerator,
  createFunctionSource,
  createWeightedSource,
  createFilterSource,
  type SingleTurnSample,
} from '@open-evals/core'

// Example 1: Manual Test Data
async function example1_ManualData() {
  console.log('\n=== Example 1: Manual Test Data ===')

  const dataset = await TestDataBuilder.create()
    .withManualSamples([
      {
        query: 'What is the capital of France?',
        response: 'Paris',
        reference: 'Paris',
      },
      {
        query: 'What is 2 + 2?',
        response: '4',
        reference: '4',
      },
    ] as SingleTurnSample[])
    .buildDataset({ count: 5 })

  console.log(`Generated ${dataset.toArray().length} samples`)
  console.log('First sample:', dataset.toArray()[0])
}

// Example 2: Function-based Generation
async function example2_FunctionBased() {
  console.log('\n=== Example 2: Function-based Generation ===')

  const source = createFunctionSource({
    name: 'math-qa',
    description: 'Generates math Q&A pairs',
    generator: (ctx) => {
      const a = ctx.index + 1
      const b = ctx.index + 2
      return {
        query: `What is ${a} + ${b}?`,
        response: `${a + b}`,
        reference: `${a + b}`,
      } as SingleTurnSample
    },
    estimateCost: (count) => count * 0.01, // $0.01 per sample
  })

  const generator = new TestDataGenerator().from(source)
  const result = await generator.generate({ count: 10 })

  console.log(`Generated ${result.count} samples in ${result.duration}ms`)
  console.log('Sample:', result.dataset.toArray()[0])
}

// Example 3: Multiple Sources
async function example3_MultipleSources() {
  console.log('\n=== Example 3: Multiple Sources ===')

  const mathSource = createFunctionSource({
    name: 'math',
    generator: (ctx) => ({
      query: `Math question ${ctx.index}`,
      response: `Math answer ${ctx.index}`,
      reference: `Math reference ${ctx.index}`,
    } as SingleTurnSample),
  })

  const scienceSource = createFunctionSource({
    name: 'science',
    generator: (ctx) => ({
      query: `Science question ${ctx.index}`,
      response: `Science answer ${ctx.index}`,
      reference: `Science reference ${ctx.index}`,
    } as SingleTurnSample),
  })

  const dataset = await TestDataBuilder.create()
    .withSource(mathSource)
    .withSource(scienceSource)
    .withMetadata({ experiment: 'multi-source-v1' })
    .buildDataset({ count: 20 })

  console.log(`Generated ${dataset.toArray().length} samples`)

  // Count samples from each source
  const samples = dataset.toArray()
  const mathCount = samples.filter((s) => s.metadata?.source === 'math').length
  const scienceCount = samples.filter((s) => s.metadata?.source === 'science').length

  console.log(`Math samples: ${mathCount}`)
  console.log(`Science samples: ${scienceCount}`)
}

// Example 4: Weighted Distribution
async function example4_WeightedDistribution() {
  console.log('\n=== Example 4: Weighted Distribution ===')

  const easySource = createFunctionSource({
    name: 'easy',
    generator: () => ({
      query: 'Easy question',
      response: 'Easy answer',
    } as SingleTurnSample),
  })

  const mediumSource = createFunctionSource({
    name: 'medium',
    generator: () => ({
      query: 'Medium question',
      response: 'Medium answer',
    } as SingleTurnSample),
  })

  const hardSource = createFunctionSource({
    name: 'hard',
    generator: () => ({
      query: 'Hard question',
      response: 'Hard answer',
    } as SingleTurnSample),
  })

  const weightedSource = createWeightedSource([
    { source: easySource, weight: 5 }, // 50%
    { source: mediumSource, weight: 3 }, // 30%
    { source: hardSource, weight: 2 }, // 20%
  ])

  const dataset = await new TestDataGenerator()
    .from(weightedSource)
    .generateDataset({ count: 100 })

  const samples = dataset.toArray()
  const easyCount = samples.filter((s) => s.metadata?.source === 'easy').length
  const mediumCount = samples.filter((s) => s.metadata?.source === 'medium').length
  const hardCount = samples.filter((s) => s.metadata?.source === 'hard').length

  console.log(`Easy: ${easyCount}% (expected ~50%)`)
  console.log(`Medium: ${mediumCount}% (expected ~30%)`)
  console.log(`Hard: ${hardCount}% (expected ~20%)`)
}

// Example 5: Filtering
async function example5_Filtering() {
  console.log('\n=== Example 5: Filtering ===')

  const baseSource = createFunctionSource({
    name: 'base',
    generator: (ctx) => ({
      query: `Question ${ctx.index}`,
      response: ctx.index % 2 === 0 ? 'Even' : '', // Only even indices have answers
    } as SingleTurnSample),
  })

  // Filter out samples with empty responses
  const filteredSource = createFilterSource(
    baseSource,
    (sample) => (sample as SingleTurnSample).response.length > 0
  )

  const dataset = await new TestDataGenerator()
    .from(filteredSource)
    .generateDataset({ count: 10 })

  console.log(`Generated ${dataset.toArray().length} samples (all filtered)`)
  console.log('All samples have non-empty responses:', dataset.toArray().every(
    (s) => (s as SingleTurnSample).response.length > 0
  ))
}

// Example 6: Cost Estimation
async function example6_CostEstimation() {
  console.log('\n=== Example 6: Cost Estimation ===')

  const expensiveSource = createFunctionSource({
    name: 'expensive',
    generator: () => ({
      query: 'Expensive question',
      response: 'Expensive answer',
    } as SingleTurnSample),
    estimateCost: (count) => count * 100, // 100 tokens per sample
  })

  const generator = new TestDataGenerator().from(expensiveSource)

  const estimatedCost = await generator.estimateCost({ count: 1000 })
  console.log(`Estimated cost for 1000 samples: ${estimatedCost} tokens`)

  // Only generate if cost is acceptable
  const MAX_BUDGET = 50000
  if (estimatedCost <= MAX_BUDGET) {
    console.log('Cost is within budget, proceeding with generation...')
    // const result = await generator.generate({ count: 1000 })
  } else {
    console.log(`Cost ${estimatedCost} exceeds budget ${MAX_BUDGET}`)
  }
}

// Example 7: Dataset Transformation
async function example7_Transformation() {
  console.log('\n=== Example 7: Dataset Transformation ===')

  const baseDataset = await TestDataBuilder.create()
    .withManualSamples([
      { query: 'Question 1', response: 'Answer 1' },
      { query: 'Question 2', response: 'Answer 2' },
    ] as SingleTurnSample[])
    .buildDataset({ count: 2 })

  const transformedDataset = await TestDataBuilder.create()
    .withTransform(baseDataset, (sample) => ({
      ...sample,
      query: `Enhanced: ${(sample as SingleTurnSample).query}`,
      metadata: {
        ...sample.metadata,
        transformed: true,
      },
    }))
    .buildDataset({ count: 2 })

  console.log('Original:', baseDataset.toArray()[0])
  console.log('Transformed:', transformedDataset.toArray()[0])
}

// Example 8: Async Generation with Progress
async function example8_AsyncWithProgress() {
  console.log('\n=== Example 8: Async Generation with Progress ===')

  const slowSource = createFunctionSource({
    name: 'slow',
    generator: async (ctx) => {
      // Simulate slow generation
      await new Promise((resolve) => setTimeout(resolve, 100))
      return {
        query: `Question ${ctx.index}`,
        response: `Answer ${ctx.index}`,
      } as SingleTurnSample
    },
  })

  const startTime = Date.now()
  const result = await new TestDataGenerator()
    .from(slowSource)
    .generate({ count: 10, concurrency: 5 })

  const duration = Date.now() - startTime
  console.log(`Generated ${result.count} samples in ${duration}ms`)
  console.log(
    `With concurrency 5, should be ~2x faster than sequential (${duration}ms vs ~1000ms)`
  )
}

// Run all examples
async function main() {
  console.log('Test Data Generation Examples')
  console.log('==============================')

  await example1_ManualData()
  await example2_FunctionBased()
  await example3_MultipleSources()
  await example4_WeightedDistribution()
  await example5_Filtering()
  await example6_CostEstimation()
  await example7_Transformation()
  await example8_AsyncWithProgress()

  console.log('\n=== All Examples Completed ===')
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export {
  example1_ManualData,
  example2_FunctionBased,
  example3_MultipleSources,
  example4_WeightedDistribution,
  example5_Filtering,
  example6_CostEstimation,
  example7_Transformation,
  example8_AsyncWithProgress,
}
