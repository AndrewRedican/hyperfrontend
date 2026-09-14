import type { PortNode, PortShape, PortSide, PortsConfig, PortType } from '../models/ports'
import type { MediaProfile } from '../models/profile'
import { round } from '@hyperfrontend/immutable-api-utils/built-in-copy/math'

/** The width the composition is designed at; every measurement scales from it. */
const DESIGN_WIDTH = 640

/** How the frame is sized for the surface it is being drawn for. */
export interface PortsMetrics {
  /** Margin between a node's outer edge and the side of the frame. */
  insetPx: number
  /** Width of a node. */
  nodeWidthPx: number
  /** Top edge of both nodes. */
  nodeTopPx: number
  /** Height of a node. */
  nodeHeightPx: number
  /** Corner radius of a node. */
  cornerPx: number
  /** Font size of a node's name. */
  namePx: number
  /** How far below a node's top edge its name sits. */
  nameTopPx: number
  /** Font size of the API chips. */
  chipPx: number
  /** How far below a node's top edge its chip sits. */
  chipTopPx: number
  /** Vertical centre of the wire. */
  wireY: number
  /** Circumradius of a slot. */
  slotPx: number
  /** How far inside a node's inner edge a slot's centre sits. */
  slotInsetPx: number
  /** Half the height of the opening a slot's throat cuts in the node's edge. */
  throatPx: number
  /** Vertical pitch between two slots on the same node. */
  slotPitchPx: number
  /** Font size of the type name beside a slot, and under a token. */
  labelPx: number
  /** Gap between a slot's rim and its name. */
  labelGapPx: number
  /** Circumradius of a token. */
  tokenPx: number
  /** Gap between a token's rim and the node edge it waits at. */
  standoffPx: number
  /** How far below a token's centre its name sits. */
  tokenLabelDropPx: number
  /** Radius of a handshake pulse. */
  pulsePx: number
  /** How far a token that fits no slot falls before it is gone. */
  fallPx: number
  /** Radius of the mark left where a token dissolved. */
  markPx: number
}

/** A point in the frame, in CSS pixels. */
export interface Point {
  /** Horizontal position. */
  x: number
  /** Vertical position. */
  y: number
}

/** A rectangle in the frame, in CSS pixels. */
export interface Box {
  /** Left edge. */
  x: number
  /** Top edge. */
  y: number
  /** Width. */
  width: number
  /** Height. */
  height: number
}

/** Where one slot is cut. */
export interface SlotPlace {
  /** The type the slot accepts. */
  type: string
  /** The outline the slot is cut in: the shape of the type it accepts. */
  shape: PortShape
  /** Centre of the slot. */
  centre: Point
  /** Where the slot's name starts or ends, depending on `anchor`. */
  nameX: number
  /** Which end of the name sits at `nameX`. */
  anchor: 'start' | 'end'
}

/** Where one node and everything on it sits. */
export interface NodePlace {
  /** Which broker this is. */
  side: PortSide
  /** The broker as the scene configured it. */
  node: PortNode
  /** The node's card. */
  box: Box
  /** The x of the node's inner edge, where the wire meets it. */
  edgeX: number
  /** Where a token waits just outside the inner edge, on the wire. */
  dock: Point
  /** 1 for a node whose inner edge faces right, -1 for one facing left. */
  facing: number
  /** Its slots, top to bottom. */
  slots: readonly SlotPlace[]
}

/** Where everything in the frame sits. */
export interface PortsLayout {
  /** The broker on the left. */
  left: NodePlace
  /** The broker on the right. */
  right: NodePlace
  /** Vertical centre of the wire. */
  wireY: number
}

/**
 * Size the frame for the surface it is being drawn for.
 *
 * Everything scales with the profile's width, so the wide profile gets the
 * same composition at a larger size rather than the same size with more room
 * around it.
 *
 * @param profile - The presentation target being composed for.
 * @returns Every measurement the renderer needs.
 * @example The compact profile's token radius
 * ```ts
 * portsMetrics(resolveProfile('compact')).tokenPx // 9
 * ```
 */
