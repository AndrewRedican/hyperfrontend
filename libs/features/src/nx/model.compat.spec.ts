import type {
  ExecutorContext as DevkitExecutorContext,
  Generator as DevkitGenerator,
  GeneratorCallback as DevkitGeneratorCallback,
  Tree as DevkitTree,
} from '@nx/devkit'
import type { FeatureGeneratorSchema, featureGenerator } from './generators/feature/generator'
import type { InitGeneratorSchema, initGenerator } from './generators/init/generator'
import type { ExecutorContext, ExecutorResult, GeneratorCallback, Tree } from './model'
import { describe, expect, it } from '@hyperfrontend/testing'

// why: The adapter mirrors @nx/devkit's contracts structurally instead of depending on it; these compile-time-only assignments fail the type check if the mirrored subset in model.ts ever drifts from the real devkit shapes.

/** Inbound: Nx constructs the tree and hands it to generator implementations. */
const treeWitness: Tree = {} as DevkitTree
/** Inbound: Nx constructs the context and hands it to executor implementations. */
const contextWitness: ExecutorContext = {} as DevkitExecutorContext
/** Outbound: callbacks the adapter returns must satisfy what Nx awaits. */
const callbackWitness: DevkitGeneratorCallback = {} as GeneratorCallback
/** Outbound: executor results must satisfy the `success` shape Nx reads. */
const resultWitness: { success: boolean } = {} as ExecutorResult
/** Outbound: the init generator implementation must satisfy what Nx invokes. */
const initGeneratorWitness: DevkitGenerator<InitGeneratorSchema> = {} as typeof initGenerator
/** Outbound: the feature generator implementation must satisfy what Nx invokes. */
const featureGeneratorWitness: DevkitGenerator<FeatureGeneratorSchema> = {} as typeof featureGenerator

describe('nx model parity', () => {
  it('mirrors the devkit contracts structurally', () => {
    expect([treeWitness, contextWitness, callbackWitness, resultWitness, initGeneratorWitness, featureGeneratorWitness]).toHaveLength(6)
  })
})
