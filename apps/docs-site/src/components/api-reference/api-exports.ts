import type { Comment, ReflectionFlags, Signature, TypeDocNode, TypeDocOutput } from './types'
import { createMap } from '@hyperfrontend/immutable-api-utils/built-in-copy/map'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'
import { buildNodeLookup, getModuleDescription, resolveUniqueExports } from './type-utils'
import { ReflectionKind } from './types'

/**
 * A module's exports sorted into the kinds the reference lists them under.
 *
 * One shape serves every surface that renders a reference: the package page, a module in
 * the grouped view, a secondary entry point's page, and the markdown counterpart of each.
 */
export interface KindGroups {
  /** Function declarations */
  functions: TypeDocNode[]
  /** Class declarations */
  classes: TypeDocNode[]
  /** Interface declarations */
  interfaces: TypeDocNode[]
  /** Type alias declarations */
  types: TypeDocNode[]
  /** Variable and constant declarations */
  variables: TypeDocNode[]
  /** Enum declarations */
  enums: TypeDocNode[]
  /** Namespace declarations, produced by `export * as name` */
  namespaces: TypeDocNode[]
}

/**
 * Sort a module's resolved exports by reflection kind, each kind alphabetically.
 *
 * @param nodes - Declarations to sort, references already resolved
 * @returns The declarations grouped by kind, each group sorted by name
 */
export function groupByKind(nodes: TypeDocNode[]): KindGroups {
  const ofKind = (kind: number) => nodes.filter((node) => node.kind === kind).sort((a, b) => a.name.localeCompare(b.name))
  return {
    functions: ofKind(ReflectionKind.Function),
    classes: ofKind(ReflectionKind.Class),
    interfaces: ofKind(ReflectionKind.Interface),
    types: ofKind(ReflectionKind.TypeAlias),
    variables: ofKind(ReflectionKind.Variable),
    enums: ofKind(ReflectionKind.Enum),
    namespaces: ofKind(ReflectionKind.Namespace),
  }
}

/**
 * Total number of declarations across every kind group.
 *
 * @param groups - Declarations sorted by kind
 * @returns How many there are altogether
 */
export function countGroups(groups: KindGroups): number {
  return (
    groups.functions.length +
    groups.classes.length +
    groups.interfaces.length +
    groups.types.length +
    groups.variables.length +
    groups.enums.length +
    groups.namespaces.length
  )
}

/**
 * Whether a TypeDoc output has modules, which is what a package with several entry points
 * produces.
 *
 * @param data - TypeDoc output data to check
 * @returns True when at least one child is a module
 */
export function hasModules(data: TypeDocOutput): boolean {
  return (data.children ?? []).some((child) => child.kind === ReflectionKind.Module)
}

/** One entry point of a package, with the declarations it exports. */
export interface ApiModule {
  /** Module name as TypeDoc records it: the full import specifier, or a bare subpath */
  name: string
  /** The module's `@module` description, empty when it has none */
  description: string
  /** The declarations the module exports, references resolved, each once */
  exports: TypeDocNode[]
}

/**
 * Every module of a multi-entry package with its exports resolved, sorted by name.
 *
 * A declaration exported by several entry points appears under each of them, exactly as it
 * can be imported from each; see {@link homeModules} for the surfaces that list it once.
 *
 * @param data - TypeDoc output for the package
 * @returns The modules in name order; empty for a single-entry package
 */