export function portsMetrics(profile: MediaProfile): PortsMetrics {
  const unit = profile.width / DESIGN_WIDTH
  return {
    insetPx: round(40 * unit),
    nodeWidthPx: round(172 * unit),
    nodeTopPx: round(96 * unit),
    nodeHeightPx: round(158 * unit),
    cornerPx: round(14 * unit),
    namePx: round(15 * unit),
    nameTopPx: round(16 * unit),
    chipPx: round(12 * unit),
    chipTopPx: round(42 * unit),
    wireY: round(196 * unit),
    slotPx: round(11 * unit),
    slotInsetPx: round(22 * unit),
    throatPx: round(10 * unit),
    slotPitchPx: round(34 * unit),
    labelPx: round(11 * unit),
    labelGapPx: round(8 * unit),
    tokenPx: round(9 * unit),
    standoffPx: round(8 * unit),
    tokenLabelDropPx: round(24 * unit),
    pulsePx: round(5 * unit),
    fallPx: round(30 * unit),
    markPx: round(7 * unit),
  }
}

/**
 * Where one node sits, its inner edge facing the other.
 *
 * A slot is cut only for an accepted type the scene gave a shape to: a type
 * no contract names has no outline to cut, so it gets no slot and no opening
 * in the card's edge either.
 *
 * @param side - Which broker this is.
 * @param node - The broker as the scene configured it.
 * @param types - Every message type the scene named, with its shape.
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @returns The node's card, its dock and its slots.
 */
function nodePlace(side: PortSide, node: PortNode, types: readonly PortType[], metrics: PortsMetrics, profile: MediaProfile): NodePlace {
  const facing = side === 'left' ? 1 : -1
  const x = side === 'left' ? metrics.insetPx : profile.width - metrics.insetPx - metrics.nodeWidthPx
  const box = { x, y: metrics.nodeTopPx, width: metrics.nodeWidthPx, height: metrics.nodeHeightPx }
  const edgeX = side === 'left' ? x + metrics.nodeWidthPx : x
  const dock = { x: edgeX + facing * (metrics.standoffPx + metrics.tokenPx), y: metrics.wireY }
  const accepted = node.accepts.flatMap((type) => {
    const found = types.find((candidate) => candidate.type === type)
    return found === undefined ? [] : [found]
  })
  const count = accepted.length
  const slots = accepted.map((port, index) => {
    const centre = { x: edgeX - facing * metrics.slotInsetPx, y: metrics.wireY + (index - (count - 1) / 2) * metrics.slotPitchPx }
    const nameX = centre.x - facing * (metrics.slotPx + metrics.labelGapPx)
    const anchor: 'start' | 'end' = facing > 0 ? 'end' : 'start'
    return { type: port.type, shape: port.shape, centre, nameX, anchor }
  })
  return { side, node, box, edgeX, dock, facing, slots }
}

/**
 * Lay both nodes out either side of the wire.
 *
 * @param config - The brokers as the scene configured them.
 * @param metrics - The measurements this profile is drawn at.
 * @param profile - The presentation target being composed for.
 * @returns Where every card, slot and dock sits.
 * @example Where the left node's inner edge is
 * ```ts
 * portsLayout(config, portsMetrics(profile), profile).left.edgeX
 * ```
 */
export function portsLayout(config: PortsConfig, metrics: PortsMetrics, profile: MediaProfile): PortsLayout {
  return {
    left: nodePlace('left', config.left, config.types, metrics, profile),
    right: nodePlace('right', config.right, config.types, metrics, profile),
    wireY: metrics.wireY,
  }
}

/**
 * The node a message sent from one side arrives at.
 *
 * @param layout - Where everything sits.
 * @param from - The side the message set off from.
 * @returns The node on the other side.
 * @example The receiver of a message from the left
 * ```ts
 * receiverOf(layout, 'left').side // 'right'
 * ```
 */
export function receiverOf(layout: PortsLayout, from: PortSide): NodePlace {
  return from === 'left' ? layout.right : layout.left
}

/**
 * The node a message sets off from.
 *
 * @param layout - Where everything sits.
 * @param from - The side the message set off from.
 * @returns The node on that side.
 * @example The sender of a message from the left
 * ```ts
 * senderOf(layout, 'left').side // 'left'
 * ```
 */
export function senderOf(layout: PortsLayout, from: PortSide): NodePlace {
  return from === 'left' ? layout.left : layout.right
}
