import type { InvalidTestCase, ValidTestCase } from '@typescript-eslint/rule-tester'
import type { RuleModule } from '@typescript-eslint/utils/ts-eslint'
import jsdoc from 'eslint-plugin-jsdoc'
import { createTypeScriptRuleTester } from '../testing'
import { REQUIRE_JSDOC_OPTIONS } from './require-jsdoc'

type TestOptions = readonly [typeof REQUIRE_JSDOC_OPTIONS & { enableFixer: false }]
type MessageIds = 'missingJsDoc'

// why: the cases exercise the plugin rule under the options the base config hands it, so a change to either shows up here
const rule = jsdoc.rules['require-jsdoc'] as unknown as RuleModule<MessageIds, TestOptions>
// why: the fixer only inserts an empty block, which the tester would demand an `output` for on every case; what is under test is what gets reported
const options: TestOptions = [{ ...REQUIRE_JSDOC_OPTIONS, enableFixer: false }]
const ruleTester = createTypeScriptRuleTester()

const validCases: ValidTestCase<TestOptions>[] = [
  {
    name: 'documented public method',
    code: `class Store {
  /**
   * Reads the state.
   *
   * @returns A copy of the state
   */
  getState(): number {
    return 1
  }
}`,
    options,
  },
  {
    name: 'documented protected method and arrow-function property',
    code: `class Store {
  /**
   * Flips the flag.
   *
   * @param next - The new value
   */
  protected set(next: boolean): void {
    this.flag = next
  }

  /**
   * Reads the flag.
   *
   * @returns The current value
   */
  readonly read = (): boolean => this.flag

  private flag = false
}`,
    options,
  },
  {
    name: 'private members and #names need no comment',
    code: `class Store {
  private state = 1
  #listeners: number[] = []

  private reduce(): void {
    this.state += 1
  }

  #notify(): void {
    this.#listeners.length = 0
  }
}`,
    options,
  },
  {
    name: 'a constructor without parameters is described by its class',
    code: `class Store {
  private state: number

  constructor() {
    this.state = 1
  }
}`,
    options,
  },
  {
    name: 'a setter shares the comment of its getter',
    code: `class Store {
  private _value = 0

  /**
   * The held value.
   *
   * @returns The current value
   */
  get value(): number {
    return this._value
  }

  set value(next: number) {
    this._value = next
  }
}`,
    options,
  },
  {
    name: 'documented abstract members, private ones exempt',
    code: `abstract class Component {
  /** Starts the component. */
  public abstract start: () => Promise<void>

  /**
   * Stops the component.
   *
   * @returns Resolves once stopped
   */
  public abstract stop(): Promise<void>

  private abstract hidden(): void
}`,
    options,
  },
  {
    name: 'documented overload signatures exempt their implementation',
    code: `class Reader {
  /**
   * Reads a string.
   *
   * @param input - The text
   * @returns The text
   */
  read(input: string): string
  /**
   * Reads a number.
   *
   * @param input - The number
   * @returns The number
   */
  read(input: number): number
  read(input: string | number): string | number {
    return input
  }
}`,
    options,
  },
]

const invalidCases: InvalidTestCase<MessageIds, TestOptions>[] = [
  {
    name: 'undocumented public method',
    code: `class Store {
  getState(): number {
    return 1
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented protected method',
    code: `class Store {
  protected reset(): void {}
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented static method',
    code: `class Store {
  static create(): Store {
    return new Store()
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented public field and arrow-function property',
    code: `class Store {
  readonly delimiter = ','
  public readonly read = (): number => 1
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }, { messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented constructor with parameters',
    code: `class Store {
  private state: number

  constructor(state: number) {
    this.state = state
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented getter',
    code: `class Store {
  get value(): number {
    return 1
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented setter without a getter',
    code: `class Store {
  private _value = 0

  set value(next: number) {
    this._value = next
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented abstract members',
    code: `abstract class Component {
  public abstract start: () => Promise<void>
  public abstract stop(): Promise<void>
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }, { messageId: 'missingJsDoc' }],
  },
  {
    name: 'members of an exported class, class comment present',
    code: `/** A store. */
export class Store {
  dispatch(): void {}
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }],
  },
  {
    name: 'undocumented overload signatures',
    code: `class Reader {
  read(input: string): string
  read(input: number): number
  read(input: string | number): string | number {
    return input
  }
}`,
    options,
    errors: [{ messageId: 'missingJsDoc' }, { messageId: 'missingJsDoc' }],
  },
]

ruleTester.run('require-jsdoc-class-members', rule, {
  valid: validCases,
  invalid: invalidCases,
})
