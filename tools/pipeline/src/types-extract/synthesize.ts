/**
 * Declarations the extraction rewrites into a form it can carry: a class becomes the interface of
 * its public instance members, an enum becomes the union of its member values.
 *
 * @module types-extract/synthesize
 */

import ts from 'typescript'
import { createSet } from '@hyperfrontend/immutable-api-utils/built-in-copy/set'

/** A rewritten declaration. */
export interface Synthesized {
  /** The declaration's text, exported. */
  readonly text: string
  /** What the rewrite dropped or changed, as sentences for the report. */
  readonly notes: readonly string[]
}

const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed })

/**
 * Copies a node's leading JSDoc onto a synthesized node.
 *
 * @param from - The original node
 * @param to - The synthesized node
 * @param sourceFile - The original file
 * @returns The synthesized node
 */
function withJsDoc<TNode extends ts.Node>(from: ts.Node, to: TNode, sourceFile: ts.SourceFile): TNode {
  for (const range of ts.getLeadingCommentRanges(sourceFile.text, from.getFullStart()) ?? []) {
    const text = sourceFile.text.slice(range.pos, range.end)
    if (range.kind === ts.SyntaxKind.MultiLineCommentTrivia && text.startsWith('/**')) {
      ts.addSyntheticLeadingComment(to, ts.SyntaxKind.MultiLineCommentTrivia, text.slice(2, -2), true)
    }
  }
  return to
}

/**
 * The text of a member's name.
 *
 * @param name - The name node
 * @returns Its text
 */
function nameText(name: ts.PropertyName | ts.BindingName): string {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) || ts.isPrivateIdentifier(name)
    ? name.text
    : name.getText()
}

/**
 * Whether a class member is part of the instance type's public surface.
 *
 * @param member - The declaration judged: a class element or a constructor parameter
 * @returns False for static, private and protected members and private names
 */
function isPublicInstance(member: ts.ClassElement | ts.ParameterDeclaration): boolean {
  const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : []
  const hidden = modifiers.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.StaticKeyword ||
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword
  )
  return !hidden && !(member.name !== undefined && ts.isPrivateIdentifier(member.name))
}

/**
 * The `readonly` modifier when a member has one.
 *
 * @param member - The class element or parameter whose modifiers are read
 * @returns The modifier list, or undefined
 */
function readonlyOf(member: ts.Node): ts.Modifier[] | undefined {
  const modifiers = ts.canHaveModifiers(member) ? (ts.getModifiers(member) ?? []) : []
  return modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword)
    ? [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)]
    : undefined
}

const unknownType = (): ts.TypeNode => ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)

/**
 * A parameter stripped of its initializer, optional when it had one, typed `unknown` when untyped.
 *
 * @param parameter - The original parameter
 * @returns The parameter as a method signature carries it
 */
function signatureParameter(parameter: ts.ParameterDeclaration): ts.ParameterDeclaration {
  const optional =
    parameter.questionToken ?? (parameter.initializer === undefined ? undefined : ts.factory.createToken(ts.SyntaxKind.QuestionToken))
  return ts.factory.createParameterDeclaration(
    undefined,
    parameter.dotDotDotToken,
    parameter.name,
    optional,
    parameter.type ?? unknownType(),
    undefined
  )
}

/**
 * The interface of a class's public instance members: properties, methods, accessors, index
 * signatures and public parameter properties, with the constructor, statics and non-public
 * members dropped and both `extends` and `implements` carried as `extends`.
 *
 * @param declaration - The class to carry
 * @param sourceFile - Its file
 * @returns The interface text and what was dropped
 */
