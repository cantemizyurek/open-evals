import { readdir, readFile, stat } from 'fs/promises'
import { Document } from '@open-evals/rag'

export async function importFiles(url: string): Promise<Document[]> {
  const files = await readdir(url)
  const filesContent = await Promise.all(
    files.map(async (file) => {
      const fileStat = await stat(`${url}/${file}`)
      if (fileStat.isDirectory()) {
        return importFiles(`${url}/${file}`)
      } else {
        if (!file.endsWith('.md') && !file.endsWith('.mdx')) {
          return null
        }
        const fileContent = await readFile(`${url}/${file}`, 'utf-8')
        return {
          id: file,
          content: fileContent,
          metadata: {},
        }
      }
    })
  )
  return filesContent
    .flat()
    .filter((document): document is Document => document !== null)
}
