import 'side-effect'
import defaultName from 'a'
import * as namespace from 'b'
import { named, renamed as alias, 'string name' as stringName, default as defaultAlias } from 'c'
import defaultAgain, { other } from 'd'
import defaultWithNamespace, * as everything from 'e'
import type TypeDefault from 'f'
import type { TypeNamed, type Inner } from 'g'
import type * as TypeNamespace from 'h'
import { type Mixed, value } from 'i'
import json from 'j' with { type: 'json' }
import quotedAttributes from 'j2' with { 'type': 'json', other: 'x' }
import asserted from 'k' assert { type: 'json' }
import required = require('l')
import aliased = namespace.member
import type typedEquals = require('m')
import { type as typeNamed, type type as typeType } from 'n'
import {} from 'o'
import type from 'y'
import type from from 'z'
export {}
export { named, alias as renamed, stringName as 'string export', defaultName as default }
export { reexported } from 'p'
export { reexportedType as type, type TypeReexport } from 'q'
export type { TypeOnly } from 'r'
export type { LocalType }
export * from 's'
export * as star from 't'
export * as 'string star' from 'u'
export type * from 'v'
export type * as types from 'w'
export const constant = 1
export let variable = 2
export var old = 3
export function fn() {}
export async function asyncFn() {}
export function* gen() {}
export class Klass {}
export abstract class AbstractKlass {}
export interface Interface {}
export type Alias = string
export enum Enumeration {}
export const enum ConstEnumeration {}
export namespace Namespace {}
export declare const ambient: number
export declare function ambientFn(): void
export import namespaced = Namespace
export default function () {}
export as namespace Global
export = constant
import { with as withName } from 'x' with { type: 'json' }
