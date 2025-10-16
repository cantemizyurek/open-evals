import { SiTypescript } from '@icons-pack/react-simple-icons'
import { CodeBlock, Pre } from 'fumadocs-ui/components/codeblock'
import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock'
import { LayeredText } from './layered-text'
import { Brain, ChartArea, Files, Workflow } from 'lucide-react'

const code = `
import { EvaluationDataset, evaluate } from '@open-evals/core'
import { Faithfulness } from '@open-evals/metrics'
import { synthesize, graph, DocumentNode, chunk, embed, summarize, relationship } from '@open-evals/generator'
import { openai } from '@ai-sdk/openai'

const documents = [new DocumentNode('typescript-guide.md', content, {})]

const knowledgeGraph = await transform(graph(documents))
  .pipe(summarize(openai.chat('gpt-4.1')))
  .pipe(chunk(new RecursiveCharacterSplitter()))
  .pipe(embed(openai.embedding('text-embedding-3-small')))
  .pipe(relationship())
  .apply()

const personas = await generatePersonas(knowledgeGraph, openai.chat('gpt-4.1'), {
  count: 5,
})

const dataset = await synthesize({
  graph: knowledgeGraph,
  synthesizers: [
    [createSynthesizer(openai.chat('gpt-4.1'), 'single-hop-specific'), 1],
  ],
  personas,
  count: 10,
})

const results = await evaluate(dataset, 
  [new Faithfulness({ model: openai.chat('gpt-4.1') })],
  openai.chat('gpt-4.1'))

console.log(results)
`

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col text-center px-4 py-16 md:py-0 mb-20">
      <div className="w-full max-w-5xl mx-auto">
        <div className="relative min-h-[200px] flex items-center justify-center border-x-2 border-dashed border-border py-30 overflow-hidden">
          <h1 className="text-[100px] font-bold text-black dark:text-white">
            <LayeredText text="open evals" />
          </h1>
        </div>
        <div className="flex border border-border justify-between items-center p-2 px-4">
          <div className="grid grid-cols-2 gap-2 size-fit">
            <div className="relative size-5 border border-border rounded-full overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.3)_0_0.4px,transparent_1px_4px)]" />
            <div className="relative size-5 border border-border rounded-full overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.3)_0_0.4px,transparent_1px_4px)]" />
            <div className="relative size-5 border border-border rounded-full overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.3)_0_0.4px,transparent_1px_4px)]" />
            <div className="relative size-5 border border-border rounded-full overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.3)_0_0.4px,transparent_1px_4px)]" />
          </div>
          <div className="border border-border text-sm p-2">
            pnpm add @open-evals/core
          </div>
        </div>
        <div className="border-b border-x border-border grid grid-cols-7 items-center h-[146px]">
          <div className="col-span-1 w-full h-full border-r border-border relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(135deg,rgba(255,255,255,0.3)_0_1px,transparent_1px_10px)]" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-3 w-full h-full flex flex-col justify-center p-4 border-r border-border">
            <h2 className="text-2xl font-bold text-start">Open Evals</h2>
            <p className="text-start text-sm">
              An open-source framework for evaluating and testing LLM
              applications with built-in metrics and synthetic data generation.
            </p>
          </div>
          <div className="col-span-1 w-full h-full border-r border-border flex items-center justify-center">
            <SiTypescript className="size-16" />
          </div>
          <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0.5px,transparent_0.5px)] before:bg-[length:8px_8px]" />
        </div>
        <div className="border-b border-x border-border grid grid-cols-4 items-center">
          <div className="col-span-3 w-full h-full border-r border-border p-4 text-start">
            <DynamicCodeBlock
              code={code}
              lang="typescript"
              codeblock={{ className: 'rounded-none' }}
            />
          </div>
          <div className="col-span-1 w-full h-full grid grid-rows-4">
            <div className="row-span-1 w-full h-full border-b border-border flex items-center justify-center">
              <Files className="size-12 text-fd-muted-foreground" />
            </div>
            <div className="row-span-1 w-full h-full border-b border-border flex items-center justify-center">
              <Workflow className="size-12 text-fd-muted-foreground" />
            </div>
            <div className="row-span-1 w-full h-full border-b border-border flex items-center justify-center">
              <Brain className="size-12 text-fd-muted-foreground" />
            </div>
            <div className="row-span-1 w-full h-full flex items-center justify-center">
              <ChartArea className="size-12 text-fd-muted-foreground" />
            </div>
          </div>
        </div>
        <div className="border-b h-[146px] border-x border-border grid grid-cols-7 items-center">
          <div className="col-span-1 w-full h-full relative border-r border-border overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.3)_0_0.5px,transparent_0.5px_12px),repeating-linear-gradient(90deg,rgba(255,255,255,0.3)_0_0.5px,transparent_0.5px_12px)]" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-3 w-full h-full border-r border-border overflow-hidden relative">
            <h3 className="text-[90px] font-bold pt-4 translate-y-[-30px]">
              <LayeredText text="features" layers={11} />
            </h3>
          </div>
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(40deg,transparent,transparent_10px,rgba(255,255,255,0.3)_10px,rgba(255,255,255,0.3)_11px)]" />
        </div>
        <div className="border-b border-x border-border w-full items-center">
          {/* Synthetic Data Generation Feature */}
          <div className="w-full grid grid-cols-7 border-b border-border items-center h-[146px]">
            <div className="col-span-1 w-full h-full border-r border-border" />
            <div className="col-span-5 w-full h-full border-r border-border overflow-hidden relative grid grid-cols-2">
              <div className="col-span-1 w-full h-full border-r border-border flex flex-col p-4">
                <div className="my-auto flex flex-col gap-1">
                  <h4 className="text-xl font-bold text-start">
                    Synthetic Data Generation
                  </h4>
                  <p className="text-base text-start font-light">
                    Automatically generate realistic test data from your domain
                    knowledge.
                  </p>
                </div>
              </div>
              <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0.5px,transparent_0.5px)] before:bg-[length:8px_8px]"></div>
            </div>
            <div className="col-span-1 w-full h-full" />
          </div>
          {/* Metrics Feature */}
          <div className="w-full grid grid-cols-7 border-b border-border items-center h-[146px]">
            <div className="col-span-1 w-full h-full border-r border-border" />
            <div className="col-span-5 w-full h-full border-r border-border overflow-hidden relative grid grid-cols-2">
              <div className="col-span-1 w-full h-full border-r border-border relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0.5px,transparent_0.5px)] before:bg-[length:8px_8px]"></div>
              <div className="col-span-1 w-full h-full flex flex-col p-4">
                <div className="my-auto flex flex-col gap-1">
                  <h4 className="text-xl font-bold text-start">Metrics</h4>
                  <p className="text-base text-start font-light">
                    Built-in metrics for evaluating the quality of your LLM and
                    RAG applications.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-1 w-full h-full" />
          </div>
          {/* Evaluation Framework Feature */}
          <div className="w-full grid grid-cols-7 border-b border-border items-center h-[146px]">
            <div className="col-span-1 w-full h-full border-r border-border" />
            <div className="col-span-5 w-full h-full border-r border-border overflow-hidden relative grid grid-cols-2">
              <div className="col-span-1 w-full h-full border-r border-border flex flex-col p-4">
                <div className="my-auto flex flex-col gap-1">
                  <h4 className="text-xl font-bold text-start">
                    Evaluation Framework
                  </h4>
                  <p className="text-base text-start font-light">
                    A flexible evaluation framework for your LLM and RAG
                    applications.
                  </p>
                </div>
              </div>
              <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0.5px,transparent_0.5px)] before:bg-[length:8px_8px]"></div>
            </div>
            <div className="col-span-1 w-full h-full" />
          </div>
          {/* Rag Utilities Feature */}
          <div className="w-full grid grid-cols-7 items-center h-[146px]">
            <div className="col-span-1 w-full h-full border-r border-border" />
            <div className="col-span-5 w-full h-full border-r border-border overflow-hidden relative grid grid-cols-2">
              <div className="col-span-1 w-full h-full border-r border-border relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.3)_0.5px,transparent_0.5px)] before:bg-[length:8px_8px]"></div>
              <div className="col-span-1 w-full h-full flex flex-col p-4">
                <div className="my-auto flex flex-col gap-1">
                  <h4 className="text-xl font-bold text-start">
                    Rag Utilities
                  </h4>
                  <p className="text-base text-start font-light">
                    Utilities for working with RAG applications, including
                    document splitters.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-span-1 w-full h-full" />
          </div>
        </div>
        <div className="border-b border-x border-border grid grid-cols-7 items-center h-[146px]">
          <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(40deg,transparent,transparent_10px,rgba(255,255,255,0.3)_10px,rgba(255,255,255,0.3)_11px)]" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full border-r border-border" />
          <div className="col-span-1 w-full h-full relative overflow-hidden before:content-[''] before:absolute before:inset-0 before:bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.3)_0_0.5px,transparent_0.5px_12px),repeating-linear-gradient(90deg,rgba(255,255,255,0.3)_0_0.5px,transparent_0.5px_12px)]" />
        </div>
      </div>
    </main>
  )
}
