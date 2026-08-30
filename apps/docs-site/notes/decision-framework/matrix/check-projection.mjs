#!/usr/bin/env node
// Drift guard between the published docs-site dataset and the research model.
//
// The dataset at apps/docs-site/src/data/decision-framework.ts is a hand-derived
// projection of these notes. Nothing regenerates it, so it can silently diverge.
// This script reads both sides and reports the divergences that can be established
// mechanically. Where a claim cannot be checked mechanically it is reported as
// UNCHECKED with the reason, never passed silently.
//
// Model side (parsed with regexes over the stable dotted ids):
//   model/families.md         family ids, group (microfrontend vs baseline), canonical
//                             names, integration-phase poles
//   model/implementations.md  implementation and edition ids, availability states,
//                             family mappings
//   model/questions.md        question ids, ranks, exposed dimensions, and the
//                             Eliminates/favors bullets
//   matrix/attributes.json    attribute count; matrix/columns/ supplies the unit count
//
// Projection side: the .ts file is read as text; the exported object literal is
// evaluated as plain JavaScript (it contains no TypeScript syntax).
//
// Usage: node check-projection.mjs [--projection <path>] [--quiet]
// Exits 1 when drift is found, 0 otherwise.

import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const NOTES = resolve(HERE, '..')
const PROJECT_ROOT = resolve(HERE, '..', '..', '..')

const argv = process.argv.slice(2)
const projectionArg = argv.indexOf('--projection')
const QUIET = argv.includes('--quiet')

const PATHS = {
  families: join(NOTES, 'model', 'families.md'),
  implementations: join(NOTES, 'model', 'implementations.md'),
  questions: join(NOTES, 'model', 'questions.md'),
  attributes: join(HERE, 'attributes.json'),
  columns: join(HERE, 'columns'),
  projection:
    projectionArg >= 0
      ? resolve(process.cwd(), argv[projectionArg + 1])
      : join(PROJECT_ROOT, 'src', 'data', 'decision-framework.ts'),
}

const FAMILY_ID_RE = /`(family\.[a-z0-9-]+)`/g
const IMPL_ID_RE = /`(impl\.[a-z0-9.-]+)`/g
const AVAIL_ID_RE = /`avail\.([a-z-]+)`/g
const DIMENSION_ID_RE = /`(dimension\.[a-z0-9-]+)`/g
const TIME_POLE_RE = /`time\.([a-z-]+)`/g

const drift = []
const review = []
const unchecked = []
let checks = 0

const fail = (area, message) => drift.push({ area, message })
const note = (area, message) => review.push({ area, message })
const skip = (area, message) => unchecked.push({ area, message })
const pass = () => {
  checks += 1
}

const read = (path) => readFileSync(path, 'utf8')
const ids = (text, re) => {
  const found = []
  for (const match of text.matchAll(new RegExp(re.source, 'g'))) found.push(match[1])
  return found
}
const uniq = (list) => [...new Set(list)]
const sortedList = (set) => [...set].sort().join(', ')
const setsEqual = (a, b) => a.size === b.size && [...a].every((value) => b.has(value))

// ---------------------------------------------------------------- markdown blocks

// Splits a markdown document into id-keyed entries at a heading, then collects the
// `- **Field**: value` bullets of each entry, folding wrapped continuation lines in.
function parseEntries(markdown, headingRe, stopRe) {
  const entries = new Map()
  let current = null
  let field = null
  for (const line of markdown.split('\n')) {
    const heading = headingRe.exec(line)
    if (heading) {
      current = { id: heading.groups.id, heading: line, raw: [], fields: {} }
      entries.set(current.id, current)
      field = null
      continue
    }
    if (stopRe.test(line)) {
      current = null
      field = null
      continue
    }
    if (!current) continue
    current.raw.push(line)
    const bullet = /^- \*\*([^*]+)\*\*[^:]*:\s*(.*)$/.exec(line)
    if (bullet) {
      field = bullet[1]
      current.fields[field] = bullet[2]
      continue
    }
    if (/^- /.test(line)) {
      field = null
      continue
    }
    if (field && line.trim()) current.fields[field] += ` ${line.trim()}`
  }
  return entries
}

// ---------------------------------------------------------------- model: families

