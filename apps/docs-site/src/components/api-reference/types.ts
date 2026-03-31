// TypeDoc JSON schema types (schemaVersion 2.0)

export interface TypeDocOutput {
  schemaVersion: string
  id: number
  name: string
  variant: 'project'
  kind: number
  flags: ReflectionFlags
  children?: TypeDocNode[]
}

export interface TypeDocNode {
  id: number
  name: string
  variant: 'declaration' | 'signature' | 'param' | 'typeParam'
  kind: number
  flags: ReflectionFlags
  sources?: Source[]
  signatures?: Signature[]
  children?: TypeDocNode[]
  type?: TypeRef
  defaultValue?: string
  comment?: Comment
}

export interface Signature {
  id: number
  name: string
  variant: 'signature'
  kind: number
  flags: ReflectionFlags
  sources?: Source[]
  comment?: Comment
  typeParameters?: TypeParameter[]
  parameters?: Parameter[]
  type?: TypeRef
}

export interface Parameter {
  id: number
  name: string
  variant: 'param'
  kind: number
  flags: ReflectionFlags
  comment?: Comment
  type?: TypeRef
  defaultValue?: string
}

export interface TypeParameter {
  id: number
  name: string
  variant: 'typeParam'
  kind: number
  flags: ReflectionFlags
  type?: TypeRef
  default?: TypeRef
}

export interface Source {
  fileName: string
  line: number
  character: number
  url?: string
}

export interface Comment {
  summary?: TextBlock[]
  blockTags?: BlockTag[]
}

export interface TextBlock {
  kind: 'text' | 'code'
  text: string
}

export interface BlockTag {
  /** \@example, \@remarks, \@returns, \@param, \@see, etc. */
  tag: string
  content: TextBlock[]
  /** Parameter name for \@param tags */
  name?: string
}

export interface TypeRef {
  type:
    | 'intrinsic'
    | 'reference'
    | 'array'
    | 'union'
    | 'intersection'
    | 'literal'
    | 'reflection'
    | 'tuple'
    | 'rest'
    | 'conditional'
    | 'mapped'
    | 'indexedAccess'
    | 'templateLiteral'
  /** For intrinsic and reference types */
  name?: string
  /** For reference types */
  target?: number | { sourceFileName: string; qualifiedName: string }
  /** Package that contains the reference */
  package?: string
  /** For generic references */
  typeArguments?: TypeRef[]
  /** For array and rest types */
  elementType?: TypeRef
  /** For tuple types */
  elements?: TypeRef[]
  /** For union and intersection types */
  types?: TypeRef[]
  /** For literal types */
  value?: unknown
  /** For reflection types */
  declaration?: TypeDocNode
  refersToTypeParameter?: boolean
}

export interface ReflectionFlags {
  isPublic?: boolean
  isPrivate?: boolean
  isProtected?: boolean
  isStatic?: boolean
  isOptional?: boolean
  isRest?: boolean
  isAbstract?: boolean
  isReadonly?: boolean
  isExternal?: boolean
}

// TypeDoc reflection kind constants
export const ReflectionKind = <const>{
  Project: 1,
  Module: 2,
  Namespace: 4,
  Enum: 8,
  EnumMember: 16,
  Variable: 32,
  Function: 64,
  Class: 128,
  Interface: 256,
  Constructor: 512,
  Property: 1024,
  Method: 2048,
  CallSignature: 4096,
  IndexSignature: 8192,
  ConstructorSignature: 16384,
  Parameter: 32768,
  TypeLiteral: 65536,
  TypeParameter: 131072,
  Accessor: 262144,
  GetSignature: 524288,
  SetSignature: 1048576,
  TypeAlias: 2097152,
  Reference: 4194304,
}
