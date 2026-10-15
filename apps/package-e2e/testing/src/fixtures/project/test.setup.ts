import { jest } from '@hyperfrontend/testing'

jest.mock('./src/label', () => ({ label: () => 'from-setup' }))
