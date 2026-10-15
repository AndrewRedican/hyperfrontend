'use client'

import type { ApiHeadingLevel } from './heading-level'
import type { ReflectionFlags, TypeDocNode } from './types'
import { AnchorLink } from '../anchor-link'
import { accessorSignature, memberComment, memberModifiers } from './api-exports'
import { useTypeLinkResolver } from './api-link-context'
import { DescriptionMarkdown } from './description-markdown'
import { ExampleBlock } from './example-block'
import { ParameterList } from './parameter-list'
import { TYPE_EXPRESSION_ATTRIBUTES, TypeLink, TypeSegmentsText } from './type-link'
import {
  getDescription,
  getExamples,
  getParamDescriptions,
  getReturnsDescription,
  parameterSegments,
  signatureSegments,
} from './type-utils'

/** Props shared by every member entry. */
interface MemberProps {
  /** The class or interface the member belongs to */
  parent: TypeDocNode
  /** The member itself */
  node: TypeDocNode
  /** Heading level of the parent symbol; the member's parameter table sits two under it */
  level?: ApiHeadingLevel
}

/** Props for {@link Modifiers}. */
interface ModifiersProps {
  /** The member's reflection flags */
  flags: ReflectionFlags | undefined
}

/**
 * The member's modifiers, printed quietly before its name.
 * @param props - See {@link ModifiersProps}.
 * @param props.flags - The member's reflection flags
 * @returns The keywords, or nothing for a plain public member
 */
function Modifiers({ flags }: ModifiersProps) {
  const modifiers = memberModifiers(flags)
  if (modifiers.length === 0) return null
  return <span className="text-slate-400">{modifiers.join(' ')} </span>
}

/**
 * A property row: its name, its type, and its description on the same line.
 * @param props - See {@link MemberProps}.
 * @param props.parent - The class or interface the property belongs to
 * @param props.node - The property
 * @returns The rendered row
 */
export function PropertyEntry({ parent, node }: MemberProps) {
  const description = getDescription(memberComment(node))
  const id = `api-${parent.name}-prop-${node.name}`

  return (
    <div id={id} className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
      <AnchorLink id={id} />
      <code className="text-slate-900 dark:text-white">
        <Modifiers flags={node.flags} />
        {node.name}
        {node.flags?.isOptional && <span className="text-slate-400">?</span>}
      </code>
      <span className="text-slate-400">:</span>
      <TypeLink type={node.type} />
      {description && (
        <span className="text-slate-500 ml-2">
          <DescriptionMarkdown text={description} inline />
        </span>
      )}
    </div>
  )
}

/**
 * An accessor row, drawn like a property with the accessor keywords it offers, so a
 * read-only getter and a read-write pair are told apart at a glance.
 * @param props - See {@link MemberProps}.
 * @param props.parent - The class the accessor belongs to
 * @param props.node - The accessor
 * @returns The rendered row
 */
export function AccessorEntry({ parent, node }: MemberProps) {
  const description = getDescription(memberComment(node))
  const id = `api-${parent.name}-prop-${node.name}`
  const keywords = [node.getSignature ? 'get' : '', node.setSignature ? 'set' : ''].filter(Boolean).join(' ')

  return (
    <div id={id} className="flex flex-wrap items-start gap-x-2 gap-y-1 text-sm">
      <AnchorLink id={id} />
      <code className="text-slate-900 dark:text-white">
        <Modifiers flags={node.flags} />
        <span className="text-slate-400">{keywords} </span>
        {node.name}
      </code>
      <span className="text-slate-400">:</span>
      <TypeLink type={accessorSignature(node)?.type} />
      {description && (
        <span className="text-slate-500 ml-2">
          <DescriptionMarkdown text={description} inline />
        </span>
      )}
    </div>
  )
}

/** Props for {@link SignatureEntry}. */
interface SignatureEntryProps {
  /** The member itself */
  node: TypeDocNode
  /** Heading level of the parent symbol; the member's parameter table sits two under it */
  level?: ApiHeadingLevel
  /** The anchor id the entry carries */
  id: string
  /** What the entry is called in its heading line, `new Name` for a constructor */
  label: string
  /** Anchor prefix for the parameter rows */
  parameterParent: string
}

