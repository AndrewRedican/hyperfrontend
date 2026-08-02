import type { FeatureContract } from '@hyperfrontend/features/hostee'

/**
 * Contract for the clock coin feature.
 *
 * The feature owns all state; the host commands, the feature confirms with echo
 * events. The coin's resting face *is* the clock's format: every flip a visitor
 * makes emits `format-changed`, and every `set-format` the host sends plays out
 * as a physics flip.
 */
const contract = {
  version: '0.2.0',
  accepted: [
    {
      type: 'get-time',
      description: 'Ask for the current time snapshot. Answered directly when sent as a request, and always echoed as a `time` event.',
    },
    {
      type: 'set-format',
      description: 'Flip the coin to a face. The feature confirms with `format-changed` (cause: "host").',
      schema: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['analog', 'digital'] } },
        required: ['format'],
      },
    },
    {
      type: 'set-timezone',
      description: 'Change the clock timezone (IANA id, e.g. "Europe/Madrid"). Confirmed by `timezone-changed`.',
      schema: {
        type: 'object',
        properties: { timezone: { type: 'string' } },
        required: ['timezone'],
      },
    },
    {
      type: 'set-locale',
      description: 'Change the formatting locale (BCP-47, e.g. "es-CR"). Confirmed by `locale-changed`.',
      schema: {
        type: 'object',
        properties: { locale: { type: 'string' } },
        required: ['locale'],
      },
    },
    {
      type: 'set-alarm',
      description: 'Arm a one-shot alarm at the next occurrence of HH:mm in the clock timezone. Confirmed by `alarm-set`.',
      schema: {
        type: 'object',
        properties: {
          at: { type: 'string', pattern: '^([01][0-9]|2[0-3]):[0-5][0-9]$' },
          label: { type: 'string' },
        },
        required: ['at'],
      },
    },
    {
      type: 'clear-alarm',
      description: 'Disarm a pending alarm by id. Confirmed by `alarm-cleared`.',
      schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  ],
  emitted: [
    {
      type: 'tick',
      description: 'Time snapshot streamed at 1 Hz while the feature is connected.',
      schema: {
        type: 'object',
        properties: {
          epochMs: { type: 'number' },
          iso: { type: 'string' },
          timezone: { type: 'string' },
          locale: { type: 'string' },
          format: { type: 'string', enum: ['analog', 'digital'] },
          formatted: { type: 'string' },
        },
        required: ['epochMs', 'iso', 'timezone', 'locale', 'format', 'formatted'],
      },
    },
    {
      type: 'time',
      description: 'The same snapshot as `tick`, sent once in answer to `get-time`.',
      schema: {
        type: 'object',
        properties: {
          epochMs: { type: 'number' },
          iso: { type: 'string' },
          timezone: { type: 'string' },
          locale: { type: 'string' },
          format: { type: 'string', enum: ['analog', 'digital'] },
          formatted: { type: 'string' },
        },
        required: ['epochMs', 'iso', 'timezone', 'locale', 'format', 'formatted'],
      },
    },
    {
      type: 'format-changed',
      description:
        'The coin settled on a face: after a visitor flip ("user"), a `set-format` command ("host"), or an alarm firing ("alarm").',
      schema: {
        type: 'object',
        properties: {
          format: { type: 'string', enum: ['analog', 'digital'] },
          cause: { type: 'string', enum: ['user', 'host', 'alarm'] },
        },
        required: ['format', 'cause'],
      },
    },
    {
      type: 'timezone-changed',
      description: 'Echo confirming a `set-timezone` command was applied.',
      schema: {
        type: 'object',
        properties: { timezone: { type: 'string' } },
        required: ['timezone'],
      },
    },
    {
      type: 'locale-changed',
      description: 'Echo confirming a `set-locale` command was applied.',
      schema: {
        type: 'object',
        properties: { locale: { type: 'string' } },
        required: ['locale'],
      },
    },
    {
      type: 'alarm-set',
      description: 'Echo confirming an alarm was armed, with its resolved fire time.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          at: { type: 'string' },
          firesAtEpochMs: { type: 'number' },
        },
        required: ['id', 'at', 'firesAtEpochMs'],
      },
    },
    {
      type: 'alarm-fired',
      description: 'An armed alarm reached its fire time; the coin flips itself to the digital face.',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          at: { type: 'string' },
          label: { type: 'string' },
        },
        required: ['id', 'at'],
      },
    },
    {
      type: 'alarm-cleared',
      description: 'Echo confirming an alarm was disarmed.',
      schema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  ],
} satisfies FeatureContract

export default contract