function parseFamilies() {
  const markdown = read(PATHS.families)
  const entries = parseEntries(
    markdown,
    /^### (?<section>[35])\.\d+\s+`(?<id>family\.[a-z0-9-]+)`/,
    /^(#{2,4}) /,
  )
  const families = new Map()
  for (const [id, entry] of entries) {
    const section = /^### ([35])\./.exec(entry.heading)[1]
    families.set(id, {
      id,
      kind: section === '3' ? 'microfrontend' : 'baseline',
      canonicalName: (entry.fields['Canonical name'] ?? '').trim(),
      integrationPoles: new Set(ids(entry.fields['Integration phase'] ?? '', TIME_POLE_RE)),
    })
  }
  return families
}

// ---------------------------------------------------------- model: implementations

function parseImplementations() {
  const markdown = read(PATHS.implementations)
  const entries = parseEntries(markdown, /^#### `(?<id>impl\.[a-z0-9.-]+)`/, /^(#{2,4}) /)
  const catalogue = new Map()
  for (const [id, entry] of entries) {
    const body = entry.raw.join('\n')
    const availabilityField = entry.fields.Availability ?? ''
    catalogue.set(id, {
      id,
      availability: uniq(ids(availabilityField, AVAIL_ID_RE)),
      families: new Set(ids(entry.fields['Unit type'] ?? '', FAMILY_ID_RE)),
      editions: parseEditions(entry.raw),
      body,
    })
  }
  // Every impl id the model mentions anywhere, so a projected id can be recognized
  // even when it is only named inside a parent entry (editions, adapters, lines).
  const mentioned = new Set(ids(markdown, IMPL_ID_RE))
  const graveyard = uniq(ids(markdown, /\*\*`(impl\.graveyard\.[a-z0-9-]+)`\*\*/))
  return { catalogue, mentioned, graveyard }
}

// Nested `- \`impl.x.edition\`: ...` bullets inside one catalogue entry.
function parseEditions(rawLines) {
  const editions = new Map()
  let open = null
  for (const line of rawLines) {
    const start = /^(\s+)- `(impl\.[a-z0-9.-]+)`/.exec(line)
    if (start) {
      open = { id: start[2], indent: start[1].length, text: line }
      editions.set(open.id, open)
      continue
    }
    if (!open) continue
    const indent = line.search(/\S/)
    if (indent >= 0 && indent <= open.indent && /^\s*- /.test(line)) {
      open = null
      continue
    }
    open.text += ` ${line.trim()}`
  }
  const parsed = new Map()
  for (const [id, edition] of editions) {
    parsed.set(id, { id, availability: uniq(ids(edition.text, AVAIL_ID_RE)) })
  }
  return parsed
}

// --------------------------------------------------------------- model: questions

function parseQuestions() {
  const markdown = read(PATHS.questions)
  const ranked = new Map()
  for (const match of markdown.matchAll(/^\|\s*(\d+)\s*\|\s*`(question\.[a-z0-9.-]+)`/gm)) {
    ranked.set(match[2], Number(match[1]))
  }
  const entries = parseEntries(markdown, /^### 3\.\d+\s+`(?<id>question\.[a-z0-9.-]+)`/, /^(#{2,4}) /)
  const questions = new Map()
  for (const [id, entry] of entries) {
    questions.set(id, {
      id,
      rank: ranked.get(id),
      dimensions: new Set(ids(entry.fields.Exposes ?? '', DIMENSION_ID_RE)),
      eliminationText: (entry.fields['Eliminates/favors'] ?? '').trim(),
    })
  }
  return { ranked, questions }
}

// Reads one Eliminates/favors bullet. The bullet is prose, so it is segmented into
// clauses and each clause inherits the elimination or retention mode of the last
// marker word seen. Consecutive clauses in the same mode form one group; a projected
// answer is supported when its elimination set matches a group.
function readEliminationBullet(text, families) {
  const mfe = new Set([...families.values()].filter((f) => f.kind === 'microfrontend').map((f) => f.id))
  const baselines = new Set([...families.values()].filter((f) => f.kind === 'baseline').map((f) => f.id))
  const clauses = text.split(/(?<=[;.])\s+/)
  const runs = []
  let mode = null
  for (const clause of clauses) {
    const eliminate = /eliminat|\bremoved?\b|\bremoves\b/i.exec(clause)
    const retain = /retain|\bfavou?rs?\b|surviv/i.exec(clause)
    if (eliminate && (!retain || eliminate.index < retain.index)) mode = 'eliminate'
    else if (retain) mode = 'retain'
    if (!runs.length || runs.at(-1).mode !== mode) runs.push({ mode, ids: new Set(), text: '' })
    const run = runs.at(-1)
    run.text += ` ${clause}`
    for (const id of ids(clause, FAMILY_ID_RE)) run.ids.add(id)
  }
  const retained = new Set()
  for (const run of runs) if (run.mode === 'retain') for (const id of run.ids) retained.add(id)

  const groups = []
  const prose = []
  for (const run of runs) {
    if (run.mode !== 'eliminate') continue
    const set = new Set(run.ids)
    const phrases = []
    if (/all seven (mfe|microfrontend) families/i.test(run.text)) {
      for (const id of mfe) set.add(id)
      phrases.push('all seven MFE families')
    }
    if (/all five baselines|build-fused baselines/i.test(run.text)) {
      for (const id of baselines) set.add(id)
      phrases.push('the baseline group')
    }
    if (/everything else is eliminated/i.test(run.text)) {
      for (const id of families.keys()) if (!retained.has(id)) set.add(id)
      phrases.push('everything else')
    }
    if (set.size) groups.push({ ids: set, phrases, text: run.text.trim() })
    else prose.push(run.text.trim())
  }
  return { groups, retained, prose, empty: text.length === 0 }
}

// -------------------------------------------------------------------- projection

function loadProjection() {
  const source = read(PATHS.projection)
  const start = source.indexOf('export const decisionFramework')
  if (start < 0) throw new Error(`no exported decisionFramework in ${PATHS.projection}`)
  const open = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let index = open; index < source.length; index += 1) {
    const char = source[index]
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        end = index
        break
      }
    }
  }
  if (end < 0) throw new Error('could not find the end of the decisionFramework literal')
  const literal = source.slice(open, end + 1)
  let value
  try {
    value = new Function(`return (${literal})`)()
  } catch (error) {
    throw new Error(
      `the decisionFramework literal is no longer plain JavaScript, so it cannot be read as data: ${error.message}`,
    )
  }
  return { source, data: value }
}

