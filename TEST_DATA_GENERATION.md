# Test Data Generation Abstraction

This document provides a comprehensive guide to the test data generation abstraction in Open-Evals.

## Overview

The test data generation abstraction provides a unified interface for creating evaluation datasets from multiple sources:

- **Synthetic Data Generation (SDG)** - Generate realistic samples using LLMs, Knowledge Graphs, and Personas
- **Manual Samples** - Define samples programmatically or load from data structures
- **File-based** - Load samples from JSON/JSONL files
- **Template-based** - Generate samples using template functions
- **Transformations** - Modify existing datasets
- **Composite** - Combine multiple sources with weighted distribution

## Core Concepts

### TestDataSource

A `TestDataSource` represents a strategy for generating evaluation samples. It's an interface with the following contract:

```typescript
interface TestDataSource {
  readonly name: string
  readonly description: string
  generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]>
  validate?(config: TestDataGenerationConfig): Promise<void> | void
  estimateCost?(config: TestDataGenerationConfig): Promise<number> | number
}
```

### TestDataGenerator

The orchestrator that manages multiple sources and generates the final dataset:

```typescript
const generator = new TestDataGenerator()
  .from(source1)
  .from(source2)

const result = await generator.generate({ count: 100 })
```

### TestDataBuilder

A fluent builder API for convenient dataset construction:

```typescript
const dataset = await TestDataBuilder.create()
  .withManualSamples([...])
  .withSDG(config)
  .withMetadata({ version: '1.0' })
  .buildDataset({ count: 100 })
```

## Quick Start Examples

### 1. Manual Test Data

Create a dataset from manually defined samples:

```typescript
import { TestDataBuilder } from '@open-evals/core'

const dataset = await TestDataBuilder.create()
  .withManualSamples([
    {
      query: 'What is the capital of France?',
      response: 'Paris',
      reference: 'Paris'
    },
    {
      query: 'What is 2 + 2?',
      response: '4',
      reference: '4'
    }
  ])
  .buildDataset({ count: 10 })
```

### 2. Synthetic Data Generation (SDG)

Generate realistic samples using the SDG pipeline:

```typescript
import { graph, transform, chunk, embed, relationship } from '@open-evals/generator'
import { createSDGSource } from '@open-evals/generator'
import { TestDataGenerator } from '@open-evals/core'

// Build knowledge graph
const documents = [
  { content: 'Paris is the capital of France...' },
  { content: 'The Eiffel Tower is located in Paris...' }
]

const knowledgeGraph = await transform(graph(documents))
  .pipe(chunk(splitter))
  .pipe(embed(embedModel))
  .pipe(relationship())
  .apply()

// Create SDG source
const sdgSource = createSDGSource({
  knowledgeGraph,
  llm: myLLM,
  synthesizers: [
    ['single-hop-specific', 40],
    ['multi-hop-abstract', 30],
    ['multi-hop-specific', 30]
  ],
  personaCount: 5,
  generateGroundTruth: true
})

// Generate dataset
const generator = new TestDataGenerator().from(sdgSource)
const result = await generator.generate({ count: 100 })
```

### 3. Mixed Sources

Combine multiple data sources with automatic distribution:

```typescript
import { TestDataBuilder, createFunctionSource } from '@open-evals/core'
import { createSDGSource } from '@open-evals/generator'

const dataset = await TestDataBuilder.create()
  // 50% from manual samples
  .withManualSamples(manualSamples)
  // 30% from SDG
  .withSource(sdgSource)
  // 20% from template
  .withSource(createFunctionSource({
    name: 'template',
    generator: (ctx) => ({
      query: `Generated question ${ctx.index}`,
      response: `Generated answer ${ctx.index}`,
      reference: `Reference ${ctx.index}`
    })
  }))
  .buildDataset({ count: 100 })
```

### 4. Weighted Distribution

Control the proportion of samples from each source:

```typescript
import { createWeightedSource } from '@open-evals/core'

const weightedSource = createWeightedSource([
  { source: manualSource, weight: 1 },  // 20%
  { source: sdgSource, weight: 3 },     // 60%
  { source: templateSource, weight: 1 }  // 20%
])

const generator = new TestDataGenerator().from(weightedSource)
const dataset = await generator.generateDataset({ count: 100 })
```

## Advanced Usage

### Custom Test Data Sources

Create your own test data source:

```typescript
import type { TestDataSource, TestDataGenerationConfig, EvaluationSample } from '@open-evals/core'

const myCustomSource: TestDataSource = {
  name: 'custom-qa-generator',
  description: 'Generates QA pairs from database',

  async generate(config: TestDataGenerationConfig): Promise<EvaluationSample[]> {
    const samples = []

    for (let i = 0; i < config.count; i++) {
      // Your custom logic here
      const data = await fetchFromDatabase(i)

      samples.push({
        query: data.question,
        response: data.answer,
        reference: data.groundTruth,
        metadata: {
          source: 'database',
          id: data.id
        }
      })
    }

    return samples
  },

  validate(config) {
    if (config.count > 1000) {
      throw new Error('Maximum 1000 samples per generation')
    }
  },

  estimateCost(config) {
    return config.count * 0.01 // $0.01 per sample
  }
}
```

