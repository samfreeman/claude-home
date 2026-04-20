// Portable path translator. Converts any reasonable path expression
// (Windows drive, UNC, /mnt/c, Unix absolute, ~-relative, %VAR%-containing,
// relative) into the native form for the chosen mode.
//
// Two modes:
//   'windows' — output paths that native Windows Node.js can open
//               (C:\foo, \\wsl$\<distro>\home\<user>\foo)
//   'wsl'     — output paths that a Linux/WSL Node.js can open
//               (/home/<user>/foo, /mnt/c/...)
//
// Designed as a standalone module so it can be reused outside fs-mcp.

import path from 'path'
import { posix, win32 } from 'path'

export type Mode = 'windows' | 'wsl'

export interface WslConfig {
	distro: string
	user: string
	prefixes: string[]
}

export interface TranslatorConfig {
	mode: Mode
	home: string
	wsl?: WslConfig
	expandEnv?: boolean
	cwd?: string
}

export class PathTranslator {
	private mode: Mode
	private home: string
	private wsl?: WslConfig
	private expandEnv: boolean
	private cwd: string
	private sep: string
	private p: typeof win32

	constructor(config: TranslatorConfig) {
		this.mode = config.mode
		this.home = config.home
		this.wsl = config.wsl
		this.expandEnv = config.expandEnv != false
		this.cwd = config.cwd ?? process.cwd()
		this.sep = this.mode == 'windows' ? '\\' : '/'
		this.p = this.mode == 'windows' ? win32 : (posix as unknown as typeof win32)
	}

	translate(raw: string): string {
		let s = this.expandEnv ? this.expandEnvVars(raw) : raw

		if (s == '~')
			return this.home
		if (s.startsWith('~/') || s.startsWith('~\\'))
			return this.resolveTilde(s.slice(2))

		if (/^[A-Za-z]:[\\/]/.test(s))
			return this.resolveDrive(s)

		if (s.startsWith('\\\\') || s.startsWith('//'))
			return this.resolveUnc(s)

		const mnt = s.match(/^\/mnt\/([a-z])(\/.*)?$/i)
		if (mnt)
			return this.resolveDrive(`${mnt[1].toUpperCase()}:${mnt[2] ?? '/'}`)

		if (s.startsWith('/'))
			return this.resolveUnixAbsolute(s)

		return this.p.resolve(this.cwd, this.normalizeSeparators(s))
	}

	wslHome(): string {
		if (!this.wsl)
			throw new Error('WSL config not provided')
		return this.mode == 'windows'
			? `\\\\wsl$\\${this.wsl.distro}\\home\\${this.wsl.user}`
			: `/home/${this.wsl.user}`
	}

	wslRoot(): string {
		if (!this.wsl)
			throw new Error('WSL config not provided')
		return this.mode == 'windows'
			? `\\\\wsl$\\${this.wsl.distro}`
			: ''
	}

	private expandEnvVars(raw: string): string {
		return raw.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (_m, name) => {
			const v = process.env[name]
			if (v == undefined)
				throw new Error(`Env var not set: %${name}%`)
			return v
		})
	}

	private normalizeSeparators(s: string): string {
		return this.mode == 'windows'
			? s.replace(/\//g, '\\')
			: s.replace(/\\/g, '/')
	}

	private resolveTilde(rest: string): string {
		const normalized = this.normalizeSeparators(rest)
		const firstSeg = normalized.split(this.sep)[0]
		if (this.wsl && this.wsl.prefixes.includes(firstSeg))
			return this.p.join(this.wslHome(), normalized)
		return this.p.join(this.home, normalized)
	}

	private resolveDrive(s: string): string {
		const normalized = this.normalizeSeparators(s)
		if (this.mode == 'windows')
			return win32.normalize(normalized)
		const m = s.match(/^([A-Za-z]):[\\/](.*)$/)
		if (!m)
			return s
		const drive = m[1].toLowerCase()
		const rest = m[2].replace(/\\/g, '/')
		return rest ? `/mnt/${drive}/${rest}` : `/mnt/${drive}`
	}

	private resolveUnc(s: string): string {
		const normalized = s.replace(/\//g, '\\')
		const m = normalized.match(/^\\\\wsl\$\\([^\\]+)\\(.*)$/i)
		if (m && this.mode == 'wsl') {
			const distro = m[1]
			const rest = m[2].replace(/\\/g, '/')
			if (this.wsl && distro.toLowerCase() == this.wsl.distro.toLowerCase())
				return '/' + rest
			throw new Error(`UNC path for foreign WSL distro not reachable: ${s}`)
		}
		if (this.mode == 'windows')
			return win32.normalize(normalized)
		throw new Error(`UNC path not reachable in wsl mode: ${s}`)
	}

	private resolveUnixAbsolute(s: string): string {
		if (this.mode == 'wsl')
			return posix.normalize(s)
		if (!this.wsl)
			throw new Error(`Unix absolute path requires wsl config: ${s}`)
		const backslashed = s.replace(/\//g, '\\')
		return win32.normalize(this.wslRoot() + backslashed)
	}
}

export function detectMode(): Mode {
	if (process.platform == 'win32')
		return 'windows'
	return 'wsl'
}
