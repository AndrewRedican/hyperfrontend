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
  tag: string // '@example', '@remarks', '@returns', '@param', '@see', etc.
  content: TextBlock[]
  name?: string // Parameter name for @param tags
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
  name?: string // For intrinsic and reference types
  target?: number | { sourceFileName: string; qualifiedName: string } // For reference types
  package?: string // Package that contains the reference
  typeArguments?: TypeRef[] // For generic references
  elementType?: TypeRef // For array and rest types
  elements?: TypeRef[] // For tuple types
  types?: TypeRef[] // For union and intersection types
  value?: unknown // For literal types
  declaration?: TypeDocNode // For reflection types
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
