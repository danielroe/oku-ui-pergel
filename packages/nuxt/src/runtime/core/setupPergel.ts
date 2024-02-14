import { join, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'
import type { Nuxt } from '@nuxt/schema'
import { type Resolver, addTemplate } from '@nuxt/kit'
import defu from 'defu'
import { loadConfig } from 'c12'
import type { ResolvedPergelConfig } from '@pergel/cli/types'
import jiti from 'jiti'
import packageJson from '../../../package.json'
import boxPackageJson from '../../../../box/package.json'
import s3PackageJson from '../../../../s3/package.json'
import graphqlPackageJson from '../../../../graphql/package.json'

import type { PergelOptions, ResolvedPergelOptions } from './types/nuxtModule'

async function readConfigFile(path: string) {
  return await jiti(import.meta.url, {
    interopDefault: true,
    requireCache: false,
    esmResolve: true,
    cache: false,
  })(path)
}

export async function setupPergel(
  data:
  {
    options: PergelOptions
    nuxt: Nuxt
    resolver: Resolver
    version: string
  },
) {
  const file = await loadConfig({
    cwd: data.nuxt.options.rootDir,
    configFile: 'pergel.config.ts',
    defaultConfig: {
      // TODO: add cwd
      dir: {
        pergel: 'pergel',
        template: 'pergel/templates',
        server: 'server',
      },
      filePath: {
        nuxtConfig: 'nuxt.config.ts',
      },
    } as ResolvedPergelConfig,
  })

  if (!file.config)
    throw new Error('Pergel config not found.')

  let exitPergelFolder = false

  if (file)
    exitPergelFolder = true

  const { options, nuxt, resolver, version } = data

  const pergelDir = file.config.dir.pergel ?? 'pergel'
  const templateDir = file.config.dir.template ?? join('pergel', 'templates')
  const readmePath = join(pergelDir, 'README.json')
  const serverDir = file.config.dir.server ?? 'server'

  // TODO: nuxt.options.rootDi ?? file.config.cwd
  const resolveDir = resolve(nuxt.options.rootDir)

  exitPergelFolder && mkdirSync(join(resolveDir, pergelDir), { recursive: true })
  exitPergelFolder && mkdirSync(join(resolveDir, templateDir), { recursive: true })

  const projectNames = Object.keys(options.projects ?? {}).sort()

  const pergelType = addTemplate({
    filename: 'pergel/types.ts',
    write: true,
    getContents: () => {
      return /* TypeScript */ ` // @ts-ignore
import type { PergelH3ContextItem, PergelContextKeys } from '@pergel/nuxt/runtime/modules'
export type { PergelContextKeys }

export type ProjectName =  ${projectNames.length === 0
? `'test'`
: projectNames.map((projectName) => {
          return `'${projectName}'`
        }).join(' | ')}
export type Module = ${nuxt._pergel.modules.map((module) => { return `'${module}'` }).join(' | ')}

export type PergelGlobalContextOmitModule = Omit<PergelGlobalContext, 'moduleName'>

export interface PergelGlobalContext {
  projectName: ProjectName
  moduleName: Module
}

declare module 'h3' {
  interface H3EventContext {
    pergelContext: {
      [projectName in ProjectName]: PergelH3ContextItem
    }
  }
}
        `.trim().replace(/ {10}/g, '')
    },
  })

  nuxt.options.alias['#pergel/types'] = pergelType.dst
  nuxt.options.nitro.alias ??= {}
  nuxt.options.nitro.alias['#pergel/types'] = pergelType.dst

  nuxt.hooks.hook('prepare:types', ({ references, tsConfig }) => {
    references.push({
      path: pergelType.dst,
    })

    tsConfig.include ??= []
    tsConfig.include.push('./pergel/**/*')
  })

  nuxt.hooks.hook('nitro:init', ({ options }) => {
    options.typescript.tsConfig ??= {}
    options.typescript.tsConfig.include ??= []
    options.typescript.tsConfig.include.push('./pergel/**/*')
    options.typescript.tsConfig.include.push(resolve(join(nuxt.options.rootDir, 'pergel', '/**/*')))
  })

  const resolvedPergelOptions = defu(options, {
    exitPergelFolder,
    rootOptions: options,
    // @MODULE nuxt._pergel.modules
    modules: [
      'S3',
      'ses',
      'nodeCron',
      'bullmq',
      'json2csv',
      'graphqlYoga',
      'drizzle',
      'lucia',
      'box',
      'urql',
      'vitest',
      'eslint',
    ],
    projectNames,
    nitroImports: {},
    nuxtImports: {},
    readmeYaml: {
      pergel: {
        'comment-block-1': 'This file is generated by pergel. Do not edit it manually.',
        'comment-block-2': `Version: ${version}`,
      },
    },
    readmeJson: {
      pergel: {
        'comment-block-1': 'This file is generated by pergel. Do not edit it manually.',
        'comment-block-2': `Version: ${version}`,
      },
    },
    resolver,
    devServerHandler: [],
    dts: {},
    projects: {},
    dir: {
      pergel: pergelDir ?? 'pergel',
      readme: join(pergelDir, 'README.json'),
      server: file.config.dir.server ?? 'server',
    },
    contents: [],
    pergelDir: resolve(resolveDir, pergelDir),
    templateDir: resolve(resolveDir, templateDir),
    rootDir: resolveDir,
    readmeDir: resolve(resolveDir, readmePath),
    esnext: true,
    debug: false,
    serverDir: resolve(resolveDir, serverDir),
    watchDirs: [],
    resolveModules: [],
    pergelPackageJson: {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      '@pergel/module-graphql': graphqlPackageJson.version,
      '@pergel/module-box': boxPackageJson.version,
      '@pergel/module-s3': s3PackageJson.version,
    },
    pergelModuleRoot: resolver.resolve('./'),
    jitiDyanmicImport: (path: string) => readConfigFile(path),
  } satisfies ResolvedPergelOptions)
  nuxt._pergel = resolvedPergelOptions as any
}