/**
 * One callable member: every signature it declares, each with its description, its
 * parameters, what it returns and its examples. An overloaded method lists each overload
 * in turn, which is how TypeDoc documents them.
 * @param props - See {@link SignatureEntryProps}.
 * @param props.node - The member
 * @param props.level - Heading level of the parent symbol
 * @param props.id - The anchor id the entry carries
 * @param props.label - What the entry is called
 * @param props.parameterParent - Anchor prefix for the parameter rows
 * @returns The rendered entry, or nothing for a member without signatures
 */
function SignatureEntry({ node, level = 3, id, label, parameterParent }: SignatureEntryProps) {
  const resolve = useTypeLinkResolver()
  const signatures = node.signatures ?? []
  if (signatures.length === 0) return null

  return (
    <div id={id} className="text-sm">
      {signatures.map((signature, index) => {
        const description = getDescription(signature.comment)
        const returnsDescription = getReturnsDescription(signature.comment)
        const examples = getExamples(signature.comment)
        const paramDescriptions = getParamDescriptions(signature.comment)
        const isConstructor = node.name === 'constructor'
        // why: a constructor returns the class its entry sits in, so only its parameter list is printed
        const segments = isConstructor ? parameterSegments(signature, resolve) : signatureSegments(signature, resolve)

        return (
          <div key={signature.id} className={index > 0 ? 'mt-3' : ''}>
            <div className="flex items-start gap-2">
              {index === 0 && <AnchorLink id={id} />}
              {index > 0 && <span className="w-[1.25rem] shrink-0" aria-hidden="true" />}
              <code className="api-type min-w-0 text-slate-900 dark:text-white" {...TYPE_EXPRESSION_ATTRIBUTES}>
                <Modifiers flags={node.flags} />
                {label}
                <TypeSegmentsText segments={segments} />
              </code>
            </div>
            {description && <DescriptionMarkdown text={description} className="text-slate-500 ml-6 mt-1" />}
            {signature.parameters && signature.parameters.length > 0 && (
              <div className="ml-6">
                <ParameterList
                  parameters={signature.parameters}
                  paramDescriptions={paramDescriptions}
                  parentName={parameterParent}
                  level={level}
                  caption="label"
                />
              </div>
            )}
            {returnsDescription && !isConstructor && (
              <div className="ml-6 mt-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Returns</p>
                <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                  <TypeLink type={signature.type} />
                  <DescriptionMarkdown text={returnsDescription} className="min-w-0 text-sm text-slate-600 dark:text-slate-400" />
                </div>
              </div>
            )}
            {examples.length > 0 && (
              <div className="ml-6 mt-3">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {examples.length === 1 ? 'Example' : 'Examples'}
                </p>
                {examples.map((example, exampleIndex) => (
                  <ExampleBlock key={exampleIndex} code={example.code} label={example.label} />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * A method entry, anchored as `api-<Parent>-method-<name>`.
 * @param props - See {@link MemberProps}.
 * @param props.parent - The class or interface the method belongs to
 * @param props.node - The method
 * @param props.level - Heading level of the parent symbol
 * @returns The rendered entry
 */
export function MethodEntry({ parent, node, level }: MemberProps) {
  return (
    <SignatureEntry
      node={node}
      level={level}
      id={`api-${parent.name}-method-${node.name}`}
      label={node.name}
      parameterParent={`${parent.name}-method-${node.name}`}
    />
  )
}

/**
 * The constructor entry, anchored as `api-<Parent>-constructor` and printed as the `new`
 * expression a consumer writes.
 * @param props - See {@link MemberProps}.
 * @param props.parent - The class the constructor belongs to
 * @param props.node - The constructor
 * @param props.level - Heading level of the parent symbol
 * @returns The rendered entry
 */
export function ConstructorEntry({ parent, node, level }: MemberProps) {
  return (
    <SignatureEntry
      node={node}
      level={level}
      id={`api-${parent.name}-constructor`}
      label={`new ${parent.name}`}
      parameterParent={`${parent.name}-constructor`}
    />
  )
}
