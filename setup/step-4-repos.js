const path = require('path')
const {
	IS_WSL, SOURCE, CLAUDE_HOME,
	ok, info, confirm, run, isDir, probe
} = require('./utils')

const REPOS = [
	{
		url: 'git@github.com-personal:samfreeman/samx.git',
		dest: 'samx',
		email: 'sam.freeman.55@gmail.com'
	},
	{
		url: 'git@github.com-personal:samfreeman/cs-bounce.git',
		dest: 'cs-bounce',
		email: 'sam.freeman.55@gmail.com'
	},
	{
		url: 'git@github.com-payonward:SamAtPayOnward/dragonpay-api.git',
		dest: 'dragonpay-api',
		email: 'sfreeman@pay-onward.com'
	}
]

const WSL_ONLY_REPOS = [
	{
		url: 'git@github.com-personal:samfreeman/text-expander.git',
		dest: 'text-expander',
		email: 'sam.freeman.55@gmail.com'
	}
]

module.exports = {
	id: '4-repos',
	name: 'Clone Repos',
	platforms: ['wsl', 'mac'],

	detect() {
		const repos = IS_WSL ? [...REPOS, ...WSL_ONLY_REPOS] : REPOS
		const results = {}

		for (const repo of repos) {
			const dest = path.join(SOURCE, repo.dest)
			if (!isDir(dest)) {
				results[repo.dest] = { cloned: false }
				continue
			}

			const branch = probe(`git -C ${dest} rev-parse --abbrev-ref HEAD`)
			const status = probe(`git -C ${dest} status --porcelain`)
			const remote = probe(`git -C ${dest} remote get-url origin`)

			results[repo.dest] = {
				cloned: true,
				branch: branch.ok ? branch.output : null,
				clean: status.ok ? status.output.length == 0 : null,
				remote: remote.ok ? remote.output : null
			}
		}

		// claude-home remote
		const chRemote = probe(`git -C ${CLAUDE_HOME} remote get-url origin`)
		results['claude-home'] = {
			remote: chRemote.ok ? chRemote.output : null,
			usesAlias: chRemote.ok && chRemote.output.includes('github.com-personal')
		}

		return results
	},

	async fn(state) {
		const repos = IS_WSL ? [...REPOS, ...WSL_ONLY_REPOS] : REPOS

		info(`This step will clone ${repos.length} repos into ~/source/`)
		info('Also creates ~/source/unity container directory')
		info('')
		for (const repo of repos)
			info(`  ${repo.dest} <- ${repo.url}`)
		info('')

		if (!await confirm('Continue?'))
			return { success: false, message: 'User skipped' }

		// Ensure source dir exists
		if (!isDir(SOURCE))
			run(`mkdir -p ${SOURCE}`)

		info('')
		info('Checking existing repos...')
		const detected = this.detect()

		// Clone each repo
		for (const repo of repos) {
			const dest = path.join(SOURCE, repo.dest)
			if (detected[repo.dest]?.cloned)
				ok(`${repo.dest} already exists`)
			else {
				run(`git clone ${repo.url} ${dest}`)
				ok(`Cloned ${repo.dest}`)
			}

			// Set per-repo email if different from global
			if (repo.email != 'sam.freeman.55@gmail.com')
				run(`git -C ${dest} config user.email "${repo.email}"`)
		}

		// Unity container (not a git repo)
		const unityDir = path.join(SOURCE, 'unity')
		if (!isDir(unityDir))
			run(`mkdir -p ${unityDir}`)
		ok('~/source/unity directory ready')

		// Fix claude-home remote to use SSH host alias
		if (detected['claude-home'].usesAlias)
			ok('claude-home remote already uses SSH alias')
		else if (detected['claude-home'].remote?.includes('github.com')) {
			run(`git -C ${CLAUDE_HOME} remote set-url origin git@github.com-personal:samfreeman/claude-home.git`)
			ok('Updated claude-home remote to use github.com-personal')
		}

		// Validate
		const allExist = repos.every(r => isDir(path.join(SOURCE, r.dest)))
		return { success: allExist }
	}
}