export function collectModules(data: TypeDocOutput): ApiModule[] {
  const lookup = buildNodeLookup(data)
  const modules: ApiModule[] = []
  for (const child of data.children ?? []) {
    if (child.kind !== ReflectionKind.Module) continue
    modules.push({
      name: child.name,
      description: getModuleDescription(child.comment),
      exports: resolveUniqueExports(child.children ?? [], lookup),
    })
  }
  return modules.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The module each declaration is documented under when every declaration is to be listed
 * once.
 *
 * A package's root entry point commonly re-exports what its secondary entry points declare,
 * so the same declaration is reachable from two or more modules. The most specific of them,
 * the one with the longest name, is taken as the declaration's home, which puts a symbol
 * under the entry point that owns it and leaves the root listing re-exports by name.
 *
 * @param modules - The package's modules, from {@link collectModules}
 * @returns Declaration id to the name of the module that documents it
 */
export function homeModules(modules: ApiModule[]): Map<number, string> {
  const homes = createMap<number, string>()
  for (const module of modules) {
    for (const node of module.exports) {
      const current = homes.get(node.id)
      if (current === undefined || module.name.length > current.length) {
        homes.set(node.id, module.name)
      }
    }
  }
  return homes
}

/**
 * Every declaration a package exports, each once, whichever entry points carry it.
 *
 * A single-entry package's children are the declarations themselves; a multi-entry package
 * is flattened across its modules, keeping the first occurrence of each declaration.
 *
 * @param data - TypeDoc output for the package
 * @returns The declarations in discovery order
 */
export function flattenExports(data: TypeDocOutput): TypeDocNode[] {
  if (!hasModules(data)) return data.children ?? []

  const lookup = buildNodeLookup(data)
  const seen = createSet<number>()
  const exports: TypeDocNode[] = []
  for (const module of data.children ?? []) {
    if (module.kind !== ReflectionKind.Module) continue
    for (const node of resolveUniqueExports(module.children ?? [], lookup)) {
      if (seen.has(node.id)) continue
      seen.add(node.id)
      exports.push(node)
    }
  }
  return exports
}

/**
 * The declarations one secondary entry point exports, references resolved.
 *
 * TypeDoc names secondary-entrypoint modules by the full package-qualified path
 * (`@hyperfrontend/versioning/commits/parse`); older bundles used the bare subpath, so both
 * spellings resolve.
 *
 * @param data - TypeDoc output for the package
 * @param packageName - The package's npm name
 * @param subpath - The entry point's subpath beneath the package
 * @returns The exports, or null when the bundle has no such module
 */
export function scopedExports(data: TypeDocOutput, packageName: string, subpath: string): TypeDocNode[] | null {
  const qualified = `${packageName}/${subpath}`
  const moduleNode = (data.children ?? []).find(
    (child) => child.kind === ReflectionKind.Module && (child.name === qualified || child.name === subpath)
  )
  if (!moduleNode) return null
  return resolveUniqueExports(moduleNode.children ?? [], buildNodeLookup(data))
}

/** The members of a class or interface, sorted into the sections the reference shows. */
export interface MemberGroups {
  /** The constructor declaration, when the class declares one */
  constructors: TypeDocNode[]
  /** Fields, including arrow-function properties that carry a function type */
  properties: TypeDocNode[]
  /** Getters and setters */
  accessors: TypeDocNode[]
  /** Methods, including the method signatures of an interface */
  methods: TypeDocNode[]
}

/**
 * Sort the members of a class or interface into the sections the reference renders.
 *
 * Members keep declaration order within each section, which is the order the source
 * presents them in and the order a reader of the source expects.
 *
 * @param node - A class or interface declaration
 * @returns The members by section
 */
export function groupMembers(node: TypeDocNode): MemberGroups {
  const ofKind = (kind: number) => (node.children ?? []).filter((child) => child.kind === kind)
  return {
    constructors: ofKind(ReflectionKind.Constructor),
    properties: ofKind(ReflectionKind.Property),
    accessors: ofKind(ReflectionKind.Accessor),
    methods: ofKind(ReflectionKind.Method),
  }
}

/**
 * The comment that documents a member, wherever TypeDoc attached it.
 *
 * A property's comment sits on the property; a method's on its first signature; an
 * accessor's on its getter, or on its setter when there is no getter.
 *
 * @param node - The property, method or accessor to read
 * @returns The comment, or undefined when the member is undocumented
 */
export function memberComment(node: TypeDocNode): Comment | undefined {
  return node.comment ?? node.signatures?.[0]?.comment ?? node.getSignature?.comment ?? node.setSignature?.comment
}

/**
 * The signature that gives an accessor its type: the getter's, or the setter's parameter
 * when the accessor is write-only.
 *
 * @param node - An accessor member
 * @returns The signature whose `type` is the accessor's type, or undefined for a bare setter without a parameter
 */
export function accessorSignature(node: TypeDocNode): Signature | undefined {
  if (node.getSignature) return node.getSignature
  const setter = node.setSignature
  if (setter?.parameters?.[0]) return { ...setter, type: setter.parameters[0].type }
  return undefined
}

/**
 * The modifiers a member carries that change how it is reached: visibility, `static`,
 * `abstract` and `readonly`. Public is the default and is not spelled out.
 *
 * @param flags - The member's reflection flags
 * @returns The modifier keywords in declaration order
 */
export function memberModifiers(flags: ReflectionFlags | undefined): string[] {
  const modifiers: string[] = []
  if (flags?.isProtected) modifiers.push('protected')
  if (flags?.isStatic) modifiers.push('static')
  if (flags?.isAbstract) modifiers.push('abstract')
  if (flags?.isReadonly) modifiers.push('readonly')
  return modifiers
}

/**
 * The full import specifier of a module.
 *
 * TypeDoc names each module by its `@module` tag, which is the fully-qualified import
 * specifier (`@hyperfrontend/ui-utils/color`), and such names are returned as they are. A
 * bare subpath (`color`) is joined onto the package name, and the root module (`index`, or
 * a name equal to the package) resolves to the package name alone.
 *
 * @param packageName - The root package name
 * @param moduleName - The module name from TypeDoc, full specifier or subpath
 * @returns The import specifier a consumer writes
 * @example
 * ```typescript
 * moduleImportPath('@hyperfrontend/state-machine', 'events') // '@hyperfrontend/state-machine/events'
 * ```
 */
export function moduleImportPath(packageName: string, moduleName: string): string {
  if (moduleName === 'index' || moduleName === packageName) {
    return packageName
  }
  if (moduleName.startsWith(`${packageName}/`)) {
    return moduleName
  }
  return `${packageName}/${moduleName}`
}
