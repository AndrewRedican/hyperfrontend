/** TypeDoc JSON output root structure */
export interface TypeDocOutput {
  /** JSON schema version */
  schemaVersion: string
  /** Root node ID */
  id: number
  /** Project name */
  name: string
  /** Always 'project' for root */
  variant: 'project'
  /** Reflection kind number */
  kind: number
  /** Reflection flags */
  flags: ReflectionFlags
  /** Child nodes */
  children?: TypeDocNode[]
}

/** TypeDoc declaration node representing a code element */
export interface TypeDocNode {
  /** Unique node ID */
  id: number
  /** Element name */
  name: string
  /** Node variant type */
  variant: 'declaration' | 'signature' | 'param' | 'typeParam'
  /** Reflection kind number */
  kind: number
  /** Reflection flags */
  flags: ReflectionFlags
  /** Source file locations */
  sources?: Source[]
  /** Function/method signatures */
  signatures?: Signature[]
  /** Child declarations */
  children?: TypeDocNode[]
  /** Type reference */
  type?: TypeRef
  /** Default value string */
  defaultValue?: string
  /** Documentation comment */
  comment?: Comment
}

/** Function or method signature */
export interface Signature {
  /** Unique signature ID */
  id: number
  /** Signature name */
  name: string
  /** Always 'signature' */
  variant: 'signature'
  /** Reflection kind number */
  kind: number
  /** Reflection flags */
  flags: ReflectionFlags
  /** Source file locations */
  sources?: Source[]
  /** Documentation comment */
  comment?: Comment
  /** Generic type parameters */
  typeParameters?: TypeParameter[]
  /** Function parameters */
  parameters?: Parameter[]
  /** Return type */
  type?: TypeRef
}

/** Function parameter */
export interface Parameter {
  /** Unique parameter ID */
  id: number
  /** Parameter name */
  name: string
  /** Always 'param' */
  variant: 'param'
  /** Reflection kind number */
  kind: number
  /** Reflection flags */
  flags: ReflectionFlags
  /** Parameter documentation */
  comment?: Comment
  /** Parameter type */
  type?: TypeRef
  /** Default value string */
  defaultValue?: string
}

/** Generic type parameter */
export interface TypeParameter {
  /** Unique type parameter ID */
  id: number
  /** Type parameter name */
  name: string
  /** Always 'typeParam' */
  variant: 'typeParam'
  /** Reflection kind number */
  kind: number
  /** Reflection flags */
  flags: ReflectionFlags
  /** Constraint type */
  type?: TypeRef
  /** Default type */
  default?: TypeRef
}

/** Source file location */
export interface Source {
  /** File name */
  fileName: string
  /** Line number */
  line: number
  /** Character position */
  character: number
  /** Source URL */
  url?: string
}

/** Documentation comment structure */
export interface Comment {
  /** Summary text blocks */
  summary?: TextBlock[]
  /** Block tags like `@param`, `@returns` */
  blockTags?: BlockTag[]
}

/** Text block within a comment */
export interface TextBlock {
  /** Block type: text or code */
  kind: 'text' | 'code'
  /** Block content */
  text: string
}

/** Block tag in a documentation comment */
export interface BlockTag {
  /** Tag name (`@example`, `@remarks`, `@returns`, `@param`, `@see`, etc.) */
  tag: string
  /** Content blocks for this tag */
  content: TextBlock[]
  /** Parameter name for `@param` tags */
  name?: string
}

/**
 * Target reference for external types.
 */
export interface ExternalTypeTarget {
  /** Source file containing the type */
  sourceFileName: string
  /** Fully qualified name of the type */
  qualifiedName: string
}

/** Type reference in TypeDoc output */
export interface TypeRef {
  /** Kind of type reference */
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
  target?: number | ExternalTypeTarget
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
  /** Whether this reference refers to a type parameter */
  refersToTypeParameter?: boolean
}

/** Flags indicating visibility and modifiers of a reflection */
export interface ReflectionFlags {
  /** Whether the member is public */
  isPublic?: boolean
  /** Whether the member is private */
  isPrivate?: boolean
  /** Whether the member is protected */
  isProtected?: boolean
  /** Whether the member is static */
  isStatic?: boolean
  /** Whether the member is optional */
  isOptional?: boolean
  /** Whether the member accepts rest parameters */
  isRest?: boolean
  /** Whether the member is abstract */
  isAbstract?: boolean
  /** Whether the member is readonly */
  isReadonly?: boolean
  /** Whether the member is from an external source */
  isExternal?: boolean
}

/** Constant mapping reflection kind names to their numeric values */
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