// ------------------------------------------------------------------------- checks

function checkFamilies(projection, families) {
  const projected = new Map(projection.families.map((family) => [family.id, family]))
  for (const id of projected.keys()) {
    if (!families.has(id)) fail('families', `projection has family ${id}, the model does not`)
    else pass()
  }
  for (const id of families.keys()) {
    if (!projected.has(id)) fail('families', `model has family ${id}, the projection does not`)
    else pass()
  }
  for (const [id, family] of projected) {
    const model = families.get(id)
    if (!model) continue
    if (family.kind !== model.kind) {
      fail(
        'families',
        `${id} is kind "${family.kind}" in the projection, ${model.kind} in the model (families.md section ${
          model.kind === 'microfrontend' ? '3' : '5'
        })`,
      )
    } else pass()
    if (model.canonicalName && family.name.toLowerCase() !== model.canonicalName.toLowerCase()) {
      fail('families', `${id} name "${family.name}" does not match the model canonical name "${model.canonicalName}"`)
    } else if (model.canonicalName) pass()
    const projectedPoles = new Set(
      ['build-fused', 'deploy-decoupled', 'runtime-live'].filter((pole) => family.integrationPhase.includes(pole)),
    )
    const missing = [...model.integrationPoles].filter((pole) => !projectedPoles.has(pole))
    if (missing.length) {
      fail('families', `${id} integration phase omits the model pole(s) ${missing.join(', ')}`)
    } else pass()
    const extra = [...projectedPoles].filter((pole) => !model.integrationPoles.has(pole))
    if (extra.length) {
      note(
        'families',
        `${id} integration phase adds "${extra.join(', ')}", which the model states in prose rather than as a time.* pole`,
      )
    }
  }
  skip(
    'families',
    'family prose (plainName, definition, boundary, advantages, costs, limitations, worksWellWhen, worksPoorlyWhen) is paraphrased from the model dossiers and cannot be diffed mechanically',
  )
}

