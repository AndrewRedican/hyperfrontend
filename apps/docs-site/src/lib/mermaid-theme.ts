import type { MermaidConfig } from 'mermaid'

/**
 * Light mode theme variables using the docs-site color palette.
 * Primary: blue-600, text: slate-900, backgrounds: white/slate-50
 */
export const lightThemeVariables = {
  // why: Base colors match the docs-site typography and spacing
  fontSize: '14px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',

  // why: Primary colors (blue-600 based) for nodes and highlights
  primaryColor: '#2563eb',
  // why: mermaid's base theme cascades primaryTextColor into every node/edge label (`.label text, span`), and nodes are filled with the near-white mainBkg — so label text must be dark, not white.
  primaryTextColor: '#1e293b',
  primaryBorderColor: '#1d4ed8',
  nodeTextColor: '#1e293b',

  // why: Secondary colors (slate-100) for supporting elements
  secondaryColor: '#f1f5f9',
  secondaryTextColor: '#334155',
  secondaryBorderColor: '#cbd5e1',

  // why: Tertiary colors (slate-200) for less prominent elements
  tertiaryColor: '#e2e8f0',
  tertiaryTextColor: '#475569',
  tertiaryBorderColor: '#94a3b8',

  // why: Background and lines use slate palette for consistency
  background: '#ffffff',
  mainBkg: '#f8fafc',
  lineColor: '#64748b',
  textColor: '#1e293b',

  // why: Flowchart specific colors for clustering and links
  nodeBorder: '#2563eb',
  clusterBkg: '#f1f5f9',
  clusterBorder: '#cbd5e1',
  defaultLinkColor: '#64748b',

  // why: Sequence diagram colors for actors, signals, and notes
  actorBkg: '#eff6ff',
  actorBorder: '#2563eb',
  actorTextColor: '#1e293b',
  actorLineColor: '#64748b',
  signalColor: '#1e293b',
  signalTextColor: '#1e293b',
  labelBoxBkgColor: '#f1f5f9',
  labelBoxBorderColor: '#cbd5e1',
  labelTextColor: '#334155',
  loopTextColor: '#475569',
  noteBorderColor: '#fbbf24',
  noteBkgColor: '#fef3c7',
  noteTextColor: '#92400e',
  activationBorderColor: '#2563eb',
  activationBkgColor: '#dbeafe',

  // why: State diagram label color
  labelColor: '#1e293b',

  // why: Class diagram text color
  classText: '#1e293b',

  // why: Git graph uses distinct colors for each branch
  git0: '#2563eb',
  git1: '#059669',
  git2: '#d97706',
  git3: '#dc2626',
  git4: '#7c3aed',
  git5: '#db2777',
  git6: '#0891b2',
  git7: '#4b5563',
  gitBranchLabel0: '#ffffff',
  gitBranchLabel1: '#ffffff',
  gitBranchLabel2: '#ffffff',
  gitBranchLabel3: '#ffffff',
  gitBranchLabel4: '#ffffff',
  gitBranchLabel5: '#ffffff',
  gitBranchLabel6: '#ffffff',
  gitBranchLabel7: '#ffffff',
  gitInv0: '#1d4ed8',
  gitInv1: '#047857',
  gitInv2: '#b45309',
  gitInv3: '#b91c1c',
  gitInv4: '#6d28d9',
  gitInv5: '#be185d',
  gitInv6: '#0e7490',
  gitInv7: '#374151',
  commitLabelColor: '#ffffff',
  commitLabelBackground: '#2563eb',
} as const

/**
 * Dark mode theme variables.
 * Primary: blue-500, text: slate-100, backgrounds: slate-900/slate-800
 */