export function classToInterface(declaration: ts.ClassDeclaration, sourceFile: ts.SourceFile): Synthesized {
  const notes: string[] = []
  const members: ts.TypeElement[] = []
  const overloaded = createSet<string>()
  for (const member of declaration.members) {
    if (ts.isMethodDeclaration(member) && member.body === undefined) overloaded.add(nameText(member.name))
  }
  const setters = createSet<string>()
  for (const member of declaration.members) if (ts.isSetAccessorDeclaration(member)) setters.add(nameText(member.name))
  for (const member of declaration.members) {
    if (ts.isConstructorDeclaration(member)) {
      notes.push('the constructor is dropped')
      for (const parameter of member.parameters) {
        if (ts.canHaveModifiers(parameter) && (ts.getModifiers(parameter) ?? []).length > 0 && isPublicInstance(parameter)) {
          members.push(
            withJsDoc(
              parameter,
              ts.factory.createPropertySignature(
                readonlyOf(parameter),
                parameter.name as ts.Identifier,
                parameter.questionToken,
                parameter.type ?? unknownType()
              ),
              sourceFile
            )
          )
        }
      }
      continue
    }
    if (ts.isIndexSignatureDeclaration(member)) {
      members.push(member)
      continue
    }
    if (ts.isClassStaticBlockDeclaration(member) || ts.isSemicolonClassElement(member)) continue
    const name = nameText(member.name)
    if (!isPublicInstance(member)) {
      notes.push(`the member ${name} is dropped: static, private or protected`)
      continue
    }
    if (ts.isPropertyDeclaration(member)) {
      members.push(
        withJsDoc(
          member,
          ts.factory.createPropertySignature(readonlyOf(member), member.name, member.questionToken, member.type ?? unknownType()),
          sourceFile
        )
      )
    } else if (ts.isMethodDeclaration(member)) {
      if (member.body !== undefined && overloaded.has(name)) continue
      members.push(
        withJsDoc(
          member,
          ts.factory.createMethodSignature(
            undefined,
            member.name,
            member.questionToken,
            member.typeParameters,
            member.parameters.map(signatureParameter),
            member.type ?? unknownType()
          ),
          sourceFile
        )
      )
    } else if (ts.isGetAccessorDeclaration(member)) {
      const readonly = setters.has(name) ? undefined : [ts.factory.createModifier(ts.SyntaxKind.ReadonlyKeyword)]
      members.push(
        withJsDoc(member, ts.factory.createPropertySignature(readonly, member.name, undefined, member.type ?? unknownType()), sourceFile)
      )
    } else if (
      ts.isSetAccessorDeclaration(member) &&
      !declaration.members.some((other) => ts.isGetAccessorDeclaration(other) && nameText(other.name) === name)
    ) {
      members.push(
        withJsDoc(
          member,
          ts.factory.createPropertySignature(undefined, member.name, undefined, member.parameters[0]?.type ?? unknownType()),
          sourceFile
        )
      )
    }
  }
  const heritage = (declaration.heritageClauses ?? []).flatMap((clause) => [...clause.types])
  const node = withJsDoc(
    declaration,
    ts.factory.createInterfaceDeclaration(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      declaration.name as ts.Identifier,
      declaration.typeParameters,
      heritage.length === 0 ? undefined : [ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, heritage)],
      members
    ),
    sourceFile
  )
  notes.unshift('a class, carried as the interface of its public instance members')
  return { text: printer.printNode(ts.EmitHint.Unspecified, node, sourceFile), notes }
}

/** The literal type of one enum member and the value the next uninitialised member takes. */
interface MemberLiteral {
  /** The literal's text. */
  readonly text: string
  /** The value the next uninitialised member takes. */
  readonly next: number
}

/**
 * The literal type of one enum member: its string or numeric initializer, or its position when it
 * has none.
 *
 * @param member - The enum member
 * @param ordinal - The value an uninitialised member takes
 * @returns The literal text and the next ordinal, or null for a computed member
 */
function memberLiteral(member: ts.EnumMember, ordinal: number): MemberLiteral | null {
  const initializer = member.initializer
  if (initializer === undefined) return { text: String(ordinal), next: ordinal + 1 }
  if (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))
    return { text: `'${initializer.text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`, next: ordinal }
  if (ts.isNumericLiteral(initializer)) return { text: initializer.text, next: Number(initializer.text) + 1 }
  if (
    ts.isPrefixUnaryExpression(initializer) &&
    initializer.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(initializer.operand)
  ) {
    return { text: `-${initializer.operand.text}`, next: -Number(initializer.operand.text) + 1 }
  }
  return null
}

/**
 * The literal type of one enum member, by name.
 *
 * @param declaration - The enum holding the member
 * @param name - The member looked up
 * @returns The literal text, or null when the member is absent or computed
 */
export function enumMemberType(declaration: ts.EnumDeclaration, name: string): string | null {
  let ordinal = 0
  for (const member of declaration.members) {
    const literal = memberLiteral(member, ordinal)
    if (literal === null) {
      if (nameText(member.name) === name) return null
      continue
    }
    if (nameText(member.name) === name) return literal.text
    ordinal = literal.next
  }
  return null
}

/**
 * The union of an enum's member values, as a type alias.
 *
 * @param declaration - The enum to carry
 * @param sourceFile - Its file
 * @returns The alias text and what was changed
 */
export function enumToAlias(declaration: ts.EnumDeclaration, sourceFile: ts.SourceFile): Synthesized {
  const notes = ['an enum, carried as the union of its member values']
  const parts: string[] = []
  let ordinal = 0
  for (const member of declaration.members) {
    const literal = memberLiteral(member, ordinal)
    if (literal === null) {
      notes.push(`the member ${nameText(member.name)} is computed and widens the union to number`)
      parts.push('number')
      continue
    }
    parts.push(literal.text)
    ordinal = literal.next
  }
  const union = [...createSet(parts)].join(' | ')
  const jsDoc = (ts.getLeadingCommentRanges(sourceFile.text, declaration.getFullStart()) ?? [])
    .map((range) => sourceFile.text.slice(range.pos, range.end))
    .filter((text) => text.startsWith('/**'))
    .map((text) => `${text}\n`)
    .join('')
  return { text: `${jsDoc}export type ${declaration.name.text} = ${union.length === 0 ? 'never' : union};`, notes }
}