function checkImplementations(projection, model, families) {
  const projected = new Map(projection.implementations.map((impl) => [impl.id, impl]))
  for (const id of projected.keys()) {
    if (!model.mentioned.has(id)) fail('implementations', `projection has implementation ${id}, the model does not`)
    else pass()
  }
  for (const [id, entry] of model.catalogue) {
    if (projected.has(id)) {
      pass()
      continue
    }
    const editionsProjected = [...entry.editions.keys()].filter((editionId) => projected.has(editionId))
    if (editionsProjected.length) {
      pass()
      continue
    }
    fail('implementations', `model catalogues ${id}, the projection has neither it nor any of its editions`)
  }
  if (model.graveyard.length) {
    skip(
      'implementations',
      `graveyard illustrations (${model.graveyard.join(', ')}) are absent from the projection by design: implementations.md 2.10 catalogues them as not adoptable, and the checker cannot verify an intentional omission`,
    )
  }

  for (const [id, impl] of projected) {
    const parentId = model.catalogue.has(id) ? id : id.split('.').slice(0, 2).join('.')
    const parent = model.catalogue.get(parentId)
    if (!parent) continue
    const edition = parent.editions.get(id)
    const states = edition && edition.availability.length ? edition.availability : parent.availability
    const scope = edition && edition.availability.length ? 'edition line' : 'unit line'
    if (!states.length) {
      skip('availability', `${id}: the model states availability in prose without an avail.* id`)
    } else if (states[0] === impl.availability) {
      pass()
      if (states.length > 1) {
        note(
          'availability',
          `${id} is "${impl.availability}" (the model's headline state) but the model records ${states.length} states on this ${scope}: ${states.join(', ')}`,
        )
      }
    } else if (states.includes(impl.availability)) {
      note(
        'availability',
        `${id} is "${impl.availability}", which the model records for a secondary line; the headline state is "${states[0]}"`,
      )
    } else {
      fail(
        'availability',
        `${id} is "${impl.availability}" in the projection; the model records ${states.join(', ')} on its ${scope}`,
      )
    }

    if (id !== parentId) {
      const suffix = id.slice(parentId.length + 1)
      if (impl.edition && impl.edition !== suffix) {
        fail(
          'implementations',
          `${id} carries edition "${impl.edition}"; the model's edition id for this entry is ${id}, so the edition is "${suffix}"`,
        )
      } else if (impl.edition) pass()
    } else if (impl.edition) {
      const named = [...parent.editions.keys()].map((editionId) => editionId.slice(parentId.length + 1))
      if (named.length && !named.includes(impl.edition)) {
        note(
          'implementations',
          `${id} carries edition "${impl.edition}" while the model names editions ${named.join(', ')} for this unit`,
        )
      } else if (!named.length) {
        note('implementations', `${id} carries edition "${impl.edition}" while the model records no edition split for this unit`)
      }
    }

    const projectedFamilies = new Set(impl.families)
    for (const familyId of projectedFamilies) {
      if (!families.has(familyId)) fail('implementations', `${id} maps to family ${familyId}, which the model does not define`)
    }
    if (parent.families.size) {
      if (setsEqual(projectedFamilies, parent.families)) pass()
      else {
        fail(
          'implementations',
          `${id} maps to families {${sortedList(projectedFamilies)}}; the model maps ${parentId} to {${sortedList(parent.families)}}`,
        )
      }
    } else {
      skip('implementations', `${id}: the model states its family placement in prose without a family.* id`)
    }
  }

  const unitsWithSplits = [...model.catalogue.values()].filter(
    (entry) => entry.editions.size > 1 && projected.has(entry.id),
  )
  if (unitsWithSplits.length) {
    skip(
      'implementations',
      `edition splits the projection collapses into one entry (${unitsWithSplits
        .map((entry) => entry.id)
        .join(', ')}): whether collapsing is correct is an editorial call, not a mechanical one`,
    )
  }
  skip('implementations', 'differsBy, url, and note prose is paraphrased from the dossiers and cannot be diffed mechanically')
}

function checkAvailabilityUnion(source, implementationsMarkdown) {
  const modelStates = uniq(
    [...implementationsMarkdown.matchAll(/^\|\s*`avail\.([a-z-]+)`\s*\|/gm)].map((match) => match[1]),
  )
  const block = /export type Availability =([\s\S]*?)\n\n/.exec(source)
  if (!block) {
    skip('availability', 'no Availability union found in the projection to compare against the seven model states')
    return
  }
  const projectedStates = uniq([...block[1].matchAll(/'([a-z-]+)'/g)].map((match) => match[1]))
  const missing = modelStates.filter((state) => !projectedStates.includes(state))
  const extra = projectedStates.filter((state) => !modelStates.includes(state))
  if (missing.length) fail('availability', `the Availability union omits the model states ${missing.join(', ')}`)
  if (extra.length) fail('availability', `the Availability union adds states the model does not define: ${extra.join(', ')}`)
  if (!missing.length && !extra.length) pass()
}

