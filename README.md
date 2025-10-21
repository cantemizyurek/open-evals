# Open Evals

A comprehensive toolkit for generating synthetic test data and evaluating LLM applications with RAG capabilities.

## Overview

Open Evals is a modular evaluation framework designed to help developers test and improve their AI applications. It provides tools for:

- **Synthetic Data Generation**: Create realistic test datasets using knowledge graphs, personas, and scenarios
- **Evaluation Metrics**: Pre-built and custom metrics for assessing LLM performance
- **RAG Utilities**: Text splitters for retrieval-augmented generation
- **Evaluation Framework**: Core abstractions for running comprehensive evaluations

## Packages

This monorepo contains the following packages:

### [@open-evals/core](./packages/core)

Core evaluation framework with abstractions for datasets, metrics, and evaluation pipelines.

```bash
pnpm add @open-evals/core
```

### [@open-evals/generator](./packages/generator)

Synthetic test data generation using knowledge graphs, personas, and query synthesis.

```bash
pnpm add @open-evals/generator
```

### [@open-evals/rag](./packages/rag)

RAG utilities including recursive character and markdown text splitters.

```bash
pnpm add @open-evals/rag
```

### [@open-evals/metrics](./packages/metrics)

Pre-built evaluation metrics including faithfulness, factual correctness, and more.

```bash
pnpm add @open-evals/metrics
```

## Development

This project uses pnpm workspaces for managing multiple packages.

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

## Examples

The `agents/` directory contains example implementations:

- **doc-assistant**: A RAG-based documentation assistant demonstrating the full stack

## License

[MIT](./LICENSE)
