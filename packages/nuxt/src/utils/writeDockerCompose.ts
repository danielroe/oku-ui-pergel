import { join } from 'node:path'
import YAML from 'yaml'
import type { NuxtPergel } from '../runtime/core/types/nuxtModule'
import { writeFilePergel } from '../runtime/core/utils/writeFilePergel'

export function writeDockerCompose(
  nuxt: NuxtPergel,
) {
  if (nuxt._pergel.composeTemplates && Object.keys(nuxt._pergel.composeTemplates).length > 0) {
    for (const projectName of Object.keys(nuxt._pergel.composeTemplates)) {
      // TODO: add header commenct 'Auto generated. Do not edit this file manually.'
      const specYaml = YAML.stringify(
        nuxt._pergel.composeTemplates[projectName],
      )

      const file = join(nuxt.options.rootDir, 'pergel', `${projectName}.docker-compose.yml`)
      nuxt._pergel.exitPergelFolder && writeFilePergel(file, specYaml)
    }
  }
}
