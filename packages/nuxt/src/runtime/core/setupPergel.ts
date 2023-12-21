import { join, resolve } from 'node:path'
import type { Nuxt } from '@nuxt/schema'
import { type Resolver, addTemplate } from '@nuxt/kit'
import defu from 'defu'
import type { PergelOptions, ResolvedPergelOptions } from './types'
import { rootFolderSync } from './utils/rootFolderSync'

export async function setupPergel(
  data:
  {
    options: PergelOptions
    nuxt: Nuxt
    resolver: Resolver
    version: string
  },
) {
  const { options, nuxt, resolver, version } = data
  const _options = Object.assign({}, options)

  const rootDir = options.rootDir ? options.rootDir : './'
  const pergelDir = join(rootDir, options.pergelDir ?? 'pergel')
  const readmePath = join(pergelDir, 'README.yaml')

  const resolveDir = resolve(join(nuxt.options.rootDir, rootDir))
  const resolvePergelDir = resolve(join(nuxt.options.rootDir, pergelDir))
  const resolveReadmePath = resolve(join(nuxt.options.rootDir, readmePath))

  const { projectNames } = rootFolderSync(resolvePergelDir, options)

  const pergelType = addTemplate({
    filename: 'pergel/types.ts',
    write: true,
    getContents: () => {
      return /* TypeScript */ `
          export type ProjectName = ${projectNames.map((projectName) => {
        return `'${projectName}'`
      }).join(' | ')}
          export type Module = ${nuxt._pergel.modules.map((module) => { return `'${module}'` }).join(' | ')}

          export type PergelGlobalContextOmitModule = Omit<PergelGlobalContext, 'moduleName'>

          export interface PergelGlobalContext {
            projectName: ProjectName
            moduleName: Module
          }
        `.trim().replace(/ {10}/g, '')
    },
  })

  nuxt.options.alias['#pergel/types'] = pergelType.dst
  nuxt.options.nitro.alias ??= {}
  nuxt.options.nitro.alias['#pergel/types'] = pergelType.dst

  const resolvedOptions = defu(options, {
    projects: {
    },
    esnext: true,
    pergelDir,
    rootDir,
  } as PergelOptions)

  const resolvedPergelOptions = defu({}, {
    nitroImports: {},
    nuxtImports: {},
    readmeYaml: {
      pergel: {
        'comment-block-1': 'This file is generated by pergel. Do not edit it manually.',
        'comment-block-2': `Version: ${version}`,
      },
    },
    // Pergel Modules
    modules: [
      'S3',
      'ses',
      'nodeCron',
      'bullmq',
      'json2csv',
      'graphqlYoga',
      'drizzle',
    ],
    resolver,
    dir: {
      pergel: resolvedOptions.pergelDir ?? 'pergel',
      readme: join('pergel', 'README.yaml'),
      root: options.rootDir ?? './',
    },
    rootDir: resolveDir,
    pergelDir: resolve(resolveDir, resolvedOptions.pergelDir ?? 'pergel'),
    readmeDir: resolve(resolveReadmePath),
    projectNames,
    rootOptions: _options,
    projects: {},
    activeModules: {},
    contents: [],
    devServerHandler: [],
    dts: {},
    esnext: true,
    _module: {
      dir: {
        module: '',
        project: '',
        root: '',
      },
      moduleDir: '',
      moduleName: '',
      options: {},
      projectDir: '',
      projectName: '',
    },
  } as ResolvedPergelOptions)

  nuxt._pergel = resolvedPergelOptions
}