### Transforming Existing Datasets

Apply transformations to existing datasets:

```typescript
import { TestDataBuilder } from '@open-evals/core'

const transformedDataset = await TestDataBuilder.create()
  .withTransform(
    existingDataset,
    async (sample) => ({
      ...sample,
      // Add augmentation
      query: `Enhanced: ${sample.query}`,
      metadata: {
        ...sample.metadata,
        transformed: true
      }
    })
  )
  .buildDataset({ count: 50 })
```

### Filtering Samples

Generate samples with validation:

```typescript
import { createFilterSource } from '@open-evals/core'

const filteredSource = createFilterSource(
  baseSource,
  (sample) => {
    // Only accept samples with queries longer than 10 characters
    return sample.query.length > 10
  }
)

const generator = new TestDataGenerator().from(filteredSource)
const dataset = await generator.generateDataset({ count: 100 })
```

### Caching for Expensive Sources

Cache generated samples to avoid regeneration:

```typescript
import { createCachingSource } from '@open-evals/core'

const cachedSDG = createCachingSource(expensiveSDGSource)

// First call generates samples
const dataset1 = await generator
  .clearSources()
  .from(cachedSDG)
  .generateDataset({ count: 50 })

// Second call reuses cached samples (no cost)
const dataset2 = await generator
  .clearSources()
  .from(cachedSDG)
  .generateDataset({ count: 50 })
```

### Batched Generation

Generate in batches for better control:

```typescript
import { createBatchedSource } from '@open-evals/core'

const batchedSource = createBatchedSource(
  sdgSource,
  10 // Generate 10 samples at a time
)

const generator = new TestDataGenerator().from(batchedSource)
const dataset = await generator.generateDataset({ count: 100 })
```

## SDG-Specific Features

### Quick SDG Setup

Use the quick helper for simple SDG:

```typescript
import { createQuickSDGSource } from '@open-evals/generator'

const source = createQuickSDGSource(knowledgeGraph, llm, {
  personaCount: 3,
  generateGroundTruth: true
})
```

### Diverse SDG with Multiple Synthesizers

Generate diverse samples using different query types:

```typescript
import { createDiverseSDGSource } from '@open-evals/generator'

const source = createDiverseSDGSource(
  knowledgeGraph,
  llm,
  {
    singleHop: 40,        // 40% simple questions
    multiHopAbstract: 30, // 30% abstract multi-hop
    multiHopSpecific: 30  // 30% specific multi-hop
  },
  {
    personaCount: 5,
    generateGroundTruth: true
  }
)
```

### Custom Synthesizers

Use custom synthesizer implementations:

```typescript
import { createSDGSource } from '@open-evals/generator'
import { MyCustomSynthesizer } from './my-synthesizer'

const source = createSDGSource({
  knowledgeGraph,
  llm,
  customSynthesizers: [
    [new MyCustomSynthesizer(llm), 100]
  ],
  personaCount: 5,
  generateGroundTruth: true
})
```

## Metadata Tracking

All generated samples include metadata for provenance tracking:

```typescript
interface TestDataMetadata {
  source: string           // Source name (e.g., 'sdg', 'manual')
  generatedAt?: Date       // Generation timestamp
  persona?: string         // Persona used (for SDG)
  scenarioType?: string    // Scenario type
  synthesizerType?: string // Synthesizer used
  custom?: Record<string, unknown>
}
```

### Setting Global Metadata

```typescript
const generator = new TestDataGenerator({
  globalMetadata: {
    custom: {
      experiment: 'exp-001',
      version: '1.0.0'
    }
  }
})

generator.from(source)
const dataset = await generator.generateDataset({ count: 100 })

// All samples will have the global metadata
```

### Per-Generation Metadata

```typescript
const result = await generator.generate({
  count: 100,
  metadata: {
    scenarioType: 'multi-hop',
    custom: {
      batch: 'batch-1'
    }
  }
})
```

## Cost Estimation

Estimate costs before generation:

```typescript
const generator = new TestDataGenerator()
  .from(sdgSource1)
  .from(sdgSource2)

const estimatedTokens = await generator.estimateCost({ count: 100 })
console.log(`Estimated cost: ${estimatedTokens} tokens`)

// Proceed with generation
const dataset = await generator.generateDataset({ count: 100 })
```

## Generation Results

The `generate()` method returns detailed results:

```typescript
const result = await generator.generate({ count: 100 })

console.log(`Generated ${result.count} samples`)
console.log(`Duration: ${result.duration}ms`)
console.log(`Sources used: ${result.metadata.sources.join(', ')}`)

if (result.metadata.errors) {
  console.log(`Errors encountered: ${result.metadata.errors.length}`)
}

const dataset = result.dataset
```