function checkQuestions(projection, model, families) {
  const projected = new Map(projection.questions.map((question) => [question.id, question]))
  for (const [id, question] of projected) {
    const modelRank = model.ranked.get(id)
    if (modelRank === undefined) {
      fail('questions', `projection has question ${id}, the model's ranked index does not`)
      continue
    }
    pass()
    if (modelRank !== question.rank) {
      fail('questions', `${id} is rank ${question.rank} in the projection, rank ${modelRank} in the model`)
    } else pass()
  }

  for (const [id, rank] of model.ranked) {
    if (projected.has(id)) continue
    const entry = model.questions.get(id)
    const analysis = entry ? readEliminationBullet(entry.eliminationText, families) : null
    const familyScoped = analysis ? analysis.groups.some((group) => group.ids.size) : false
    if (familyScoped) {
      fail('questions', `model family-stage question ${id} (rank ${rank}) is missing from the projection and eliminates at family scope`)
    } else {
      skip(
        'questions',
        `model family-stage question ${id} (rank ${rank}) is absent from the projection; its Eliminates/favors bullet names no family id (it binds at implementation or pole scope), so the omission cannot be judged mechanically`,
      )
    }
  }

  for (const [id, question] of projected) {
    const entry = model.questions.get(id)
    if (!entry) continue
    if (entry.dimensions.size) {
      if (entry.dimensions.has(question.dimension)) pass()
      else {
        fail(
          'questions',
          `${id} exposes dimension "${question.dimension}"; the model exposes ${sortedList(entry.dimensions)}`,
        )
      }
    } else {
      skip('questions', `${id}: the model names no dimension.* id under Exposes, so the projected dimension "${question.dimension}" is unverifiable`)
    }

    const analysis = readEliminationBullet(entry.eliminationText, families)
    const union = new Set(analysis.groups.flatMap((group) => [...group.ids]))
    for (const answer of question.answers) {
      if (!answer.id.startsWith(`${id}#`)) {
        fail('questions', `answer id ${answer.id} is not prefixed by its question id ${id}`)
      }
      for (const familyId of [...answer.eliminates, ...answer.favors]) {
        if (!families.has(familyId)) {
          fail('questions', `${answer.id} references family ${familyId}, which the model does not define`)
        }
      }
      if (!answer.eliminates.length) continue
      const set = new Set(answer.eliminates)
      if (!analysis.groups.length) {
        skip(
          'questions',
          `${answer.id} eliminates ${set.size} families; the model's Eliminates/favors bullet for ${id} names no family id (it routes the elimination through a constraint binding recorded in constraints.md), so the set is unverifiable here`,
        )
        continue
      }
      const exact = analysis.groups.find((group) => setsEqual(set, group.ids))
      if (exact) {
        pass()
        continue
      }
      const subset = analysis.groups.find((group) => [...set].every((familyId) => group.ids.has(familyId)))
      if (subset) {
        pass()
        note(
          'questions',
          `${answer.id} eliminates a subset of the model group for ${id} (${sortedList(set)} of ${sortedList(subset.ids)}); the model splits that group by degree in prose, so only the subset relation is checkable`,
        )
        continue
      }
      const unsupported = [...set].filter((familyId) => !union.has(familyId))
      if (unsupported.length) {
        fail(
          'questions',
          `${answer.id} eliminates ${unsupported.join(', ')}, which the model's Eliminates/favors bullet for ${id} does not put in an elimination clause`,
        )
      } else {
        pass()
        note(
          'questions',
          `${answer.id} spans more than one elimination clause of ${id} (${sortedList(set)}); supported by their union only`,
        )
      }
    }

    const eliminatedByProjection = new Set(question.answers.flatMap((answer) => answer.eliminates))
    for (const group of analysis.groups) {
      for (const familyId of group.ids) {
        if (!eliminatedByProjection.has(familyId)) {
          note(
            'questions',
            `${id}: the model puts ${familyId} in an elimination clause but no projected answer eliminates it (model text: "${group.text.slice(0, 160).trim()}")`,
          )
        }
      }
    }
    if (analysis.prose.length) {
      skip('questions', `${id}: ${analysis.prose.length} elimination clause(s) name no family id and no resolvable group phrase`)
    }
  }

  const answerIds = new Set(projection.questions.flatMap((question) => question.answers.map((answer) => answer.id)))
  for (const question of projection.questions) {
    for (const unlock of question.unlockedBy ?? []) {
      const source = projected.get(unlock.questionId)
      if (!source) {
        fail('questions', `${question.id} is unlocked by ${unlock.questionId}, which the projection does not contain`)
        continue
      }
      if (!answerIds.has(unlock.answerId)) {
        fail('questions', `${question.id} is unlocked by answer ${unlock.answerId}, which no projected question defines`)
        continue
      }
      if (unlock.questionId === question.id) {
        fail('questions', `${question.id} unlocks itself, so it can never be reached`)
        continue
      }
      pass()
      if (source.rank >= question.rank) {
        // Not drift on its own: the model's question set is a graph, not a tree, and
        // rank is expected-gain order rather than ask order, so a later-ranked question
        // may carry an in-edge to an earlier-ranked one (question-graph.md 1.1 names
        // exactly this case for rank 5). Reported so the edge is read against the graph.
        note(
          'questions',
          `${question.id} (rank ${question.rank}) is unlocked by ${unlock.questionId} (rank ${source.rank}), a backward edge; legitimate only where question-graph.md records an in-edge from the later question`,
        )
      }
    }
  }
  skip(
    'questions',
    'unlockedBy edges are checked only for internal consistency: the model states unlock conditions as prose rank references and question-graph.md owns the edge set, which this checker does not parse',
  )
  skip('questions', 'answerClass values are unverifiable: the model classifies bindings in prose per constraint, not per answer id')
  skip('questions', 'favors sets are unverifiable: the model states ranking effects per constraint binding in constraints.md, not per answer')
  skip('questions', 'circumstance, architect, why, and consequence prose is paraphrased from the model phrasings')
}

