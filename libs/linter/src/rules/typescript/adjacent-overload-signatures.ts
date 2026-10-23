/**
 * The overload signatures of one function, method or constructor read as a unit when they sit
 * together; one separated from its siblings by another member is reported.
 *
 * @module rules/typescript/adjacent-overload-signatures
 */

import type { Node } from '../../code/model'
import type { RuleFile } from '../../engine/rule'
import { isIdentifierPart, isIdentifierStart } from '../../code/scanner-tables'
import { defineRule } from '../../engine/rule'

/** How a member's name was written, which decides whether two spellings name one member. */
type NameShape = 'normal' | 'private' | 'quoted' | 'expression'

/** A member that can carry overloads: its name and what kind of member it is. */
interface Signature {
  /** The name as the report prints it. */
  readonly name: string
  /** How the name was written. */
  readonly shape: NameShape
  /** Whether the member is static. */
  readonly isStatic: boolean
  /** Whether the member is a call or construct signature rather than a named one. */
  readonly isCallSignature: boolean
}

/** A name and its shape, as read from a member's key. */
interface MemberName {
  /** The name as the report prints it. */
  readonly name: string
  /** How the name was written. */
  readonly shape: NameShape
}

export default defineRule<undefined, Node>({
  id: 'typescript/adjacent-overload-signatures',
  language: 'code',
  fixable: false,
  create(context) {
    const check = (members: readonly Node[]): void => {
      const seen: Signature[] = []
      let last: Signature | null = null
      for (const member of members) {
        const signature = signatureOf(member, context.file)
        if (signature === null) {
          last = null
          continue
        }
        const index = seen.findIndex((candidate) => isSame(signature, candidate))
        if (index > -1 && !isSame(signature, last)) {
          const name = `${signature.isStatic ? 'static ' : ''}${signature.name}`
          context.report({ start: member.start, end: member.end, message: `All ${name} signatures should be adjacent.` })
        } else if (index === -1) {
          seen.push(signature)
        }
        last = signature
      }
    }
    const checkBody = (node: Node): void => check(node.body as readonly Node[])
    return {
      Program: checkBody,
      BlockStatement: checkBody,
      ClassBody: checkBody,
      TSInterfaceBody: checkBody,
      TSModuleBlock: checkBody,
      TSTypeLiteral(node) {
        check(node.members as readonly Node[])
      },
    }
  },
})

/**
 * Whether two members are the same overloadable member.
 *
 * @param a - One member's signature
 * @param b - Another's, or null when the previous member carries none
 * @returns Whether they share name, shape, staticness and signature kind
 */
function isSame(a: Signature, b: Signature | null): boolean {
  return b !== null && a.name === b.name && a.shape === b.shape && a.isStatic === b.isStatic && a.isCallSignature === b.isCallSignature
}

/**
 * The signature a member contributes to its body's overload groups, if any.
 *
 * @param member - A statement of a program, block or module, or a member of a class, interface or type literal
 * @param file - The file linted, for the text of a computed key
 * @returns The signature, or null for a member that cannot be overloaded
 */
function signatureOf(member: Node, file: RuleFile): Signature | null {
  switch (member.kind) {
    case 'ExportDefaultDeclaration':
    case 'ExportNamedDeclaration': {
      const declaration = member.declaration as Node | null
      return declaration === null ? null : signatureOf(declaration, file)
    }
    case 'FunctionDeclaration':
    case 'TSDeclareFunction': {
      const id = member.id as Node | null
      return id === null ? null : { name: id.name as string, shape: 'normal', isStatic: false, isCallSignature: false }
    }
    case 'TSMethodSignature':
      return { ...nameOf(member, file), isStatic: false, isCallSignature: false }
    case 'TSCallSignatureDeclaration':
      return { name: 'call', shape: 'normal', isStatic: false, isCallSignature: true }
    case 'TSConstructSignatureDeclaration':
      return { name: 'new', shape: 'normal', isStatic: false, isCallSignature: true }
    case 'MethodDefinition':
      return { ...nameOf(member, file), isStatic: member.static === true, isCallSignature: false }
    default:
      return null
  }
}

/**
 * The name of a keyed member as the report prints it, with the shape that tells a quoted name
 * from a bare one and a private name from either.
 *
 * @param member - A method definition or method signature
 * @param file - The file linted, for the text of a computed key
 * @returns The name and its shape
 */
function nameOf(member: Node, file: RuleFile): MemberName {
  const key = member.key as Node
  if (key.kind === 'Identifier') return { name: key.name as string, shape: 'normal' }
  if (key.kind === 'PrivateIdentifier') return { name: `#${key.name as string}`, shape: 'private' }
  if (key.kind === 'Literal') {
    const name = `${key.value as string | number}`
    return requiresQuoting(name) ? { name: `"${name}"`, shape: 'quoted' } : { name, shape: 'normal' }
  }
  return { name: file.text.slice(key.start, key.end), shape: 'expression' }
}

/**
 * Whether a literal member name could not have been written bare.
 *
 * @param name - The literal's text
 * @returns Whether it is empty or not an identifier
 */
function requiresQuoting(name: string): boolean {
  let first = true
  for (const char of name) {
    if (first ? !isIdentifierStart(char) : !isIdentifierPart(char)) return true
    first = false
  }
  return first
}