## Loading from Files

### JSON Format

```typescript
import { createFileSource } from '@open-evals/core'

const jsonContent = await fs.readFile('test-data.json', 'utf-8')

const source = createFileSource({
  content: jsonContent,
  format: 'json'
})

const generator = new TestDataGenerator().from(source)
const dataset = await generator.generateDataset({ count: 50 })
```

### JSONL Format

```typescript
const jsonlContent = await fs.readFile('test-data.jsonl', 'utf-8')

const source = createFileSource({
  content: jsonlContent,
  format: 'jsonl'
})
```

## Best Practices

### 1. Use Builder for Prototyping

For quick experiments and prototyping:

```typescript
const dataset = await TestDataBuilder.create()
  .withManualSamples(samples)
  .withConcurrency(10)
  .buildDataset({ count: 100 })
```

### 2. Use Generator for Production

For production systems with complex requirements:

```typescript
const generator = new TestDataGenerator({
  defaultConcurrency: 20,
  globalMetadata: { environment: 'production' }
})

generator
  .from(primarySource)
  .from(fallbackSource)

const result = await generator.generate({ count: 1000 })
```

### 3. Cache Expensive Operations

```typescript
const cachedSDG = createCachingSource(sdgSource)
```

### 4. Filter Invalid Samples

```typescript
const validatedSource = createFilterSource(
  baseSource,
  (sample) => {
    return sample.query.length > 0 && sample.response.length > 0
  }
)
```

### 5. Monitor Costs

```typescript
const cost = await generator.estimateCost({ count: 1000 })
if (cost > MAX_BUDGET) {
  console.warn(`Cost ${cost} exceeds budget ${MAX_BUDGET}`)
}
```

## Type Safety

All types are fully typed with TypeScript:

```typescript
import type {
  TestDataSource,
  TestDataGenerationConfig,
  TestDataMetadata,
  GenerationContext,
  GenerationResult
} from '@open-evals/core'

import type {
  SDGSourceConfig
} from '@open-evals/generator'
```

## Migration Guide

### From Direct synthesize() Usage

**Before:**
```typescript
const dataset = await synthesize({
  graph: knowledgeGraph,
  synthesizers: [[createSynthesizer(llm, 'single-hop-specific'), 100]],
  personas: myPersonas,
  count: 100
})
```

**After:**
```typescript
const source = createSDGSource({
  knowledgeGraph,
  llm,
  synthesizers: [['single-hop-specific', 100]],
  personas: myPersonas
})

const dataset = await new TestDataGenerator()
  .from(source)
  .generateDataset({ count: 100 })
```

### From Manual Dataset Construction

**Before:**
```typescript
const dataset = new EvaluationDataset([
  { query: 'Q1', response: 'R1' },
  { query: 'Q2', response: 'R2' }
])
```

**After:**
```typescript
const dataset = await TestDataBuilder.create()
  .withManualSamples([
    { query: 'Q1', response: 'R1' },
    { query: 'Q2', response: 'R2' }
  ])
  .buildDataset({ count: 2 })
```

## FAQ

### Q: When should I use TestDataBuilder vs TestDataGenerator?

**A:** Use `TestDataBuilder` for quick prototyping and simple cases. Use `TestDataGenerator` when you need:
- Reusable generator instances
- Complex source management
- Cost estimation
- Error handling and monitoring

### Q: How do I combine manual and SDG samples?

**A:** Use multiple sources:

```typescript
const dataset = await TestDataBuilder.create()
  .withManualSamples(manualSamples)
  .withSource(sdgSource)
  .buildDataset({ count: 100 })
```

### Q: Can I control the ratio of samples from each source?

**A:** Yes, use `createWeightedSource()`:

```typescript
const weighted = createWeightedSource([
  { source: source1, weight: 2 },
  { source: source2, weight: 1 }
])
```

### Q: How do I validate samples during generation?

**A:** Use `createFilterSource()` or implement validation in your custom source:

```typescript
const validated = createFilterSource(source, (sample) => {
  return isValid(sample)
})
```

### Q: Can I reuse personas across multiple generations?

**A:** Yes, provide personas to the SDG config:

```typescript
const personas = await generatePersonas(graph, llm, { count: 5 })

const source = createSDGSource({
  knowledgeGraph,
  llm,
  personas // Reused across generations
})
```

## Examples Repository

See the `/examples` directory for complete working examples:

- `examples/basic-manual.ts` - Manual test data
- `examples/sdg-simple.ts` - Simple SDG
- `examples/sdg-advanced.ts` - Advanced SDG with multiple synthesizers
- `examples/mixed-sources.ts` - Combining multiple sources
- `examples/custom-source.ts` - Creating custom sources
- `examples/transformation.ts` - Dataset transformations

## API Reference

For complete API documentation, see:
- [Core Package API](/packages/core/README.md)
- [Generator Package API](/packages/generator/README.md)