function checkMetadata(projection) {
  const attributes = JSON.parse(read(PATHS.attributes))
  const attributeCount = attributes.groups.reduce((total, group) => total + group.attributes.length, 0)
  const unitCount = readdirSync(PATHS.columns).filter((file) => file.endsWith('.json')).length
  if (projection.metadata.attributeCount !== attributeCount) {
    fail(
      'metadata',
      `attributeCount is ${projection.metadata.attributeCount} in the projection, ${attributeCount} in attributes.json`,
    )
  } else pass()
  if (projection.metadata.unitCount !== unitCount) {
    fail('metadata', `unitCount is ${projection.metadata.unitCount} in the projection, ${unitCount} column files in matrix/columns`)
  } else pass()
  skip(
    'metadata',
    'frameworkVersion, schemaVersion, researchSnapshot, and lastReviewed are editorial claims with no machine-readable counterpart in the model',
  )
}

// ---------------------------------------------------------------------- run

let families
let implementations
let questions
let source
let data
try {
  families = parseFamilies()
  implementations = parseImplementations()
  questions = parseQuestions()
  ;({ source, data } = loadProjection())
} catch (error) {
  // Exit 2, distinct from the drift exit, so a caller can tell "the guard could not
  // run" from "the guard ran and found drift".
  console.error(`check-projection: cannot compare the two sides: ${error.message}`)
  process.exit(2)
}

checkFamilies(data, families)
checkImplementations(data, implementations, families)
checkAvailabilityUnion(source, read(PATHS.implementations))
checkQuestions(data, questions, families)
checkMetadata(data)

const section = (title, rows, render) => {
  if (!rows.length) return
  console.log(`\n${title} (${rows.length})`)
  for (const row of rows) console.log(`  ${render(row)}`)
}

console.log(`projection: ${PATHS.projection}`)
console.log(`model:      ${NOTES}`)
console.log(
  `\n${families.size} families, ${implementations.catalogue.size} catalogue entries, ${questions.ranked.size} family-stage questions in the model`,
)
console.log(`${checks} mechanical assertions passed`)

section('DRIFT', drift, (row) => `[${row.area}] ${row.message}`)
if (!QUIET) {
  section('REVIEW (weaker or partial support, not drift)', review, (row) => `[${row.area}] ${row.message}`)
  section('UNCHECKED', unchecked, (row) => `[${row.area}] ${row.message}`)
}

if (drift.length) {
  console.log(`\nFAIL: ${drift.length} drift finding(s)`)
  process.exit(1)
}
console.log(`\nOK: no drift. ${review.length} review note(s), ${unchecked.length} unchecked area(s).`)
