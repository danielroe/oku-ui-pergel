import { basename, join, resolve } from 'node:path'
import { existsSync, writeFileSync } from 'node:fs'
import { addServerImportsDir, createResolver } from '@nuxt/kit'
import { pascalCase } from 'scule'

import { globbySync } from 'globby'
import { definePergelModule } from '../../core/definePergel'
import { useNitroImports } from '../../core/utils/useImports'
import { generateModuleRuntimeConfig } from '../../core/utils/moduleRuntimeConfig'
import { createFolderModule } from '../../core/utils/createFolderModule'
import type { GraphQLYogaConfig, ResolvedGraphQLYogaConfig } from './types'
import { generateGraphQLTemplate } from './utils/generateGraphqlTemplate'

// const _logger = useLogger('pergel:graphql:yoga')

export default definePergelModule<GraphQLYogaConfig, ResolvedGraphQLYogaConfig>({
  meta: {
    name: 'graphqlYoga',
    version: '0.3.0',
    dependencies: {
      '@pergel/graphql': 'latest',
    },
    dts: true,
  },
  defaults({ rootOptions, options, nuxt }) {
    const documentDir = rootOptions.documentDir ? join(nuxt._pergel.rootDir, rootOptions.documentDir) : join(options.serverDir, 'documents')

    const schemaDir = rootOptions.schemaDir ? join(nuxt._pergel.rootDir, rootOptions.schemaDir) : join(options.serverDir, 'graphql')

    const clientConfigFile = rootOptions.codegen?.client?.configFilePath ? resolve(nuxt._pergel.rootDir, rootOptions.codegen?.client?.configFilePath) : resolve(options.serverDir, 'codegen/client.ts')

    const serverConfigFile = rootOptions.codegen?.server?.configFilePath ? resolve(nuxt._pergel.rootDir, rootOptions.codegen?.server?.configFilePath) : resolve(options.serverDir, 'codegen/server.ts')

    rootOptions.documentDir ?? createFolderModule({
      nuxt,
      serverDir: documentDir,
      moduleName: options.moduleName,
      projectName: options.projectName,
    })

    rootOptions.schemaDir ?? createFolderModule({
      nuxt,
      serverDir: schemaDir,
      moduleName: options.moduleName,
      projectName: options.projectName,
    })

    return {
      ...options,
      documentDir,
      schemaDir,
      codegen: {
        client: {
          extension: '.graphql',
          onlyDevelopment: true,
          configFilePath: clientConfigFile,
          config: undefined,
        },
        server: {
          extension: '.graphql',
          onlyDevelopment: true,
          configFilePath: serverConfigFile,
          config: undefined,
        },
      },
      endpoint: '/api/graphql',
      plugins: {
        playground: {
          endpoint: '/api/graphql',
        },
        voyager: {
          endpoint: '/api/graphql/voyager',
          playgroundEndpoint: '/api/graphql',
        },
        sandbox: {
          endpoint: '/api/graphql/sandbox',
          playgroundEndpoint: '/api/graphql',
        },
      },
      yogaConfig: {
        health: '/api/graphql/health',
        ready: '/api/graphql/ready',
      },
      mergeSchemas: false,
      dir: {
        document: basename(documentDir),
        schema: basename(schemaDir),
      },
    }
  },
  async setup({ nuxt, options }) {
    const resolver = createResolver(import.meta.url)

    generateModuleRuntimeConfig<ResolvedGraphQLYogaConfig>(nuxt, options, {
      ...options,
    }, true)

    addServerImportsDir(resolver.resolve('./composables/**'))

    addServerImportsDir(join(nuxt.options.buildDir, 'pergel', options.projectName, options.moduleName, 'client'))

    useNitroImports(nuxt, {
      presets: [
        {
          from: 'graphql',
          imports: ['GraphQLError'],
        },
        {
          from: join(nuxt.options.buildDir, 'pergel', options.projectName, options.moduleName, 'client'),
          imports: [
            {
              as: `${options.projectName}${pascalCase(options.moduleName)}Document`,
              name: '*',
            },
          ],
        },
        {
          from: 'graphql-relay',
          imports: ['connectionFromArraySlice'],
        },
        {
          from: 'ts-relay-cursor-paging',
          imports: [
            'offsetForArgs',
            {
              type: true,
              name: 'DefaultConnectionArguments',
            },
          ],
        },
        {
          from: 'dataloader',
          imports: [{
            name: 'default',
            as: 'DataLoader',
          }],
        },
      ],
    })

    generateGraphQLTemplate({
      nuxt,
      options,
    })

    if (nuxt._pergel.projects[options.projectName]?.drizzle && nuxt._pergel.projects[options.projectName]?.lucia) {
      if (!existsSync(resolve(options.serverDir, 'index.ts'))) {
        const files = globbySync(resolver.resolve(join('templates', 'drizzle-lucia', 'root'), '**/*'), {
          onlyFiles: true,
        })

        for (const file of files) {
          const readFile = await import(file).then(m => m.default).catch(() => null)
          if (readFile) {
            const fileData = readFile({
              projectName: options.projectName,
              nuxt,
            })
            const fileName = basename(file)

            writeFileSync(resolve(options.serverDir, fileName), fileData, {
              encoding: 'utf8',
            })
          }
        }
      }
    }
    else {
      if (!existsSync(resolve(options.serverDir, 'index.ts'))) {
        const files = globbySync(resolver.resolve(join('templates', 'empty', 'root'), '**/*'), {
          onlyFiles: true,
        })

        for (const file of files) {
          const readFile = await import(file).then(m => m.default).catch(() => null)
          if (readFile) {
            const fileData = readFile({
              projectName: options.projectName,
              nuxt,
            })
            const fileName = basename(file)

            writeFileSync(resolve(options.serverDir, fileName), fileData, {
              encoding: 'utf8',
            })
          }
        }
      }
    }

    nuxt._pergel.contents.push({
      moduleName: options.moduleName,
      projectName: options.projectName,
      content: /* ts */`
          function graphqlYoga() {
            return {
              nitro: () => {
                return {
                  use: (definePergelGraphQLYogaPlugin<GraphqlYogaContext>).bind(ctx)
                }
              },
            }
          }
        `,
      resolve: /* ts */`
            graphqlYoga: graphqlYoga,
        `,
    })
  },
})
