/**
 * Tests for prompt rendering utilities.
 */
import { Symbol, style, renderMessage, renderSubmitted, renderCancelled, renderHint } from './render'
import { Ansi } from './terminal'

describe('Symbol', () => {
  it('contains Pointer symbol', () => {
    expect(Symbol.Pointer).toBe('❯')
  })

  it('contains Radio symbol', () => {
    expect(Symbol.Radio).toBe('◯')
  })

  it('contains RadioSelected symbol', () => {
    expect(Symbol.RadioSelected).toBe('◉')
  })

  it('contains Checkbox symbol', () => {
    expect(Symbol.Checkbox).toBe('☐')
  })

  it('contains CheckboxSelected symbol', () => {
    expect(Symbol.CheckboxSelected).toBe('☑')
  })

  it('contains Check symbol', () => {
    expect(Symbol.Check).toBe('✔')
  })

  it('contains Cross symbol', () => {
    expect(Symbol.Cross).toBe('✖')
  })

  it('contains Question symbol', () => {
    expect(Symbol.Question).toBe('?')
  })

  it('contains Ellipsis symbol', () => {
    expect(Symbol.Ellipsis).toBe('…')
  })
})

describe('style', () => {
  describe('bold', () => {
    it('wraps text in bold ANSI codes', () => {
      const result = style.bold('test')

      expect(result).toBe(`${Ansi.Bold}test${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.bold('')

      expect(result).toBe(`${Ansi.Bold}${Ansi.Reset}`)
    })
  })

  describe('dim', () => {
    it('wraps text in dim ANSI codes', () => {
      const result = style.dim('faded')

      expect(result).toBe(`${Ansi.Dim}faded${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.dim('')

      expect(result).toBe(`${Ansi.Dim}${Ansi.Reset}`)
    })
  })

  describe('cyan', () => {
    it('wraps text in cyan ANSI codes', () => {
      const result = style.cyan('info')

      expect(result).toBe(`${Ansi.Cyan}info${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.cyan('')

      expect(result).toBe(`${Ansi.Cyan}${Ansi.Reset}`)
    })
  })

  describe('green', () => {
    it('wraps text in green ANSI codes', () => {
      const result = style.green('success')

      expect(result).toBe(`${Ansi.Green}success${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.green('')

      expect(result).toBe(`${Ansi.Green}${Ansi.Reset}`)
    })
  })

  describe('yellow', () => {
    it('wraps text in yellow ANSI codes', () => {
      const result = style.yellow('warning')

      expect(result).toBe(`${Ansi.Yellow}warning${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.yellow('')

      expect(result).toBe(`${Ansi.Yellow}${Ansi.Reset}`)
    })
  })

  describe('gray', () => {
    it('wraps text in gray ANSI codes', () => {
      const result = style.gray('muted')

      expect(result).toBe(`${Ansi.Gray}muted${Ansi.Reset}`)
    })

    it('handles empty string', () => {
      const result = style.gray('')

      expect(result).toBe(`${Ansi.Gray}${Ansi.Reset}`)
    })
  })
})

describe('renderMessage', () => {
  it('renders message with cyan question mark and bold text', () => {
    const result = renderMessage('Enter name')

    expect(result).toContain(style.cyan(Symbol.Question))
    expect(result).toContain(style.bold('Enter name'))
    expect(result.endsWith(' ')).toBe(true)
  })

  it('handles empty message', () => {
    const result = renderMessage('')

    expect(result).toContain(style.cyan(Symbol.Question))
    expect(result).toContain(style.bold(''))
  })

  it('preserves message content', () => {
    const result = renderMessage('What is your favorite color?')

    expect(result).toContain('What is your favorite color?')
  })
})

describe('renderSubmitted', () => {
  it('renders value in cyan', () => {
    const result = renderSubmitted('John Doe')

    expect(result).toBe(style.cyan('John Doe'))
  })

  it('handles empty value', () => {
    const result = renderSubmitted('')

    expect(result).toBe(style.cyan(''))
  })

  it('preserves special characters', () => {
    const result = renderSubmitted('test@example.com')

    expect(result).toBe(style.cyan('test@example.com'))
  })
})

describe('renderCancelled', () => {
  it('renders dimmed cancelled text', () => {
    const result = renderCancelled()

    expect(result).toBe(style.dim('(cancelled)'))
  })
})

describe('renderHint', () => {
  it('renders hint with leading space in dim style', () => {
    const result = renderHint('press enter to confirm')

    expect(result).toBe(style.dim(' press enter to confirm'))
  })

  it('handles empty hint', () => {
    const result = renderHint('')

    expect(result).toBe(style.dim(' '))
  })

  it('preserves hint content', () => {
    const result = renderHint('optional field')

    expect(result).toContain(' optional field')
  })
})