export const darkThemeVariables = {
  // why: Base colors match the docs-site dark mode typography
  fontSize: '14px',
  fontFamily: 'ui-sans-serif, system-ui, sans-serif',

  // why: Primary colors (blue-500 based) are brighter for dark backgrounds
  primaryColor: '#3b82f6',
  primaryTextColor: '#ffffff',
  primaryBorderColor: '#60a5fa',

  // why: Secondary colors (slate-800) provide subtle contrast
  secondaryColor: '#1e293b',
  secondaryTextColor: '#cbd5e1',
  secondaryBorderColor: '#475569',

  // why: Tertiary colors (slate-700) for less prominent elements
  tertiaryColor: '#334155',
  tertiaryTextColor: '#94a3b8',
  tertiaryBorderColor: '#64748b',

  // why: Dark background with light lines for visibility
  background: '#0f172a',
  mainBkg: '#1e293b',
  lineColor: '#94a3b8',
  textColor: '#f1f5f9',

  // why: Flowchart specific colors adapted for dark mode
  nodeBorder: '#3b82f6',
  clusterBkg: '#1e293b',
  clusterBorder: '#475569',
  defaultLinkColor: '#94a3b8',

  // why: Sequence diagram colors with higher contrast for dark backgrounds
  actorBkg: '#1e3a8a',
  actorBorder: '#3b82f6',
  actorTextColor: '#f1f5f9',
  actorLineColor: '#94a3b8',
  signalColor: '#f1f5f9',
  signalTextColor: '#f1f5f9',
  labelBoxBkgColor: '#1e293b',
  labelBoxBorderColor: '#475569',
  labelTextColor: '#cbd5e1',
  loopTextColor: '#94a3b8',
  noteBorderColor: '#d97706',
  noteBkgColor: '#78350f',
  noteTextColor: '#fef3c7',
  activationBorderColor: '#3b82f6',
  activationBkgColor: '#1e3a8a',

  // why: State diagram label color for dark mode
  labelColor: '#f1f5f9',

  // why: Class diagram text color for dark mode
  classText: '#f1f5f9',

  // why: Git graph with brighter colors for dark mode visibility
  git0: '#3b82f6',
  git1: '#10b981',
  git2: '#f59e0b',
  git3: '#ef4444',
  git4: '#8b5cf6',
  git5: '#ec4899',
  git6: '#06b6d4',
  git7: '#6b7280',
  gitBranchLabel0: '#ffffff',
  gitBranchLabel1: '#ffffff',
  gitBranchLabel2: '#000000',
  gitBranchLabel3: '#ffffff',
  gitBranchLabel4: '#ffffff',
  gitBranchLabel5: '#ffffff',
  gitBranchLabel6: '#000000',
  gitBranchLabel7: '#ffffff',
  gitInv0: '#60a5fa',
  gitInv1: '#34d399',
  gitInv2: '#fbbf24',
  gitInv3: '#f87171',
  gitInv4: '#a78bfa',
  gitInv5: '#f472b6',
  gitInv6: '#22d3ee',
  gitInv7: '#9ca3af',
  commitLabelColor: '#ffffff',
  commitLabelBackground: '#3b82f6',
} as const

/**
 * Returns theme variables for the given theme mode.
 *
 * @param theme - The theme mode to get variables for
 * @returns The theme variables object for mermaid configuration
 */
export function getThemeVariables(theme: 'light' | 'dark') {
  return theme === 'dark' ? darkThemeVariables : lightThemeVariables
}

/**
 * Creates a complete Mermaid configuration for the given theme.
 *
 * @param theme - The theme mode to create configuration for
 * @returns A complete MermaidConfig object
 */
export function createMermaidConfig(theme: 'light' | 'dark'): MermaidConfig {
  return {
    startOnLoad: false,
    theme: 'base',
    themeVariables: getThemeVariables(theme),
    flowchart: {
      htmlLabels: true,
      curve: 'basis',
      padding: 15,
      nodeSpacing: 50,
      rankSpacing: 50,
    },
    sequence: {
      diagramMarginX: 16,
      diagramMarginY: 16,
      actorMargin: 60,
      width: 180,
      height: 70,
      boxMargin: 12,
      boxTextMargin: 8,
      noteMargin: 12,
      messageMargin: 40,
      mirrorActors: false,
      useMaxWidth: true,
    },
    class: {
      useMaxWidth: true,
    },
    state: {
      useMaxWidth: true,
    },
    er: {
      useMaxWidth: true,
    },
    gantt: {
      useMaxWidth: true,
    },
    pie: {
      useMaxWidth: true,
    },
  }
}
