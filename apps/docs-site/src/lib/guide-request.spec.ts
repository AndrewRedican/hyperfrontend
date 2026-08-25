import { describe, expect, it } from 'vitest'
import { createURL } from '@hyperfrontend/immutable-api-utils/built-in-copy/url'
import { buildGuideRequestUrl } from './guide-request'

describe('buildGuideRequestUrl', () => {
  it("opens GitHub's own new-issue page rather than any custom integration", () => {
    expect(createURL(buildGuideRequestUrl()).pathname).toBe('/AndrewRedican/hyperfrontend/issues/new')
  })

  it('selects the guide request template', () => {
    expect(createURL(buildGuideRequestUrl()).searchParams.get('template')).toBe('guide_request.yml')
  })

  it('prefills the form package field when the reader came from a package view', () => {
    expect(createURL(buildGuideRequestUrl('@hyperfrontend/nexus')).searchParams.get('package')).toBe('@hyperfrontend/nexus')
  })

  it('names the package in the issue title so triage reads it from the list', () => {
    expect(createURL(buildGuideRequestUrl('@hyperfrontend/nexus')).searchParams.get('title')).toBe('[GUIDE] @hyperfrontend/nexus: ')
  })

  it('claims no package when the request comes from the unfiltered index', () => {
    expect(createURL(buildGuideRequestUrl()).searchParams.get('package')).toBeNull()
  })
})
